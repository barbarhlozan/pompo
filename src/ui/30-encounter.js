// UI: Encounter input: slots, drag, roll, reroll, commit.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- player actions ----------
function placeDie(id, slotIdx) {
  if (!canInteract()) return;
  if (slotIdx >= slotCount()) return;
  const cur = slotOf(id), occ = ui.slots[slotIdx];
  if (cur === slotIdx) return;
  if (cur >= 0) ui.slots[cur] = occ;      // swap (occ may be null)
  ui.slots[slotIdx] = id;                 // an evicted occupant simply returns to its tray cell
  renderAll();
}
function unplaceDie(id) {
  if (!canInteract()) return;
  const i = slotOf(id);
  if (i >= 0) { ui.slots[i] = null; renderAll(); }
}
function onUp(id) { if (slotOf(id) < 0) { const i = ui.slots.slice(0, slotCount()).indexOf(null); if (i >= 0) withFlip(id, () => placeDie(id, i)); } }
function onDown(id) { withFlip(id, () => unplaceDie(id)); }
function toggleHoldDie(id) {
  if (!canInteract()) return;
  if (dieById(id).frozen) { hooks.onFrozenClick(id); return; }
  E.toggleHold(dieById(id));
  renderAll();
  hooks.onHold(id);
  if (ui.hover === id) showPopover(id);
}
// Run a placement change and let FX animate every die that moved (FLIP).
function withFlip(id, fn) { const snap = hooks.snapshot(); fn(); hooks.play(snap, id); }
function onKey(e) {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (/^[1-9]$/.test(e.key) && Number(e.key) <= slotCount() && ui.hover && canInteract()) {
    withFlip(ui.hover, () => placeDie(ui.hover, Number(e.key) - 1));
    if (ui.hover) showPopover(ui.hover);
  }
}

// Pointer Events drag & drop. < 5px of movement = click = toggle hold.
function onPointerDown(e, id) {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('button')) return;
  if (ui.holdPick && ui.phase === 'await-roll') { pickHold(id); return; }
  if (!canInteract()) return;
  const el = dom.dieEls[id];
  const r = el.getBoundingClientRect();
  ui.drag = { id, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top,
    w: r.width, h: r.height, active: false };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
}
function dropTarget(x, y) {
  let best = -1, bd = Infinity;                       // chevrons overlap a little: nearest centre wins
  for (let i = 0; i < slotCount(); i++) {
    const r = dom.slotEls[i].getBoundingClientRect();
    const m = C.ui.dropSlackPx;
    if (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m) {
      const d = Math.abs(x - (r.left + r.right) / 2);
      if (d < bd) { bd = d; best = i; }
    }
  }
  if (best >= 0) return { kind: 'slot', i: best };
  const tr = $('bottom').getBoundingClientRect();
  if (y >= tr.top - C.ui.dropSlackPx) return { kind: 'tray' };
  return null;
}
function onPointerMove(e) {
  const d = ui.drag; if (!d || e.pointerId !== d.pointerId) return;
  const el = dom.dieEls[d.id];
  if (!d.active) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < C.ui.dragThresholdPx) return;
    d.active = true;
    hidePopover();
    el.style.width = d.w + 'px'; el.style.height = d.h + 'px';
    el.classList.add('dragging');
    hooks.onDragStart(el, d);
  }
  el.style.left = (e.clientX - d.ox) + 'px';
  el.style.top = (e.clientY - d.oy) + 'px';
  hooks.onDragMove(el, e, d);
  const t = dropTarget(e.clientX, e.clientY);
  dom.slotEls.forEach((s, i) => s.classList.toggle('over', !!t && t.kind === 'slot' && t.i === i));
  $('tray').classList.toggle('over', !!t && t.kind === 'tray' && slotOf(d.id) >= 0);
}
function endDrag(e, cancelled) {
  const d = ui.drag; if (!d || e.pointerId !== d.pointerId) return;
  const el = dom.dieEls[d.id];
  const snap = d.active ? hooks.snapshot() : null;            // positions while still lifted (for the drop animation)
  el.removeEventListener('pointermove', onPointerMove);
  el.removeEventListener('pointerup', onPointerUp);
  el.removeEventListener('pointercancel', onPointerCancel);
  try { el.releasePointerCapture(d.pointerId); } catch (_) {}
  ui.drag = null;
  const wasActive = d.active;
  el.classList.remove('dragging');
  el.style.width = el.style.height = el.style.left = el.style.top = el.style.rotate = '';
  hooks.onDragEnd(el, d);
  dom.slotEls.forEach(s => s.classList.remove('over'));
  $('tray').classList.remove('over');
  if (cancelled) { renderAll(); return; }
  if (!wasActive) { toggleHoldDie(d.id); return; }          // click
  const t = dropTarget(e.clientX, e.clientY);
  if (t && t.kind === 'slot') placeDie(d.id, t.i);
  else if (t && t.kind === 'tray') unplaceDie(d.id);
  // else: invalid drop -> element returns to its container; FX animates it back (hooks.play)
  renderAll();
  if (snap) hooks.play(snap, d.id, true);
  if (ui.hover === d.id) showPopover(d.id);
}
function onPointerUp(e) { endDrag(e, false); }
function onPointerCancel(e) { endDrag(e, true); }

