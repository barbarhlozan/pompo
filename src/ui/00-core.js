// UI: State (ui, view), helpers, token/face HTML, view model.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// Trip flow (ui.screen): encounter -> reward -> placement -> ... campfire (heal | placement) ... -> end (won | lost).
// Encounter phase machine (ui.phase): 'await-roll' -> ['start' (watering-can SOW plays)] -> 'arranging' -> 'resolving' -> 'enemy'
// -> 'await-roll' ... 'won' | 'lost'; 'screen' while a non-encounter screen is up.
// Game rules live in SmugEngine; the UI only draws a *view model* (`view`) that the event player updates step by
// step, so the display can lag behind the (already fully resolved) engine state while events play back.
const E = globalThis.SmugEngine;
const C = CONFIG;
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ui = {
  trip: null,
  screen: 'start',             // 'start' | 'map' | 'encounter' (fight or scavenge site) | 'reward' | 'placement' | 'campfire' | 'end'
  reward: null,                // { result, info:{ending,choose,give,returned}, lost:[ids], picked }
  placementMode: 'reward',     // 'reward' | 'campfire' | 'intro'
  healing: false,              // campfire: waiting for a scar face click
  game: null,                  // the current encounter (the last one while on a non-encounter screen)
  phase: 'await-roll',
  slots: [null, null, null],   // die id per sentence slot (length = number of player dice; only the first game.slots are used)
  holdPick: false,             // mindAloneHolds: a body die must be picked to keep its face (engine holdPending)
  hover: null,                 // die id under the pointer
  drag: null,
  runId: 0,                    // bumped on restart: aborts an in-flight event playback
  enemyText: '',               // line under the intent (enemy action flavour)
  previewOverride: null,       // {shape, text} while a committed sentence plays
  verbFlash: '',
  actingSlot: null,
  hidePips: false,             // debug panel: hide enemy pip states / resolved tile looks in the face strip
  showMap: false,              // debug: draw the whole map without fog
  showSite: false,             // debug: draw hidden site contents
  mapBusy: false,              // a map step is playing
  mapMsg: null,                // { text, cold } line under the map
  mapFlash: null,              // [{c,r}] tiles revealed by the dog (one-shot pulse when the map is drawn)
  jumpRestore: null,           // debug jump from the map: the tile under the player is put back after the stage
  pipRec: [],                  // site: per face, the state each removed pip got ('broken' | 'turned')
  place: { sel: null, pending: null, drag: null, suppress: false },   // placement screen: click selection, replace confirmation, active drag
};
let view = null;               // { enemy:{faces,current,next}, dice:{id:{faces,idx}} }

// ---------- helpers ----------
const dieById = (id) => ui.game.player.dice.find(d => d.id === id);
const slotCount = () => (ui.game && ui.game.slots) || C.defaultSlots;     // sentence length of the current encounter / site
const emptySlots = () => C.playerDice.map(() => null);                   // ui.slots always has one entry per possible slot
const slotOf = (id) => ui.slots.indexOf(id);
const placedCount = () => ui.slots.slice(0, slotCount()).filter(Boolean).length;
const bodyIds = () => E.bodyDieIds();
const dieRule = () => C.loseRule !== 'maxScars';
// 'HEAD 1/6 · TORSO 0/6' (dieLost rule) or 'n/max' (maxScars rule); `faces` = (dieId) => its face list
function scarSummary(facesOf) {
  if (!dieRule()) { const n = bodyIds().reduce((a, id) => a + facesOf(id).filter(f => f === C.text.scar).length, 0); return n + '/' + C.maxScars; }
  return C.playerDice.filter(d => d.kind !== 'mind').map(d => (d.label || d.id) + ' ' + facesOf(d.id).filter(f => f === C.text.scar).length + '/' + facesOf(d.id).length).join(' · ');
}
const tripFaces = (id) => ui.trip.dice.find(d => d.id === id).faces;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// `signed` comes from src/engine/00-core.js (same global scope).
const itemName = (id) => (C.items[id] ? C.items[id].name : id);
const faceLabel = (f) => f.split('+').map(t => itemName(t)).join('+');
const canInteract = () => ui.phase === 'arranging';
const isSite = () => !!ui.game && ui.game.siteId !== undefined;   // ui.game is a scavenge site (same dice fields as an encounter)
const MT = () => C.text.m2;

