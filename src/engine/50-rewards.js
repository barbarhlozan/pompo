// ENGINE: Rewards & inventory, trip stage advance.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- rewards & inventory ----------
// -> { choose: [ids]|null, give: [ids], returned: [ids], revealTiles: n, ending: 'beaten'|'befriended' }
function rewardsFor(trip, result) {
  const enc = trip.encounter;
  const ending = result === CONFIG.text.beaten ? 'beaten' : 'befriended';
  const r = CONFIG.enemies[enc.enemyId].rewards[ending] || {};
  const out = { ending, choose: r.choose ? r.choose.slice() : null, give: (r.give || []).slice(),
    returned: r.returnTaken ? enc.taken.slice() : [], revealTiles: r.revealTiles || 0 };
  out.empty = !out.choose && !out.give.length && !out.returned.length;   // nothing to get: skip reward + placement
  return out;
}
// uses (optional): remaining charges to carry (default: the item's full CONFIG uses).
function addToInventory(trip, itemId, uses) {
  if (!CONFIG.items[itemId]) throw new Error('unknown item ' + itemId);
  ensureUses(trip);
  trip.inventory.push(itemId);
  if (uses !== undefined && uses !== null) trip.invUses[trip.inventory.length - 1] = uses;
  else delete trip.invUses[trip.inventory.length - 1];
  return trip.inventory.length;
}
// Adds give + returned (+ the picked choice) to the inventory. -> { ok, added:[ids], revealed:[{c,r}] (M2), reason? }
function claimReward(trip, result, pick, rng) {
  const r = rewardsFor(trip, result);
  if (r.choose && r.choose.indexOf(pick) < 0) return { ok: false, added: [], reason: 'pick-required' };
  const added = r.returned.concat(r.give, r.choose ? [pick] : []);
  const tu = (trip.encounter && trip.encounter.takenUses) || [];
  added.forEach((id, i) => addToInventory(trip, id, i < r.returned.length ? tu[i] : undefined));
  if (trip.encounter) { trip.encounter.taken = []; trip.encounter.takenUses = []; }
  // M2: a befriended dog (revealTiles) shows some fogged tiles. rng picks them (without rng: first fogged tiles in map order).
  let revealed = [];
  if (trip.mode === 'm2' && trip.map && r.revealTiles > 0) {
    revealed = revealTiles(trip, r.revealTiles, rng);
    if (revealed.length) {
      const line = CONFIG.enemies[trip.encounter ? trip.encounter.enemyId : CONFIG.trip.singleFight].logName + ' ' +
        CONFIG.map.text.revealed + ': ' + revealed.length + ' tiles';
      trip.log.push(line);
    }
  }
  return { ok: true, added, revealed };
}

// ---------- stages ----------
const isCampfire = (stage) => stage === CONFIG.trip.campfireId;
// Moves to the next stage of the sequence; past the end the trip is complete. -> new stage id or null
// M2 trip: the tile / site just finished is resolved (becomes EMPTY) and the player is back on the map -> 'MAP' | null (trip over).
function advanceStage(trip) {
  if (trip.mode === 'm2') return finishTile(trip);
  trip.stageIdx += 1;
  trip.encounter = null;
  trip.placement = null;
  if (trip.stageIdx >= trip.sequence.length) {
    trip.stage = null;
    if (!trip.over) { trip.over = 'won'; trip.result = CONFIG.text.tripComplete; }
    return null;
  }
  trip.stage = trip.sequence[trip.stageIdx];
  return trip.stage;
}