async function onRoll() {
  if (ui.phase !== 'await-roll') return;
  const g = ui.game;
  syncView();                                     // pre-turn picture: a pending watering-can SOW plays from here
  const st = E.startTurn(g, Math.random);
  ui.slots = emptySlots();
  ui.previewOverride = null; ui.enemyText = ''; ui.verbFlash = ''; ui.actingSlot = null; ui.railPlay = null;
  newTilts(g.player.dice.map(d => d.id));
  if (st.events.length) {
    const run = ++ui.runId;
    ui.phase = 'start';
    hidePopover();
    renderAll();
    await playEvents(st.events, run);
    if (ui.runId !== run) return;
    ui.verbFlash = ''; ui.enemyText = '';
  }
  syncView();
  if (st.over) { ui.phase = st.over; renderAll(); return; }   // the pending SOW finished the fight
  ui.phase = 'arranging';
  hooks.onRoll(g.player.dice.map(d => d.id));
  renderAll();
}
function newTilts(ids) { ids.forEach(id => { ui.tilt[id] = Math.round((Math.random() * 2 - 1) * C.ui.trayTiltDeg * 10) / 10; }); }
function onReroll() {
  if (!canInteract()) return;
  const ids = E.rerollUnheld(ui.game, Math.random);
  if (!ids) return;
  newTilts(ids);
  syncView();
  hooks.onRoll(ids);
  renderAll();
  if (ui.hover) showPopover(ui.hover);
}
// A brand-new trip (mode 'm1' = random fight sequence, 'm2' = map). Every trip starts on the intro placement screen:
// bare dice, the starting inventory (CONFIG.startingInventory) is packed onto them there.
async function onCommit() {
  if (ui.phase !== 'arranging' || placedCount() < slotCount()) return;
  const run = ++ui.runId;
  ui.phase = 'resolving';
  hidePopover();
  syncView();                                                         // capture the pre-turn picture
  const site = isSite();
  const out = site ? E.resolveSiteTurn(ui.game, ui.slots.slice(0, slotCount()), Math.random) : E.resolveTurn(ui.game, ui.slots.slice(0, slotCount()), Math.random);   // engine state is final now; `view` lags
  if (site && !out.ok) { ui.phase = 'arranging'; renderAll(); return; }
  const se = out.events.find(e => e.type === 'sentence');            // the rail shows this sentence from the first frame
  ui.railPlay = { idx: -1, totals: false };
  if (se) ui.previewOverride = { shape: se.evaluation.shape, triggers: se.evaluation.triggers, ev: se.evaluation, text: se.preview ? se.preview.text : '' };
  renderAll();
  await playEvents(out.events, run);
  if (ui.runId !== run) return;                                       // restarted meanwhile
  ui.railPlay = null;
  ui.actingSlot = null; ui.verbFlash = '';
  syncView();
  if (site) {                                                         // site turn: lost | guardian arrives | keep searching
    ui.enemyText = '';
    ui.phase = ui.trip.over === 'lost' ? 'lost' : (out.guardian ? 'guardian' : 'await-roll');
    renderAll();
    return;
  }
  ui.phase = ui.game.over || 'await-roll';
  ui.holdPick = !!out.holdPending && !ui.game.over;
  renderAll();
}
// mindAloneHolds: the player clicks one body die to keep its face for the next turn
function pickHold(id) {
  if (!ui.holdPick || ui.phase !== 'await-roll') return false;
  const r = E.holdOver(ui.game, id);
  if (!r.ok) return false;
  ui.holdPick = false;
  renderAll();
  hooks.onHold(id);
  return true;
}