function tokenColor(tok) {
  const p = E.parseFace(tok);
  if (p.kind === 'scar') return { bg: C.colors.scar, fg: C.colors.scarText, cls: 'scar' };
  if (p.kind === 'verb') return { bg: C.colors.verb[tok] || '#888', fg: C.colors.tileText, cls: '' };
  if (C.colors.body[tok]) return { bg: C.colors.body[tok], fg: C.colors.tileText, cls: '' };
  if (C.colors.item[tok]) return { bg: C.colors.item[tok], fg: C.colors.tileText, cls: '' };
  return { bg: '#888', fg: C.colors.tileText, cls: '' };
}
function tokenTitle(tok) {
  if (C.verbInfo[tok]) return tok + ': ' + C.verbInfo[tok];
  if (C.items[tok]) return C.items[tok].name + ' — ' + C.items[tok].info;
  const pi = C.bodyParts[tok];
  if (pi) return tok + ': ' + (pi.fixedPoints != null ? pi.fixedPoints + ' point(s) under any verb' : 'favourite verb ' + pi.favourite + ' (2 points, otherwise 1)') +
    (pi.revealsNext ? '; also reveals the next intent' : '') + (pi.vulnerable ? '; vulnerable: exposed = a scar on its die (VEST covers)' : '');
  return '';
}
function tileHTML(tok, extra) {
  const c = tokenColor(tok);
  const t = tokenTitle(tok);
  return '<span class="tile ' + c.cls + (extra ? ' ' + extra : '') + '" style="background:' + c.bg + ';color:' + c.fg + '"' +
    (t ? ' title="' + esc(t) + '"' : '') + '>' + tok + '</span>';
}
// item id -> its name as an item-coloured tile (item colour keyed by id; name shown)
// uses (optional number): remaining charges, shown as ×n on the tile
function itemTileHTML(id, extra, uses) {
  const col = C.colors.item[id] || '#b967ff';
  const d = C.items[id];
  return '<span class="tile ' + (extra || '') + '" style="background:' + col + ';color:' + C.colors.tileText + '" title="' + esc(d ? d.name + ' — ' + d.info + (uses != null ? ' (' + uses + ' uses left)' : '') : id) + '">' +
    esc(d ? d.name : id) + (uses != null ? ' ×' + uses : '') + '</span>';
}
// verb words in free text -> coloured, tooltipped spans
function verbify(text) {
  const alias = { force: 'PRUNE', coax: 'SOW', search: 'DIG' };
  return esc(text).replace(/\b(PRUNE|SOW|DIG|force|coax|search)\b/g, (m) => { const v = alias[m] || m;
    return '<span class="vb" style="color:' + C.colors.verb[v] + '" title="' + esc(C.verbInfo[v]) + '">' + m + '</span>'; });
}
// 'HAND+KNIFE' -> two stuck-together tiles
function faceHTML(face, extra) {
  if (face === C.text.scar) return tileHTML(face, extra);
  const p = face.split('+');
  return tileHTML(p[0], extra) + (p[1] ? itemTileHTML(p[1], extra) : '');
}

// ---------- view model ----------
function snapshotEnemy(en) {
  const cp = (i) => i ? { faceIdx: i.faceIdx, wag: i.wag } : null;
  const queue = en.upcoming.slice(0, en.shown).map(cp);
  return { faces: en.faces.map(f => ({ name: f.name, pips: f.pips.slice(), hostile: f.hostile })), current: cp(en.current), next: cp(en.next),
    queue, bag: ui.game && ui.game.taken ? ui.game.taken.slice() : [] };
}
function snapshotSite(site) {
  return { noise: site.noise, target: site.target, found: site.gained.slice(),
    faces: site.faces.map((f, i) => ({ content: f.content, item: f.item, brokenItem: f.brokenItem, revealed: f.revealed, opened: f.opened,
      pipsLeft: f.pipsLeft, pips: Array.from({ length: f.pips }, (_, p) => (p < f.pips - f.pipsLeft ? ((ui.pipRec[i] || [])[p] || 'broken') : 'intact')) })) };
}
function syncView() {
  const g = ui.game;
  view = { dice: {} };
  if (isSite()) view.site = snapshotSite(g); else view.enemy = snapshotEnemy(g.enemy);
  g.player.dice.forEach(d => { view.dice[d.id] = { faces: d.faces.slice(), idx: d.idx, frozen: !!d.frozen }; });
}
const viewFace = (id) => view.dice[id].faces[view.dice[id].idx];
const viewScars = () => Object.keys(view.dice).reduce((n, id) => n + view.dice[id].faces.filter(f => f === C.text.scar).length, 0);
