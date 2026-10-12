// ENGINE: Item placement on dice (intro, reward, campfire), odds summary.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- placement ----------
// modes: 'reward' (existing placements locked; items placed during this screen stay movable) | 'campfire' (free)
//        | 'intro' (trip start: same rules as campfire; dice are bare, the starting inventory is placed here)
const faceKey = (dieId, idx) => dieId + ':' + idx;
function beginPlacement(trip, mode) { trip.placement = { mode: mode || 'reward', fresh: [] }; return trip.placement; }
function endPlacement(trip) { const p = trip.placement; trip.placement = null; return p; }
const modeOf = (trip, mode) => mode || (trip.placement && trip.placement.mode) || 'reward';
function ensurePlacement(trip, mode) {
  if (!trip.placement || trip.placement.mode !== mode) beginPlacement(trip, mode);
  return trip.placement;
}
const dieOf = (trip, dieId) => trip.dice.find(d => d.id === dieId);
// Can `itemId` sit on that face? -> { ok, reason?, replaces: itemId|null }   (does not check the inventory)
function canPlace(trip, itemId, dieId, faceIdx, mode) {
  const def = CONFIG.items[itemId];
  if (!def) return { ok: false, reason: 'unknown-item', replaces: null };
  const die = dieOf(trip, dieId);
  if (!die || isMind(die)) return { ok: false, reason: 'not-an-item-die', replaces: null };
  if (!(faceIdx >= 0 && faceIdx < die.faces.length)) return { ok: false, reason: 'no-face', replaces: null };
  const p = parseFace(die.faces[faceIdx]);
  if (p.kind === 'scar') return { ok: false, reason: 'scar', replaces: null };
  if (p.body !== def.part) return { ok: false, reason: 'wrong-part', replaces: null };
  return { ok: true, reason: null, replaces: p.item };
}
function isLocked(trip, dieId, faceIdx, mode) {
  mode = modeOf(trip, mode);
  const die = dieOf(trip, dieId);
  if (!die || !parseFace(die.faces[faceIdx]).item) return false;
  if (mode === 'campfire' || mode === 'intro') return false;       // free modes
  return !(trip.placement && trip.placement.fresh.indexOf(faceKey(dieId, faceIdx)) >= 0);
}
// Place an inventory item on a face (replacing + discarding any item already there). -> { ok, replaced, reason? }
function placeItem(trip, itemId, dieId, faceIdx, mode) {
  mode = modeOf(trip, mode);
  const at = trip.inventory.indexOf(itemId);
  if (at < 0) return { ok: false, replaced: null, reason: 'not-in-inventory' };
  const chk = canPlace(trip, itemId, dieId, faceIdx, mode);
  if (!chk.ok) return { ok: false, replaced: null, reason: chk.reason };
  const pl = ensurePlacement(trip, mode);
  const die = dieOf(trip, dieId);
  ensureUses(trip);
  const u = trip.invUses[at];
  trip.inventory.splice(at, 1);
  if (at < trip.invUses.length) trip.invUses.splice(at, 1);
  if (chk.replaces) trip.discarded.push(chk.replaces);
  die.faces[faceIdx] = parseFace(die.faces[faceIdx]).body + '+' + itemId;
  if (u !== undefined && u !== null) trip.faceUses[faceKey(dieId, faceIdx)] = u; else delete trip.faceUses[faceKey(dieId, faceIdx)];
  if (pl.fresh.indexOf(faceKey(dieId, faceIdx)) < 0) pl.fresh.push(faceKey(dieId, faceIdx));
  return { ok: true, replaced: chk.replaces, reason: null };
}
// Move a placed item to another face (occupied target: replaced + discarded). reward mode: only items placed this screen.
function moveItem(trip, fromDie, fromIdx, toDie, toIdx, mode) {
  mode = modeOf(trip, mode);
  const src = dieOf(trip, fromDie);
  const sp = src && parseFace(src.faces[fromIdx]);
  if (!sp || !sp.item) return { ok: false, replaced: null, reason: 'no-item' };
  if (isLocked(trip, fromDie, fromIdx, mode)) return { ok: false, replaced: null, reason: 'locked' };
  if (fromDie === toDie && fromIdx === toIdx) return { ok: true, replaced: null, reason: null };
  const chk = canPlace(trip, sp.item, toDie, toIdx, mode);
  if (!chk.ok) return { ok: false, replaced: null, reason: chk.reason };
  const pl = ensurePlacement(trip, mode);
  const dst = dieOf(trip, toDie);
  ensureUses(trip);
  if (chk.replaces) trip.discarded.push(chk.replaces);
  const u = takeUses(trip, fromDie, fromIdx);
  src.faces[fromIdx] = sp.body;
  dst.faces[toIdx] = parseFace(dst.faces[toIdx]).body + '+' + sp.item;
  if (u !== undefined) trip.faceUses[faceKey(toDie, toIdx)] = u; else delete trip.faceUses[faceKey(toDie, toIdx)];
  const fi = pl.fresh.indexOf(faceKey(fromDie, fromIdx));
  if (fi >= 0) pl.fresh.splice(fi, 1);
  if (pl.fresh.indexOf(faceKey(toDie, toIdx)) < 0) pl.fresh.push(faceKey(toDie, toIdx));
  return { ok: true, replaced: chk.replaces, reason: null };
}
// Take a placed item off its face and back to the inventory. reward mode: only items placed this screen.
function unplaceItem(trip, dieId, faceIdx, mode) {
  mode = modeOf(trip, mode);
  const die = dieOf(trip, dieId);
  const p = die && parseFace(die.faces[faceIdx]);
  if (!p || !p.item) return { ok: false, item: null, reason: 'no-item' };
  if (isLocked(trip, dieId, faceIdx, mode)) return { ok: false, item: null, reason: 'locked' };
  ensureUses(trip);
  const u = takeUses(trip, dieId, faceIdx);
  die.faces[faceIdx] = p.body;
  trip.inventory.push(p.item);
  if (u !== undefined) trip.invUses[trip.inventory.length - 1] = u; else delete trip.invUses[trip.inventory.length - 1];
  const pl = trip.placement;
  if (pl) { const fi = pl.fresh.indexOf(faceKey(dieId, faceIdx)); if (fi >= 0) pl.fresh.splice(fi, 1); }
  return { ok: true, item: p.item, reason: null };
}
// Campfire: a SCAR face returns as the bare body part it started as (its item is not restored).
function healScar(trip, dieId, faceIdx) {
  const die = dieOf(trip, dieId);
  if (!die || die.faces[faceIdx] !== SCAR) return { ok: false, restored: null, reason: 'not-a-scar' };
  const orig = CONFIG.playerDice.find(d => d.id === dieId).faces[faceIdx];
  const part = parseFace(orig).body;
  die.faces[faceIdx] = part;
  const line = 'campfire: healed ' + dieId + ' face ' + (faceIdx + 1) + ' → ' + part;
  trip.log.push(line);
  return { ok: true, restored: part, reason: null };
}

