// UI: Placement interaction (drag / click items onto faces).
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- placement interaction (drag with Pointer Events, or click an item then a face) ----------
const placeRoot = () => $('screen');
const faceEl = (dieId, idx) => placeRoot().querySelector('.nf[data-die="' + dieId + '"][data-idx="' + idx + '"]');
// src = { kind:'inv', item } | { kind:'face', item, die, idx }.  -> 'placed' | 'pending' | 'noop' | reason string
function tryPlace(src, dieId, idx) {
  const t = ui.trip, mode = ui.placementMode;
  if (src.kind === 'face' && src.die === dieId && src.idx === idx) return 'noop';
  const chk = E.canPlace(t, src.item, dieId, idx, mode);
  if (!chk.ok) return chk.reason;
  if (chk.replaces) { ui.place.pending = { src, dieId, idx, replaces: chk.replaces }; ui.place.sel = null; renderAll(); return 'pending'; }
  return commitPlace(src, dieId, idx);
}
function commitPlace(src, dieId, idx) {
  const t = ui.trip, mode = ui.placementMode;
  const r = src.kind === 'inv' ? E.placeItem(t, src.item, dieId, idx, mode) : E.moveItem(t, src.die, src.idx, dieId, idx, mode);
  ui.place.sel = null; ui.place.pending = null;
  renderAll();
  if (!r.ok) return r.reason || 'fail';
  hooks.onPlace(dieId, idx, src.item, r.replaced);
  return 'placed';
}
function confirmReplace() {
  const pd = ui.place.pending; if (!pd) return;
  commitPlace(pd.src, pd.dieId, pd.idx);
}
function unplaceFrom(src) {
  const r = E.unplaceItem(ui.trip, src.die, src.idx, ui.placementMode);
  ui.place.sel = null;
  renderAll();
  if (r.ok) hooks.onUnplace(src.item);
  return r.ok;
}
function srcOf(el) {
  if (el.dataset.drag === 'inv') return { kind: 'inv', item: el.dataset.item, k: Number(el.dataset.k) };
  const nf = el.closest('.nf');
  return { kind: 'face', item: el.dataset.item, die: nf.dataset.die, idx: Number(nf.dataset.idx) };
}
// click (no drag): select an item, or drop the selected one on a face / the tray
function onPlaceClick(e) {
  const pl = ui.place;
  if (pl.suppress) return true;
  if (e.target.closest('[data-act]')) return false;
  const drag = e.target.closest('[data-drag]');
  if (drag) {
    const s = srcOf(drag), cur = pl.sel;
    pl.sel = cur && cur.kind === s.kind && cur.item === s.item && (s.kind === 'inv' ? cur.k === s.k : cur.die === s.die && cur.idx === s.idx) ? null : s;
    renderAll();
    return true;
  }
  const lockedIt = e.target.closest('.it.locked');
  if (lockedIt) { hooks.onReject(lockedIt.closest('.nf')); return true; }
  const nf = e.target.closest('.nf');
  if (nf && pl.sel) {
    const r = tryPlace(pl.sel, nf.dataset.die, Number(nf.dataset.idx));
    if (r !== 'placed' && r !== 'pending' && r !== 'noop') hooks.onReject(faceEl(nf.dataset.die, nf.dataset.idx));
    return true;
  }
  if (e.target.closest('#invTray') && pl.sel && pl.sel.kind === 'face') { unplaceFrom(pl.sel); return true; }
  if (pl.sel) { pl.sel = null; renderAll(); return true; }
  return false;
}
function hypOdds(src, tgt) {      // odds text per item die as if src had been dropped on tgt (tgt null = reality)
  const out = {};
  E.bodyDieIds().forEach(id => {
    const die = ui.trip.dice.find(d => d.id === id), faces = die.faces.slice();
    if (tgt) {
      if (src.kind === 'face' && src.die === id) faces[src.idx] = E.parseFace(faces[src.idx]).body;
      if (tgt.die === id) faces[tgt.idx] = E.parseFace(faces[tgt.idx]).body + '+' + src.item;
    }
    out[id] = E.oddsSummary({ id, faces }).text;
  });
  return out;
}
function setOdds(src, tgt) {
  const o = hypOdds(src, tgt);
  placeRoot().querySelectorAll('[data-odds]').forEach(el => {
    el.textContent = o[el.dataset.odds];
    el.classList.toggle('hyp', !!tgt);
  });
}
function onPlacePointerDown(e) {
  if (ui.screen !== 'placement' || ui.place.pending || ui.place.drag) return;
  if (e.button !== undefined && e.button !== 0) return;
  const el = e.target.closest('[data-drag]');
  if (!el) return;
  ui.place.drag = { el, src: srcOf(el), pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, active: false, ghost: null, over: null, tgt: null };
  window.addEventListener('pointermove', onPlaceMove);
  window.addEventListener('pointerup', onPlaceUp);
  window.addEventListener('pointercancel', onPlaceUp);
}
function onPlaceMove(e) {
  const d = ui.place.drag; if (!d || e.pointerId !== d.pointerId) return;
  const t = ui.trip, mode = ui.placementMode;
  if (!d.active) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < C.ui.dragThresholdPx) return;
    d.active = true;
    hidePopover();
    ui.place.sel = null;
    const r = (d.el.querySelector('.tile') || d.el).getBoundingClientRect();
    d.from = { x: r.left, y: r.top };
    d.ox = d.sx - r.left; d.oy = d.sy - r.top;
    const g = document.createElement('div');
    g.className = 'dragghost'; g.innerHTML = itemTileHTML(d.src.item);
    $('stage').appendChild(g); d.ghost = g;
    d.el.classList.add('dragsrc');
    document.body.classList.add('dragging-item');
    placeRoot().querySelectorAll('.nf').forEach(nf => {
      if (nf.classList.contains('scar')) { nf.classList.add('invalid'); return; }
      const c = E.canPlace(t, d.src.item, nf.dataset.die, Number(nf.dataset.idx), mode);
      nf.classList.add(c.ok ? 'valid' : 'invalid');
    });
    if (d.src.kind === 'face') $('invTray').classList.add('ok');
    hooks.onDragItem(g);
  }
  d.ghost.style.transform = 'translate(' + (e.clientX - d.ox) + 'px,' + (e.clientY - d.oy) + 'px) rotate(' + Math.max(-10, Math.min(10, (e.clientX - d.sx) / 12)) + 'deg)';
  // what is under the pointer?
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const nf = under && under.closest('.nf');
  const tray = under && under.closest('#invTray');
  const key = nf ? nf.dataset.die + ':' + nf.dataset.idx : (tray ? 'tray' : '');
  if (key !== d.over) {
    d.over = key;
    placeRoot().querySelectorAll('.nf.over').forEach(n => n.classList.remove('over'));
    $('invTray').classList.toggle('over', !!tray && d.src.kind === 'face');
    d.tgt = null;
    if (nf) {
      nf.classList.add('over');
      if (nf.classList.contains('valid') && !(d.src.kind === 'face' && d.src.die === nf.dataset.die && d.src.idx === Number(nf.dataset.idx)))
        d.tgt = { die: nf.dataset.die, idx: Number(nf.dataset.idx) };
      else if (nf.classList.contains('invalid')) hooks.onReject(nf);
    }
    if (d.tgt) setOdds(d.src, d.tgt);
    else if (tray && d.src.kind === 'face') {
      const o = {}; E.bodyDieIds().forEach(id => {
        const faces = t.dice.find(x => x.id === id).faces.slice();
        if (d.src.die === id) faces[d.src.idx] = E.parseFace(faces[d.src.idx]).body;
        o[id] = E.oddsSummary({ id, faces }).text;
      });
      placeRoot().querySelectorAll('[data-odds]').forEach(el => { el.textContent = o[el.dataset.odds]; el.classList.add('hyp'); });
    } else setOdds(d.src, null);
  }
}
function onPlaceUp(e) {
  const d = ui.place.drag; if (!d || e.pointerId !== d.pointerId) return;
  window.removeEventListener('pointermove', onPlaceMove);
  window.removeEventListener('pointerup', onPlaceUp);
  window.removeEventListener('pointercancel', onPlaceUp);
  ui.place.drag = null;
  if (!d.active) return;                    // a click: onPlaceClick handles it
  ui.place.suppress = true; setTimeout(() => { ui.place.suppress = false; }, 0);
  document.body.classList.remove('dragging-item');
  const root = placeRoot();
  const nfOver = root.querySelector('.nf.over');
  const overTray = root.querySelector('#invTray.over');
  const cancelled = e.type === 'pointercancel';
  root.querySelectorAll('.nf').forEach(n => n.classList.remove('valid', 'invalid', 'over'));
  $('invTray').classList.remove('ok', 'over');
  const back = (reject) => {                // animate the ghost home, then clean up
    hooks.onItemReturn(d.ghost, d.from, () => { d.el.classList.remove('dragsrc'); });
    if (reject && nfOver) hooks.onReject(nfOver);
    setOdds(d.src, null);
  };
  if (cancelled) { back(false); return; }
  if (d.tgt && nfOver) {
    const ghost = d.ghost;
    const r = tryPlace(d.src, d.tgt.die, d.tgt.idx);
    if (ghost && ghost.parentNode) ghost.remove();
    if (r === 'placed' || r === 'pending') return;
    d.el.classList.remove('dragsrc'); setOdds(d.src, null);
    return;
  }
  if (overTray && d.src.kind === 'face') {
    if (d.ghost && d.ghost.parentNode) d.ghost.remove();
    if (unplaceFrom(d.src)) return;
    return;
  }
  const own = d.src.kind === 'face' && nfOver && nfOver.dataset.die === d.src.die && Number(nfOver.dataset.idx) === d.src.idx;
  back(!!nfOver && !d.tgt && !own);
}
// hover a net face -> its 3 verb names with points (and the item special)
function showFaceTip(nf) {
  const t = ui.trip, die = t.dice.find(d => d.id === nf.dataset.die), S = C.text.s;
  const idx = Number(nf.dataset.idx), f = die.faces[idx], p = E.parseFace(f);
  let h = '<div class="ttl">' + die.id + ' · ' + S.faceN.replace('{n}', idx + 1) + '</div><div class="ftip">';
  if (p.kind === 'scar') h += '<div>' + esc(S.scarTip) + '</div>';
  else {
    C.verbs.forEach(v => {
      const nm = p.item ? C.items[p.item].names[v] : C.actionNames[p.body][v];
      h += '<div class="vr"><b style="color:' + C.colors.verb[v] + '">' + v + '</b><span class="nm">' + esc(nm) + '</span><em>' + E.scoreBodyFace(f, v) + '</em></div>';
    });
    h += '<div class="vr" style="color:var(--dim)">' + esc(p.body) + ' · ' + (C.favouriteVerb[p.body] ? 'favourite ' + C.favouriteVerb[p.body] : '') + (p.item ? ' · ' + esc(itemName(p.item)) : '') + '</div>';
    if (p.item) h += '<div class="sp">' + esc(C.items[p.item].info) + '</div>';
  }
  const pop = $('pop');
  pop.innerHTML = h + '</div>';
  pop.style.display = 'block';
  const sr = $('stage').getBoundingClientRect(), r = nf.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.left - sr.left + r.width / 2 - pw / 2;
  x = Math.max(8, Math.min(sr.width - pw - 8, x));
  let y = r.top - sr.top - ph - 6;
  if (y < 48) y = r.bottom - sr.top + 6;
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function onScreenOver(e) {
  if (ui.place.drag && ui.place.drag.active) return;
  const nf = e.target.closest && e.target.closest('.nf');
  if (nf && (ui.screen === 'placement' || ui.screen === 'campfire' || ui.screen === 'end') && !ui.place.pending) showFaceTip(nf);
}
function onScreenOut(e) {
  const to = e.relatedTarget;
  if (to && to.closest && to.closest('.nf') === (e.target.closest && e.target.closest('.nf'))) return;
  if (e.target.closest && e.target.closest('.nf')) hidePopover();
}
