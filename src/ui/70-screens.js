// UI: Non-encounter screens (start, reward, campfire, end, map, placement HTML), nets.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- trip screens (simple DOM, rebuilt on change) ----------
const part = (id) => C.items[id].part;
function verbLines(id) {
  const d = C.items[id];
  return C.verbs.map(v => '<div><b style="color:' + C.colors.verb[v] + '" title="' + esc(C.verbInfo[v]) + '">' + v + '</b>' + esc(d.names[v] || (C.actionNames[d.part] && C.actionNames[d.part][v]) || '–') + '</div>').join('');
}
function itemCardHTML(id, cls, i) {
  const d = C.items[id];
  return '<div class="rcard ' + (cls || '') + ' pop-in" style="--i:' + (i || 0) + '" data-item="' + id + '">' +
    '<div class="tiles">' + tileHTML(d.part) + itemTileHTML(id) + '</div>' +
    '<div class="info">' + esc(d.info) + '</div><div class="verbs">' + verbLines(id) + '</div></div>';
}
// ---------- die nets (placement, campfire heal, end screen) ----------
// o.mode: 'place' (items draggable / droppable) | 'heal' (scar faces clickable) | 'view'; o.mini: compact size.
function netHTML(dieId, o) {
  o = o || {};
  const t = ui.trip, die = t.dice.find(d => d.id === dieId), S = C.text.s;
  const placing = o.mode === 'place', mode = ui.placementMode, sel = ui.place.sel;
  const cells = die.faces.map((f, i) => {
    const p = E.parseFace(f);
    const cls = ['nf', 'p' + i];
    let attrs = ' data-die="' + dieId + '" data-idx="' + i + '"', inner;
    if (p.kind === 'scar') {
      cls.push('scar');
      if (o.mode === 'heal') { cls.push('heal'); attrs += ' data-act="healFace" title="' + esc(S.healTip) + '"'; }
      inner = tileHTML(C.text.scar, 'small');
    } else {
      inner = '<div class="bp">' + tileHTML(p.body, 'small') + '</div>';
      if (p.item) {
        const locked = placing && E.isLocked(t, dieId, i, mode);
        inner += '<div class="it ' + (placing ? (locked ? 'locked' : 'movable') : '') + (sel && sel.kind === 'face' && sel.die === dieId && sel.idx === i ? ' selected' : '') + '"' +
          (placing && !locked ? ' data-drag="face" data-item="' + p.item + '"' : '') + (locked ? ' title="' + esc(S.lockedTip) + '"' : '') + '>' +
          itemTileHTML(p.item, 'small', E.usesLeft(t, dieId, i)) + (locked ? '<i class="lock">🔒</i>' : (placing && mode === 'reward' ? '<b class="new">' + S.newTag + '</b>' : '')) + '</div>';
      } else inner += '<div class="it empty">' + (o.mini ? '' : S.slotEmpty) + '</div>';
      if (placing && sel) {
        const src = sel.item, c = E.canPlace(t, src, dieId, i, mode);
        if (c.ok && !(sel.kind === 'face' && sel.die === dieId && sel.idx === i)) cls.push('valid', 'selvalid');
      }
    }
    return '<div class="' + cls.join(' ') + '"' + attrs + '><span class="n">' + (i + 1) + '</span>' + inner + '</div>';
  });
  return '<div class="net' + (o.mini ? ' mini' : '') + '" data-net="' + dieId + '">' + cells.join('') + '</div>';
}
const oddsHTML = (dieId) => '<div class="odds" data-odds="' + dieId + '">' + esc(E.oddsSummary(ui.trip.dice.find(d => d.id === dieId)).text) + '</div>';
function netBoxHTML(dieId, o) {
  return '<div class="netbox"><div class="nbl">' + dieId + '</div>' + netHTML(dieId, o) + oddsHTML(dieId) + '</div>';
}
function mindRowHTML() {
  const die = ui.trip.dice.find(d => d.kind === 'mind');
  if (!die) return '';
  return '<div class="dicelist"><div class="dl"><span class="nm">' + esc(die.label || die.id) + '</span><div class="faces">' +
    die.faces.map(f => '<span class="f">' + faceHTML(f, 'small') + '</span>').join('') + '</div></div></div>';
}
const btn = (label, act, extra) => '<button class="btn primary" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>';