// Odds summary for a die ({id, faces}). -> { text, parts:{PART:{count,items:{ID:n}}}, bare, scar, itemFaces, total }
function oddsSummary(die) {
  const orig = CONFIG.playerDice.find(d => d.id === die.id);   // (MIND dice have no parts: text is meaningless for them)
  const total = die.faces.length;
  const parts = {}, partOrder = [];
  let scar = 0, bare = 0, itemFaces = 0;
  die.faces.forEach((f, i) => {
    const p = parseFace(f);
    if (p.kind === 'scar') { scar++; return; }
    const part = p.body;
    if (!parts[part]) { parts[part] = { count: 0, items: {} }; partOrder.push(part); }
    parts[part].count++;
    if (p.item) { parts[part].items[p.item] = (parts[part].items[p.item] || 0) + 1; itemFaces++; } else bare++;
  });
  // part order and the set of parts follow the die's original layout
  const origParts = [];
  (orig ? orig.faces : []).forEach(f => { const b = parseFace(f).body; if (b && origParts.indexOf(b) < 0) origParts.push(b); });
  const names = origParts.length ? origParts : partOrder;
  names.forEach(n => { if (!parts[n]) parts[n] = { count: 0, items: {} }; });
  const itemStr = (items) => Object.keys(items).map(id => items[id] + '× ' + CONFIG.items[id].name);
  let text;
  if (names.length <= 1) {
    const n = names[0] || '';
    const items = parts[n] ? itemStr(parts[n].items) : [];
    text = fmt(CONFIG.odds.single, { part: n, items: items.length ? items.join(' · ') + ' · ' : '', bare, scar, k: itemFaces, n: total });
  } else {
    const pieces = names.map(n => {
      const items = itemStr(parts[n].items);
      return fmt(CONFIG.odds.partPiece, { part: n, count: parts[n].count, items: items.length ? items.join(' · ') : CONFIG.odds.noItems });
    });
    text = fmt(CONFIG.odds.multiPart, { parts: pieces.join(' · '), scar, n: total });
  }
  return { text, parts, bare, scar, itemFaces, total };
}
