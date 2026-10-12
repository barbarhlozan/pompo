// UI: Map move.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// One step on the M2 map. The engine resolves the whole move at once (daylight, cold scar, entering the tile);
// the UI shows the end state and FX animates the marker / sun / cold, then the tile's screen opens.
async function onMapMove(c, r) {
  if (ui.screen !== 'map' || ui.mapBusy) return;
  const t = ui.trip;
  const you = document.querySelector('#screen .mt.here .you');
  const prevRect = you ? you.getBoundingClientRect() : null;
  const out = E.moveTo(t, c, r, Math.random);
  if (!out.ok) return;
  ui.mapBusy = true;
  const run = ++ui.runId;
  const mv = out.events.find(e => e.type === 'move');
  const scar = out.events.find(e => e.type === 'scar'), des = out.events.find(e => e.type === 'itemDestroyed');
  const M = MT();
  ui.mapMsg = mv.cold ? { text: M.coldMsg + (des ? ' ' + M.coldDestroyed.replace('{item}', itemName(des.item)) : ''), cold: true } : null;
  renderAll();
  hooks.onMapMove({ prevRect, move: mv, cold: mv.cold, scar, destroyed: des, entered: out.entered, won: out.over === 'won', lost: out.over === 'lost', to: { c, r } });
  await sleep(mv.cold ? 700 : 0);
  if (ui.runId !== run) return;
  if (t.over) { ui.mapBusy = false; showEnd(); return; }
  if (out.entered && ['CHARACTER', 'SCAVENGE', 'CAMPFIRE'].indexOf(out.entered.tile) >= 0) { ui.mapMsg = null; enterStage(); return; }
  ui.mapBusy = false;
}