const SCREENS = {
  reward(root) {
    const r = ui.reward, S = C.text.s, info = r.info;
    const beaten = info.ending === 'beaten';
    let h = '<h2 style="color:' + (beaten ? C.colors.verb.PRUNE : C.colors.turned) + '">' + esc(r.label || r.result) + '</h2>' +
      '<div class="sub">' + esc(ui.game.enemy.winText[info.ending]) + '</div>';
    let n = 0;
    if (info.choose) {
      h += '<div class="sect">' + S.rewardChoose + '</div><div class="row">' +
        info.choose.map(id => itemCardHTML(id, 'pick' + (r.picked === id ? ' picked' : (r.picked ? ' faded' : '')), n++).replace('data-item', 'data-act="pick" data-item')).join('') + '</div>';
    }
    if (info.revealTiles && ui.trip.mode === 'm2') h += '<div class="sub" style="color:' + C.colors.turned + '">' + esc(MT().revealsTiles.replace('{n}', info.revealTiles)) + '</div>';
    if (info.give.length) h += '<div class="sect">' + S.rewardGive + '</div><div class="row">' + info.give.map(id => itemCardHTML(id, '', n++)).join('') + '</div>';
    if (info.returned.length) h += '<div class="sect">' + S.rewardReturned + '</div><div class="row">' + info.returned.map(id => itemCardHTML(id, '', n++)).join('') + '</div>';
    if (r.lost.length) h += '<div class="sect">' + S.rewardLost + '</div><div class="row">' + r.lost.map(id =>
      '<div class="rcard small faded">' + itemTileHTML(id) + '</div>').join('') + '</div>';
    if (!info.choose) h += '<div class="row" style="margin-top:6px">' + btn(S.take, 'take') + '</div>';
    root.innerHTML = h;
  },
  placement(root) {
    const t = ui.trip, S = C.text.s, mode = ui.placementMode, pl = ui.place;
    const sel = pl.sel;
    const inv = t.inventory.map((id, k) => '<div class="inv' + (sel && sel.kind === 'inv' && sel.k === k ? ' sel' : '') + '" data-drag="inv" data-item="' + id + '" data-k="' + k + '">' +
      tileHTML(C.items[id].part, 'small') + itemTileHTML(id, 'small', E.inventoryUses(t, k)) + '</div>').join('');
    let h = '<div class="plwrap"><h2>' + S.placeTitle + '</h2><div class="sub" style="margin-top:-6px">' + esc(mode === 'intro' ? S.placeIntro : mode === 'campfire' ? S.placeCampfire : S.placeReward) + '</div>' +
      '<div class="plnets">' + E.bodyDieIds().map(id => netBoxHTML(id, { mode: 'place' })).join('') + '</div>' +
      '<div class="invtray" id="invTray"><div class="sect" style="margin:0">' + S.inventory + ' · ' + t.inventory.length + '</div>' +
      '<div class="invrow">' + (inv || '<span class="lbl">' + S.inventoryEmpty + '</span>') + '</div>' +
      '<div class="lbl" style="font-size:11px;letter-spacing:.08em">' + esc(t.inventory.length ? S.placeInvHint : (mode !== 'reward' ? S.trayDrop : '')) + '</div></div>' +
      '<div class="row">' + btn(S.done, 'done') + '</div></div>';
    if (pl.pending) {
      const pd = pl.pending;
      h += '<div class="cback"><div class="confirm"><div class="ct">' + S.replaceTitle + '</div><div class="cd">' +
        '<span><s>' + itemTileHTML(pd.replaces) + '</s></span><span>' + S.replaceDiscard.replace('{item}', esc(itemName(pd.replaces))) + '</span></div>' +
        '<div class="cd"><span class="lbl">' + S.replaceBecomes + '</span>' + itemTileHTML(pd.src.item) + '</div>' +
        '<div class="row">' + btn(S.replaceYes, 'confirmReplace') + '<button class="btn" data-act="cancelReplace">' + S.replaceNo + '</button></div></div></div>';
    }
    root.innerHTML = h;
  },
  campfire(root) {
    const S = C.text.s, scars = E.tripScars(ui.trip);
    if (ui.healing) {
      root.innerHTML = '<h2>' + S.healTitle + '</h2><div class="sub">' + S.healPick + '</div>' +
        '<div class="plnets">' + E.bodyDieIds().map(id => netBoxHTML(id, { mode: 'heal' })).join('') + '</div>' +
        '<div class="row">' + btn(S.back, 'back') + '</div>';
      return;
    }
    root.innerHTML = '<h2>' + S.campfireTitle + '</h2><div class="sub">' + S.campfireSub + '</div><div class="row" style="margin-top:12px">' +
      '<div class="ctile pop-in' + (scars ? '' : ' off') + '" data-act="heal"><div class="t" style="color:' + C.colors.turned + '">' + S.healTitle + '</div><div class="d">' +
        (scars ? S.healDesc : S.healNone) + '</div><div class="faceRow">' + (scars ? tileHTML(C.text.scar) : '') + '</div></div>' +
      '<div class="ctile pop-in" style="--i:1" data-act="rearrange"><div class="t" style="color:' + C.colors.lit + '">' + S.rearrangeTitle + '</div><div class="d">' +
        S.rearrangeDesc + '</div><div class="faceRow">' + tileHTML('PALM') + itemTileHTML('KNIFE') + '</div></div></div>' +
      '<div class="sub">' + scarSummary(tripFaces) + ' scars · ' + ui.trip.inventory.length + ' item(s) in the inventory</div>';
  },
  start(root) {
    const M = MT();
    root.innerHTML = '<h2 style="margin-top:70px">' + esc(C.text.title) + '</h2><div class="sub">' + esc(M.startSub) + '</div><div class="row" style="margin-top:26px">' +
      '<div class="ctile pop-in" data-act="startM1"><div class="t" style="color:' + C.colors.lit + '">' + esc(M.startM1) + '</div><div class="d">' + esc(M.startM1Desc) + '</div></div>' +
      '<div class="ctile pop-in" style="--i:1" data-act="startM2"><div class="t" style="color:' + C.colors.map.CAMPFIRE + '">' + esc(M.startM2) + '</div><div class="d">' + esc(M.startM2Desc) + '</div></div></div>';
  },
  map(root) {
    const t = ui.trip, M = MT(), cells = E.mapView(t), K = C.colors.map, dayMax = C.map.daylight;
    const cold = t.daylight <= 0;
    const flash = ui.mapFlash || [];
    let n = 0;
    const grid = cells.map(row => row.map(cell => {
      const raw = t.map.tiles[cell.r][cell.c];
      const shown = cell.visible || ui.showMap;
      const type = shown ? raw.type : null;
      const word = shown ? E.tileWord(raw) : C.map.words.FOG;
      const cls = ['mt', type ? type : 'fog'];
      if (!cell.visible && ui.showMap) cls.push('dbgshown');
      if (cell.visited) cls.push('visited');
      if (cell.revealed && !cell.visited) cls.push('seen');
      if (cell.here) cls.push('here');
      if (cell.reachable) cls.push('reach', cold ? 'cold' : '');
      if (flash.some(f => f.c === cell.c && f.r === cell.r)) cls.push('newrev');
      const bg = type ? (K[type] || K.EMPTY) : K.FOG;
      const fs = word.length <= 5 ? 28 : (word.length <= 8 ? 22 : 17);
      const tip = cell.here ? M.hereTip : (cell.reachable ? (cold ? M.moveTipCold : M.moveTip) + ' · ' + word : (type ? word : M.fogTip));
      return '<div class="' + cls.join(' ') + '" style="background:' + bg + '" data-c="' + cell.c + '" data-r="' + cell.r + '"' +
        (cell.reachable ? ' data-act="move"' : '') + ' title="' + esc(tip) + '">' +
        '<span class="ty">' + esc(type ? (M.typeLabel[type] || '') : '') + '</span><span class="word" style="font-size:' + fs + 'px">' + esc(word) + '</span>' +
        (cell.here ? '<b class="you">' + esc(M.you) + '</b>' : '') + '</div>';
    }).join('')).join('');
    const suns = Array.from({ length: dayMax }, (_, i) => '<span class="sun' + (i < t.daylight ? '' : ' off') + '" data-i="' + i + '">☀</span>').join('');
    const sc = E.tripScars(t);
    const scars = dieRule() ? '' : Array.from({ length: C.maxScars }, (_, i) => '<span class="stl' + (i < sc ? ' on' : '') + '">✕</span>').join('');
    const inv = t.inventory.map(id => '<span class="inv">' + tileHTML(C.items[id].part, 'small') + itemTileHTML(id, 'small') + '</span>').join('');
    const msg = ui.mapMsg || { text: cold ? M.coldHint : M.mapHint, cold };
    root.innerHTML = '<div class="mapwrap"><div class="maphead">' +
      '<div class="mh"><span class="lbl">' + M.daylight + ' ' + t.daylight + '/' + dayMax + '</span><div class="suns">' + suns + '</div></div>' +
      '<div class="mh"><span class="lbl">' + M.scars + ' ' + scarSummary(tripFaces) + '</span><div class="scarrow">' + scars + '</div></div></div>' +
      '<div class="mapgrid">' + grid + '</div>' +
      '<div class="mapfoot"><span class="lbl">' + M.items + ' ' + t.inventory.length + '</span>' + (inv || '') +
      '<span class="mapmsg' + (msg.cold ? ' cold' : '') + '">' + esc(msg.text) + '</span></div></div>';
    ui.mapFlash = null;
  },
  end(root) {
    const t = ui.trip, S = C.text.s, won = t.over === 'won';
    let h = '<h2 style="color:' + (won ? C.colors.lit : C.colors.scarText) + '">' + esc(won ? S.endWon : S.endLost) + '</h2>';
    const res = t.results.map(r => {
      if (r.kind === 'site') {            // a scavenge site (M1 HUT stage / M2): name, LEFT | GUARDIAN, items gained
        const si = C.sites[r.siteId];
        return '<div class="resline"><span>' + esc(si ? si.name : r.siteId) + '</span>' + tileHTML('DIG', 'small').replace(/>DIG</, '>' + esc(r.result) + '<') +
          '<span class="lbl">' + S.turns.replace('{n}', r.turns) + (r.gained && r.gained.length ? ' · ' + r.gained.map(itemName).join(', ') : '') + '</span></div>';
      }
      const e = C.enemies[r.enemyId];
      return '<div class="resline"><span>' + esc(e.name) + '</span>' + tileHTML(r.result === C.text.beaten ? 'PRUNE' : 'SOW', 'small').replace(/>PRUNE<|>SOW</, '>' + esc(r.label || r.result) + '<') +
        '<span class="lbl">' + S.turns.replace('{n}', r.turns) + '</span></div>';
    });
    if (!won && ui.game && ui.game.enemy && ui.game.over === 'lost') res.push('<div class="resline"><span>' + esc(ui.game.enemy.name) + '</span><span style="color:' + C.colors.scarText + '">' +
      S.fled.replace('{n}', ui.game.turn) + '</span></div>');
    h += '<div class="row endcols" style="gap:40px;align-items:flex-start;flex-wrap:nowrap"><div class="endleft"><div class="sect">' + S.results + '</div><div class="reslist">' + res.join('') + '</div>' +
      (t.mode === 'm2' ? '<div class="sect" style="margin-top:12px;color:' + C.colors.map.sun + '">' + esc(MT().endDaylight.replace('{n}', t.daylight).replace('{max}', C.map.daylight)) + '</div>' +
        '<div class="lbl" style="letter-spacing:.1em">' + esc(MT().endMoves.replace('{n}', t.moves).replace('{c}', t.coldHits)) + '</div>' : '') +
      '<div class="sect" style="margin-top:12px">' + S.scarsFinal.replace('SCARS {n}/{max}', 'SCARS ' + scarSummary(tripFaces)) + '</div>' +
      (t.inventory.length ? '<div class="sect" style="margin-top:8px">' + S.leftover + '</div><div class="resline inv">' + t.inventory.map(id => itemTileHTML(id, 'small')).join('') + '</div>' : '') +
      '</div><div><div class="sect">' + S.finalDice + '</div>' + mindRowHTML() + '<div class="endnets">' +
      E.bodyDieIds().map(id => '<div><div class="nbl" style="font-size:14px">' + id + '</div>' + netHTML(id, { mini: true, mode: 'view' }) + oddsHTML(id) + '</div>').join('') +
      '</div></div></div>' +
      '<div class="sect" style="align-self:flex-start">' + S.logLabel + '</div><ol id="endLog">' + t.log.map(l => '<li>' + esc(l) + '</li>').join('') + '</ol>' +
      '<div class="row">' + btn(C.text.buttons.restart, 'restart') + '<button class="btn" data-act="modeSelect">' + esc(MT().changeMode) + '</button></div>';
    root.innerHTML = h;
  },
};
let screenKey = '';
function renderScreen() {
  const root = $('screen');
  const on = ui.screen !== 'encounter';
  root.classList.toggle('show', on);
  if (!on) { screenKey = ''; return; }
  hidePopover();
  SCREENS[ui.screen](root);
  const key = ui.screen + '|' + ui.placementMode + '|' + ui.healing;
  if (key !== screenKey) { screenKey = key; hooks.onScreen(ui.screen, root); }
  else root.querySelectorAll('.pop-in').forEach(n => n.classList.remove('pop-in'));   // entrance pop only when the screen changes
}
function onScreenClick(e) {
  if (ui.screen === 'placement' && !ui.place.pending) { if (onPlaceClick(e)) return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.classList.contains('off') || el.disabled) return;
  const a = el.dataset.act, t = ui.trip;
  if (a === 'pick') {
    if (ui.reward.picked) return;
    ui.reward.picked = el.dataset.item;
    renderAll();
    hooks.onPick(root$().querySelector('.rcard.picked'));
    const run = ++ui.runId;
    setTimeout(() => { if (ui.runId === run) claimAndPlace(ui.reward.picked); }, 520);
  } else if (a === 'take') claimAndPlace(null);
  else if (a === 'confirmReplace') confirmReplace();
  else if (a === 'cancelReplace') { ui.place.pending = null; renderAll(); }
  else if (a === 'done') closePlacement();
  else if (a === 'heal') { ui.healing = true; renderAll(); }
  else if (a === 'back') { ui.healing = false; renderAll(); }
  else if (a === 'healFace') healFace(el.dataset.die, Number(el.dataset.idx));
  else if (a === 'rearrange') openPlacement('campfire');
  else if (a === 'startM1') startTrip('m1');
  else if (a === 'startM2') startTrip('m2');
  else if (a === 'modeSelect') showStart();
  else if (a === 'move') onMapMove(Number(el.dataset.c), Number(el.dataset.r));
  else if (a === 'restart') onRestart();
}
const root$ = () => $('screen');
