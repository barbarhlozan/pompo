// UI: Debug-facing trip controls (SmugUI.jumpTo etc.).
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- debug-facing trip controls (the DEBUG drawer calls these through SmugUI) ----------
// Any enemy id or the campfire. An id missing from the random sequence replaces the current fight (or the next one).
function jumpTo(stageId) {
  const t = ui.trip;
  if (t.mode === 'm2') {                  // M2: any enemy, site, the campfire, or back to the map
    const mapId = C.trip.mapStage;
    if (stageId !== mapId && !C.enemies[stageId] && !C.sites[stageId] && !E.isCampfire(stageId)) return false;
    if (t.stage === mapId && t.map && !ui.jumpRestore) {
      const p = t.map.pos, tl = t.map.tiles[p.r][p.c];
      ui.jumpRestore = { c: p.c, r: p.r, fields: { type: tl.type, enemyId: tl.enemyId, siteId: tl.siteId } };
    }
    t.over = null; t.result = null; t.encounter = null; t.placement = null; t.site = null;
    if (stageId === mapId) { t.stage = mapId; ui.jumpRestore = null; }
    else if (C.sites[stageId]) { E.startSite(t, stageId, Math.random, null); }
    else t.stage = stageId;
    hooks.onRestart();
    enterStage();
    return true;
  }
  let i = t.sequence.indexOf(stageId);
  if (i < 0) {
    if (!C.enemies[stageId] && !C.sites[stageId] && !E.isCampfire(stageId)) return false;
    i = Math.min(t.stageIdx, t.sequence.length - 1);
    while (i < t.sequence.length - 1 && E.isCampfire(t.sequence[i])) i++;
    if (E.isCampfire(t.sequence[i])) return false;
    t.sequence[i] = stageId;
  }
  t.over = null; t.result = null; t.stageIdx = i; t.stage = stageId; t.encounter = null; t.placement = null; t.site = null;
  hooks.onRestart();
  enterStage();
  return true;
}
function giveItem(id) {
  if (!C.items[id]) return false;
  E.addToInventory(ui.trip, id);
  renderAll();
  return true;
}
// Marks every hostile face resolved (BEATEN = broken, BEFRIENDED = turned) and ends the encounter as the engine would.
function forceWin(result) {
  if (ui.screen !== 'encounter' || !ui.game || ui.game.over || isSite()) return false;
  const g = ui.game, to = result === C.text.beaten ? 'broken' : 'turned';
  g.enemy.faces.forEach(f => { if (f.hostile) f.pips = f.pips.map(() => to); });
  g.over = 'won'; g.result = result; g.resultLabel = E.labelFor(g.enemy, result);
  ui.trip.results.push({ enemyId: g.enemyId, result, label: g.resultLabel, turns: g.turn });
  ui.runId++;
  syncView(); ui.phase = 'won'; ui.enemyText = result;
  renderAll();
  return true;
}
// Scars random bare / item faces on the scar-target dice until the trip has n scars (items on them are destroyed).
function addScars(n) {
  const t = ui.trip;
  const faces = [];
  E.scarTargetIds().forEach(id => t.dice.find(d => d.id === id).faces.forEach((f, i) => { if (f !== C.text.scar) faces.push({ id, i }); }));
  while (E.tripScars(t) < n && faces.length) {
    const k = Math.floor(Math.random() * faces.length), f = faces.splice(k, 1)[0];
    t.dice.find(d => d.id === f.id).faces[f.i] = C.text.scar;
  }
  if (ui.screen === 'encounter') syncView();
  renderAll();
}
// total scars -> n (adds random scars, or heals scars back to bare parts)
function setScars(n) {
  const t = ui.trip;
  n = Math.max(0, Math.min(C.maxScars - 1, n));
  if (n > E.tripScars(t)) { addScars(n); return; }
  t.dice.forEach(d => {
    const orig = C.playerDice.find(x => x.id === d.id);
    d.faces.forEach((f, i) => { if (f === C.text.scar && E.tripScars(t) > n) d.faces[i] = orig.faces[i].split('+')[0]; });
  });
  if (ui.screen === 'encounter' && ui.game) syncView();
  renderAll();
}
function setDaylight(n) {
  const t = ui.trip;
  if (t.mode !== 'm2') return false;
  t.daylight = Math.max(0, Math.min(C.map.daylight, n));
  renderAll();
  return true;
}
function setNoise(n) {
  if (!isSite()) return false;
  ui.game.noise = Math.max(0, Math.min(ui.game.noiseMax, n));
  syncView(); renderAll();
  return true;
}
function setShowMap(on) { ui.showMap = !!on; if (ui.screen === 'map') renderAll(); }
function setShowSite(on) { ui.showSite = !!on; if (isSite() && ui.screen === 'encounter') { syncView(); renderAll(); } }
function forceLose() {
  addScars(C.maxScars);
  const t = ui.trip, g = ui.game;
  t.over = 'lost'; t.result = C.text.lost;
  ui.runId++;
  if (ui.screen === 'encounter' && g && !g.over) { g.over = 'lost'; g.result = C.text.lost; syncView(); ui.phase = 'lost'; renderAll(); }
  else showEnd();
}
