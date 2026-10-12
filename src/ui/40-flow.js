// UI: Trip flow: start, stages, reward claim, placement open/close, campfire heal.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

function startTrip(mode) {
  ui.runId++;
  hooks.onRestart();
  ui.trip = mode === 'm2' ? E.createTrip(Math.random, 'm2') : E.createTrip(Math.random);
  ui.game = null; view = null;
  ui.reward = null; ui.healing = false; ui.mapMsg = null; ui.mapFlash = null; ui.mapBusy = false; ui.jumpRestore = null;
  hidePopover();
  openPlacement('intro');
}
// RESTART TRIP: a brand-new trip (same mode as the current one) from the intro screen.
function onRestart() { startTrip(ui.trip && ui.trip.mode === 'm2' ? 'm2' : 'm1'); }
// Start choice: M1 sequence or M2 map.
function showStart() {
  ui.runId++;
  hooks.onRestart();
  ui.game = null; view = null; ui.reward = null; ui.healing = false;
  ui.screen = 'start'; ui.phase = 'screen';
  hidePopover();
  renderAll();
}

// ---------- trip flow ----------
// Finishes the current stage (M1: next sequence entry; M2: the tile resolves, back to the map). A debug jump made from
// the map puts the tile under the player back as it was.
function advance() {
  const t = ui.trip;
  const r = E.advanceStage(t);
  if (ui.jumpRestore && t.map) {
    const tile = t.map.tiles[ui.jumpRestore.r][ui.jumpRestore.c];
    Object.assign(tile, ui.jumpRestore.fields);
    ui.jumpRestore = null;
  }
  return r;
}
// Starts whatever the trip's current stage is: an encounter, the campfire, or the end screen.
function enterStage() {
  const t = ui.trip;
  ui.runId++;
  hidePopover();
  ui.reward = null; ui.healing = false;
  if (t.over || !t.stage) { showEnd(); return; }
  if (t.stage === C.trip.mapStage) {      // M2: back on the map
    ui.game = null; view = null;
    ui.screen = 'map'; ui.phase = 'map'; ui.mapBusy = false;
    renderAll();
    return;
  }
  if (E.isCampfire(t.stage)) {
    ui.screen = 'campfire'; ui.phase = 'screen';
    renderAll();
    return;
  }
  if (t.stage === C.trip.siteStage || C.sites[t.stage]) {     // scavenge site (M2 SITE stage: already created by moveTo / debug jump)
    const site = t.stage === C.trip.siteStage && t.site ? t.site : E.startSite(t, t.stage, Math.random);
    ui.game = site;
    ui.screen = 'encounter'; ui.phase = 'await-roll';
    ui.slots = emptySlots(); ui.holdPick = false;
    ui.pipRec = site.faces.map(() => []);
    ui.previewOverride = null; ui.enemyText = ''; ui.verbFlash = ''; ui.actingSlot = null;
    hooks.onRestart();
    buildSitePanel();
    syncView();
    renderAll();
    return;
  }
  const pending = t.encounter;            // M2 tile / guardian: the engine already started this fight
  ui.game = pending && pending.enemyId === t.stage && !pending.over && pending.turn === 1 && !pending.log.length
    ? pending : E.startEncounter(t, t.stage, Math.random);
  ui.screen = 'encounter'; ui.phase = 'await-roll';
  ui.slots = emptySlots(); ui.holdPick = false;
  ui.previewOverride = null; ui.enemyText = ''; ui.verbFlash = ''; ui.actingSlot = null;
  hooks.onRestart();
  buildEnemyPanel();
  syncView();
  renderAll();
}
function showEnd() {
  ui.screen = 'end'; ui.phase = 'screen'; ui.reward = null; ui.healing = false;
  hidePopover();
  renderAll();
}
// CONTINUE on the encounter result overlay: lost -> end screen, won -> reward screen.
function onContinue() {
  if (ui.screen !== 'encounter') return;
  const g = ui.game, t = ui.trip;
  if (g.over === 'lost' || t.over === 'lost') { showEnd(); return; }
  if (ui.phase === 'guardian') { enterStage(); return; }     // the noise brought the guardian: fight it
  if (g.over !== 'won') return;
  const info = E.rewardsFor(t, g.result);
  if (info.empty) {                       // nothing to get: no reward screen, no placement
    E.claimReward(t, g.result, null, Math.random);
    advance();
    enterStage();
    return;
  }
  ui.reward = { result: g.result, label: g.resultLabel || g.result, info, lost: info.returned.length ? [] : g.taken.slice(), picked: null };
  ui.screen = 'reward'; ui.phase = 'screen';
  renderAll();
}
// Reward -> placement. The placement screen is entered ONLY through openPlacement(mode); mode is 'reward' | 'campfire'.
function claimAndPlace(pick) {
  const t = ui.trip, r = ui.reward;
  const res = E.claimReward(t, r.result, pick, Math.random);
  if (!res.ok) return;
  if (res.revealed && res.revealed.length) {
    ui.mapFlash = res.revealed;
    ui.mapMsg = { text: MT().revealedMsg.replace('{n}', res.revealed.length), cold: false };
  }
  openPlacement('reward');
}
function openPlacement(mode) {
  ui.placementMode = mode;
  ui.place.sel = null; ui.place.pending = null;
  E.beginPlacement(ui.trip, mode);
  ui.screen = 'placement'; ui.phase = 'screen'; ui.healing = false;
  renderAll();
}
// DONE on the placement screen: locks the placement in and moves to the next stage of the trip
// (intro: the trip's first stage was never played, so nothing advances).
function closePlacement() {
  const intro = ui.placementMode === 'intro';
  ui.place.sel = null; ui.place.pending = null;
  E.endPlacement(ui.trip);
  if (!intro) advance();
  enterStage();
}
function healFace(dieId, idx) {
  const r = E.healScar(ui.trip, dieId, idx);
  if (!r.ok) return;
  ui.healing = false;
  renderAll();
  hooks.onHeal(dieId, idx);
  ui.runId++;
  const run = ui.runId;
  setTimeout(() => { if (ui.runId === run) { advance(); enterStage(); } }, 650);
}
