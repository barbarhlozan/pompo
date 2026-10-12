// ENGINE: Player dice (roll, hold, reroll), scars, item charges.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- player ----------
// die: { id, kind:'mind'|'body', label, faces: [...6 strings], idx: current face index, held }
function makeDice() {
  return CONFIG.playerDice.map(d => ({ id: d.id, kind: d.kind === 'mind' ? 'mind' : 'body', label: d.label || d.id, faces: d.faces.slice(), idx: 0, held: false }));
}
function createPlayer() { return { dice: makeDice() }; }
function currentFace(die) { return die.faces[die.idx]; }
function rollDie(die, rng) { die.idx = randInt(rng, die.faces.length); return die.idx; }
function toggleHold(die) { if (die.frozen) return die.held; die.held = !die.held; return die.held; }   // a frozen die can't be held
// Rerolls every un-held die and spends one reroll. Returns rerolled die ids, or null if none left.
function rerollUnheld(state, rng) {
  if (state.rerolls <= 0) return null;
  state.rerolls -= 1;
  const ids = [];
  state.player.dice.forEach(d => { if (!d.held && !d.frozen) { rollDie(d, rng); ids.push(d.id); } });
  return ids;
}
function countScars(player) {
  let n = 0;
  player.dice.forEach(d => d.faces.forEach(f => { if (f === SCAR) n++; }));
  return n;
}
// First die (any kind, MIND included) whose every face is a SCAR, or null.
function failedDie(player) {
  const d = player.dice.find(x => x.faces.length > 0 && x.faces.every(f => f === SCAR));
  return d ? d.id : null;
}
// Remaining charges of the item on that face (null: no item or the item has no `uses`).
const usesDefOf = (item) => { const d = itemDef(item); return d && d.uses != null ? d.uses : null; };
function usesLeft(trip, dieId, idx) {
  const die = trip.dice.find(d => d.id === dieId);
  const p = die && parseFace(die.faces[idx]);
  if (!p || !p.item) return null;
  const def = usesDefOf(p.item);
  if (def === null) return null;
  const v = trip.faceUses && trip.faceUses[faceKey(dieId, idx)];
  return v !== undefined ? v : def;
}
// Remaining charges of inventory entry i (null: the item has no `uses`).
function inventoryUses(trip, i) {
  const def = usesDefOf(trip.inventory[i]);
  if (def === null) return null;
  const v = trip.invUses && trip.invUses[i];
  return v !== undefined && v !== null ? v : def;
}
