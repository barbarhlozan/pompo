// ENGINE: Win/lose, trip creation, encounter start, turn start and resolution.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- win / lose ----------
// null while some hostile face is unresolved; else 'BEATEN' | 'BEFRIENDED' (ties -> befriended)
function checkWin(enemy) {
  if (!enemy.faces.every(f => !isHostile(f) || isResolved(f))) return null;
  let broken = 0, turned = 0;
  enemy.faces.forEach(f => {
    if (!isHostile(f)) return;                       // majority of *resolved hostile* faces
    const s = faceStatus(f);
    if (s === 'broken') broken++; else if (s === 'turned') turned++;
  });
  return broken > turned ? CONFIG.text.beaten : CONFIG.text.befriended;
}
// loseRule 'dieLost': any die with every face a SCAR; 'maxScars': total scars >= CONFIG.maxScars.
function checkLose(player) {
  if (CONFIG.loseRule === 'maxScars') return countScars(player) >= CONFIG.maxScars;
  return failedDie(player) !== null;
}
// The lose events / state for a run that just ended: records which die gave out (dieLost rule).
function loseInfo(player) {
  const id = CONFIG.loseRule === 'maxScars' ? null : failedDie(player);
  return { dieId: id, dieLabel: id ? dieLabel(id) : null, scars: countScars(player), rule: CONFIG.loseRule };
}
// --- charges (uses) travel with the item: trip.faceUses[`DIE:idx`] for placed items, trip.invUses[i] parallel to
// trip.inventory[i]; a missing entry means the item's full CONFIG uses ---
const ensureUses = (trip) => { if (!trip.faceUses) trip.faceUses = {}; if (!trip.invUses) trip.invUses = []; return trip; };
function dropUses(trip, dieId, idx) { if (trip && trip.faceUses) delete trip.faceUses[faceKey(dieId, idx)]; }
function takeUses(trip, dieId, idx) {          // read + remove (item leaves the face); undefined = default
  if (!trip || !trip.faceUses) return undefined;
  const k = faceKey(dieId, idx), v = trip.faceUses[k];
  delete trip.faceUses[k];
  return v;
}

// ---------- trip & encounter ----------
// trip = { dice, player:{dice} (same array, so encounters/countScars work), inventory:[itemId], discarded:[itemId],
//          log:[], sequence:[ids], stageIdx, stage, encounter, results:[{enemyId,result,turns}], placement, over, result }
// createTrip(rng) = M1 sequence; createTrip(rng, ['DOG', ...]) = custom sequence; createTrip(rng, 'm2') = M2 map trip.
// M2 trip adds { mode:'m2', map, daylight, moves, coldHits, site } and uses stage 'MAP' | 'SITE' | enemyId | 'CAMPFIRE'.
// M1 sequence: m1Events distinct random events from m1Pool, the campfire after event campfireAfter.
function randomSequence(rng) {
  const pool = CONFIG.trip.m1Pool.slice(), picks = [];
  for (let k = 0; k < CONFIG.trip.m1Events && pool.length; k++) picks.push(pool.splice(randInt(rng, pool.length), 1)[0]);
  const seq = picks.slice(0, CONFIG.trip.campfireAfter);
  seq.push(CONFIG.trip.campfireId);
  return seq.concat(picks.slice(CONFIG.trip.campfireAfter));
}
function createTrip(rng, sequence) {
  const dice = makeDice();
  const m2 = sequence === 'm2';
  const seq = m2 ? [] : (sequence || randomSequence(rng)).slice();
  const trip = { dice, player: { dice }, inventory: CONFIG.startingInventory.slice(), discarded: [], log: [], sequence: seq, stageIdx: 0, stage: seq[0] || null,
    encounter: null, results: [], placement: null, over: null, result: null, mode: m2 ? 'm2' : 'm1',
    faceUses: {}, invUses: [], lostDie: null };
  if (m2) {
    trip.map = generateMap(rng);
    trip.daylight = CONFIG.map.daylight; trip.moves = 0; trip.coldHits = 0; trip.site = null;
    trip.stage = CONFIG.trip.mapStage;
  }
  return trip;
}
const createTripM2 = (rng) => createTrip(rng, 'm2');
const tripScars = (trip) => countScars(trip.player);
// encounter = { enemyId, enemy, player (shared with the trip), turn, rerolls, rerollPenalty, rerollBonus, pendingSow,
//               taken:[itemId], over:null|'won'|'lost', result, log:[] }  (+ hidden non-enumerable `trip`)
function startEncounter(trip, enemyId, rng) {
  trip.player.dice.forEach(d => { d.frozen = false; });
  ensureUses(trip);
  const enemy = createEnemy(enemyId, rng);
  const enc = { enemyId, enemy, player: trip.player, slots: enemy.slots, turn: 1, rerolls: 0, rerollPenalty: 0,
    rerollBonus: 0, pendingSow: 0, tax: 0, taken: [], over: null, result: null, resultLabel: null, log: [], holdPending: false };
  Object.defineProperty(enc, 'trip', { value: trip, enumerable: false, writable: true });
  trip.encounter = enc;
  return enc;
}
// Single-fight convenience (v0 API): a fresh trip with the first encounter started.
function createGame(rng) { return startEncounter(createTrip(rng, [CONFIG.trip.singleFight]), CONFIG.trip.singleFight, rng); }

function clearTurnStatus(state) { state.tax = 0; state.holdPending = false; state.player.dice.forEach(d => { d.frozen = false; d.heldOver = false; }); }
// result codes stay BEATEN / BEFRIENDED; the label shown to the player comes from the enemy data
const labelFor = (enemy, result) => (enemy && enemy.resultLabels
  ? (result === CONFIG.text.beaten ? enemy.resultLabels.beaten : enemy.resultLabels.befriended) : result);
function endWon(state, result) {
  state.over = 'won'; state.result = result;
  state.resultLabel = labelFor(state.enemy, result);
  clearTurnStatus(state);
  const trip = state.trip;
  if (trip) trip.results.push({ enemyId: state.enemyId, result, label: state.resultLabel, turns: state.turn });
}
function logLine(state, line) { state.log.push(line); if (state.trip) state.trip.log.push(line); }

// Begin a turn: applies a pending WATERING CAN SOW first (may win the encounter), then clears holds, rolls all
// dice except one held over by mindAloneHolds, sets rerolls = base - GROWL-type penalty + bonus (min 0).
// -> { rerolls, events, over, result }  (if over === 'won' the dice were not rolled)
function startTurn(state, rng) {
  const events = [];
  if (state.pendingSow > 0) {
    const amount = state.pendingSow;
    state.pendingSow = 0;
    events.push({ type: 'pendingSow', phase: 'applied', amount });
    const broke = [];
    applyVerb(state.enemy, 'SOW', amount).forEach(e => {
      events.push(e);
      if (e.type === 'faceResolved') broke.push((e.resolved === 'broken' ? 'broke ' : 'turned ') + state.enemy.faces[e.faceIdx].name);
    });
    const win = checkWin(state.enemy);
    let line = 'T' + state.turn + ': watering can: SOW ' + amount + (broke.length ? ', ' + broke.join(', ') : '');
    if (win) {
      endWon(state, win);
      events.push({ type: 'win', result: win });
      logLine(state, line + '; ' + win);
      return { rerolls: 0, events, over: state.over, result: state.result };
    }
    logLine(state, line);
  }
  state.rerolls = Math.max(0, CONFIG.rerollsPerTurn - state.rerollPenalty + state.rerollBonus);
  state.rerollPenalty = 0;
  state.rerollBonus = 0;
  state.holdPending = false;
  state.player.dice.forEach(d => {
    d.held = false;
    if (d.heldOver) {                                    // mindAloneHolds: this die keeps its face for this turn's roll
      d.heldOver = false;
      events.push({ type: 'heldOver', phase: 'kept', dieId: d.id, face: currentFace(d) });
    } else rollDie(d, rng);
  });
  return { rerolls: state.rerolls, events, over: null, result: null };
}

// ---- shared by fights and sites ----
// slotOrder: exactly `state.slots` different dice (ids or indices into player.dice), in slot order.
function slotDiceOf(state, slotOrder) {
  const slots = state.slots || CONFIG.defaultSlots;
  const dice = slotOrder.map(s => typeof s === 'number' ? state.player.dice[s] : state.player.dice.find(d => d.id === s));
  if (dice.length !== slots || dice.some(d => !d) || new Set(dice).size !== dice.length)
    throw new Error('slotOrder must place exactly ' + slots + ' different dice');
  return dice;
}
// Spend 1 charge per use flagged by the evaluation (MATCHES under PRUNE); at 0 the item burns out and is removed.
// -> log strings. Events: chargeSpent {dieId, faceIdx, item, left}, itemBurnedOut {dieId, faceIdx, item, becomes}
function spendCharges(state, dice, evaluation, events) {
  const bits = [];
  const trip = state.trip;
  if (!trip) return bits;
  ensureUses(trip);
  (evaluation.spends || []).forEach(sp => {
    const die = dice[sp.slot];
    const idx = die.idx, f = die.faces[idx], p = parseFace(f);
    if (p.item !== sp.item) return;
    const def = usesDefOf(p.item);
    if (def === null) return;
    const k = faceKey(die.id, idx);
    const left = Math.max(0, (trip.faceUses[k] !== undefined ? trip.faceUses[k] : def) - 1);
    events.push({ type: 'chargeSpent', dieId: die.id, faceIdx: idx, item: p.item, left });
    if (left <= 0) {
      die.faces[idx] = p.body;
      delete trip.faceUses[k];
      trip.discarded.push(p.item);
      events.push({ type: 'itemBurnedOut', dieId: die.id, faceIdx: idx, item: p.item, becomes: p.body });
      bits.push(CONFIG.items[p.item].name.toLowerCase() + ' burned out');
    } else {
      trip.faceUses[k] = left;
      bits.push(CONFIG.items[p.item].name.toLowerCase() + ' ' + left + ' left');
    }
  });
  return bits;
}
// Exposed belly: every die currently showing a `vulnerable` part without a VEST scars one random non-scar face of ITS OWN die
// (the belly face itself included; items on it are destroyed). Events: bellyExposed {dieId, faceIdx}, scar {..cause:'belly'},
// itemDestroyed {..cause:'belly'}. -> log strings
function exposeBelly(state, rng, events) {
  const bits = [];
  state.player.dice.forEach(d => {
    const p = parseFace(currentFace(d));
    if (p.kind !== 'body' || !partInfo(p.body).vulnerable) return;
    if (specialOf(p.item) === 'vest') return;
    events.push({ type: 'bellyExposed', dieId: d.id, faceIdx: d.idx, face: p.face, text: CONFIG.text.belly });
    const cands = [];
    d.faces.forEach((f, fi) => { if (f !== SCAR) cands.push(fi); });
    if (!cands.length) return;
    const fi = cands[randInt(rng, cands.length)];
    const previous = d.faces[fi];
    d.faces[fi] = SCAR;
    dropUses(state.trip, d.id, fi);
    events.push({ type: 'scar', dieId: d.id, faceIdx: fi, previous, wasCurrent: d.idx === fi, by: 'BELLY', cause: 'belly' });
    const item = parseFace(previous).item;
    if (item) events.push({ type: 'itemDestroyed', dieId: d.id, faceIdx: fi, item, cause: 'belly', by: 'BELLY', wasCurrent: d.idx === fi });
    bits.push(CONFIG.text.belly + ' (' + d.id + ' ' + previous + ' → ' + SCAR + ')' +
      (item ? ', ' + CONFIG.items[item].name + ' destroyed' : ''));
  });
  return bits;
}
// mindAloneHolds: a committed lone MIND offers one body die to hold over. Sets state.holdPending; the caller then
// calls holdOver(state, dieId) (any time before the next startTurn). Event holdChoice {options:[dieIds]}.
function noteHold(state, evaluation, events) {
  if (!evaluation.holds) return false;
  state.holdPending = true;
  events.push({ type: 'holdChoice', options: bodyDiceOf(state.player).map(d => d.id) });
  return true;
}
// Choose the die to keep for the next turn. -> { ok, events:[heldOver], reason? }  reasons: 'no-hold', 'not-a-body-die'
function holdOver(state, dieId) {
  if (!state.holdPending) return { ok: false, events: [], reason: 'no-hold' };
  const d = bodyDiceOf(state.player).find(x => x.id === dieId);
  if (!d) return { ok: false, events: [], reason: 'not-a-body-die' };
  state.player.dice.forEach(x => { x.heldOver = false; });
  d.heldOver = true;
  state.holdPending = false;
  const line = 'hold: ' + d.id + ' keeps ' + currentFace(d) + ' for the next turn';
  logLine(state, line);
  return { ok: true, events: [{ type: 'heldOver', phase: 'chosen', dieId: d.id, face: currentFace(d) }] };
}
// A run-ending state: records the die that gave out. -> lose event fields
function markLost(state) {
  const info = loseInfo(state.player);
  state.over = 'lost'; state.result = CONFIG.text.lost; state.lostDie = info.dieId;
  clearTurnStatus(state);
  if (state.trip) { state.trip.over = 'lost'; state.trip.result = CONFIG.text.lost; state.trip.lostDie = info.dieId; }
  return info;
}

// slotOrder: exactly `state.slots` die ids (or indices into player.dice) in slot order — any subset of the dice;
// dice left out do nothing (but count for the belly check).
// Events, in order: sentence, step*, [holdChoice], (mod, taxed, verb, pip, faceResolved)*, (chargeSpent, itemBurnedOut)*,
// [reveal], (bellyExposed, scar, itemDestroyed)*, then lose | win | [pendingSow] + enemyAct (+effects) + (lose | newIntent).
function resolveTurn(state, slotOrder, rng) {
  const events = [];
  const dice = slotDiceOf(state, slotOrder);
  const faces = dice.map(currentFace);
  const enemy = state.enemy;
  const tax = state.tax || 0;
  state.tax = 0;                                        // a tax lasts for exactly this sentence
  state.player.dice.forEach(d => { d.frozen = false; });   // so does a frozen die
  const evaluation = evaluateSentence(faces, { enemy, tax });
  const sentenceStr = faces.map((f, i) => i === evaluation.mindIndex ? '[' + f + ']' : f).join(' ');
  const broke = [];
  let turnedCount = 0;

  events.push({ type: 'sentence', slotOrder: dice.map(d => d.id), faces, evaluation, text: evaluation.text });
  evaluation.steps.forEach((step, index) => events.push({ type: 'step', index, step }));
  const holding = noteHold(state, evaluation, events);
  evaluation.order.forEach(v => {
    const m = evaluation.mods[v];
    if (m) events.push({ type: 'mod', verb: v, mod: m.mod, before: m.before, after: m.after, source: m.source });
    const tx = evaluation.taxed[v];
    if (tx) events.push({ type: 'taxed', verb: v, amount: tx.amount, before: tx.before, after: tx.after });
    const amount = evaluation.totals[v];
    if (amount <= 0) return;
    const alt = v === 'PRUNE' ? evaluation.shears : 0;
    events.push({ type: 'verb', verb: v, amount, shears: alt });
    applyVerb(enemy, v, amount, { alternate: alt }).forEach(e => {
      events.push(e);
      if (e.type === 'faceResolved') {
        if (e.resolved === 'turned') turnedCount++;
        broke.push((e.resolved === 'broken' ? 'broke ' : 'turned ') + enemy.faces[e.faceIdx].name);
      }
    });
  });
  const charged = spendCharges(state, dice, evaluation, events);

  // foresight / reveal: DIG / NOSE / GLASSES with depth d make sure d intents are pre-rolled and visible
  const changed = refreshUpcoming(enemy, rng);
  const depth = evaluation.revealDepth;
  if (depth > 0) {
    ensureUpcoming(enemy, depth, rng);
    enemy.foresight = Math.max(enemy.foresight, depth);
    enemy.shown = Math.max(enemy.shown, depth);
  }
  syncNext(enemy);
  const win = checkWin(enemy);
  if ((depth > 0 || (changed && enemy.shown > 0)) && enemy.upcoming.length) {
    events.push({ type: 'reveal', next: copyIntent(enemy.upcoming[0]), face: enemy.faces[enemy.upcoming[0].faceIdx].name,
      rerolled: changed && enemy.shown > 0, depth: enemy.shown, list: shownList(enemy) });
  }

  // exposed belly: before the enemy acts (and also when the sentence wins)
  const bellyBits = exposeBelly(state, rng, events);

  // sentence-triggered effects for the next turn (not when the enemy is already beaten or you are lost)
  const extras = charged.slice();
  const lostNow = bellyBits.length > 0 && checkLose(state.player);   // only the belly's own scar can end the run here
  if (!win && !lostNow) {
    if (evaluation.pendingSow > 0) {
      state.pendingSow += evaluation.pendingSow;
      events.push({ type: 'pendingSow', phase: 'queued', amount: evaluation.pendingSow, total: state.pendingSow });
      extras.push('watering can: +' + evaluation.pendingSow + ' SOW next turn');
    }
  }
  if (holding) extras.push('hold one die');

  const head = 'T' + state.turn + ': ' + sentenceStr + ' → ' + evaluation.totalsText +
    (broke.length ? ', ' + broke.join(', ') : '') + (extras.length ? ', ' + extras.join(', ') : '') +
    (bellyBits.length ? '; ' + bellyBits.join('; ') : '');
  const finish = (tail) => {
    const line = head + (tail ? '; ' + tail : '');
    logLine(state, line);
    return { events, log: line, over: state.over, result: state.result, evaluation, holdPending: !!state.holdPending };
  };

  if (lostNow) {                                        // the belly took the last face of a die
    const info = markLost(state);
    events.push({ type: 'lose', scars: info.scars, dieId: info.dieId, dieLabel: info.dieLabel, rule: info.rule, cause: 'belly' });
    return finish(CONFIG.text.lost + lostSuffix(info));
  }
  // win check (before the enemy acts)
  if (win) {
    endWon(state, win);
    events.push({ type: 'win', result: win });
    return finish(win);
  }

  // enemy acts
  const act = enemyAct(state, rng);
  act.events.forEach(e => events.push(e));
  const actEv = act.events[0];
  let tail = enemy.logName + ' ' + actEv.text;
  const scar = act.events.find(e => e.type === 'scar');
  if (scar) tail += ' (' + scar.dieId + ' ' + scar.previous + ' → ' + SCAR + ')';
  const destroyed = act.events.find(e => e.type === 'itemDestroyed');
  if (destroyed && destroyed.cause === 'river') tail += ' (' + destroyed.dieId + ' ' + destroyed.previous + ' → ' + destroyed.becomes + '), ' +
    CONFIG.items[destroyed.item].name + ' lost for good';
  else if (destroyed) tail += ', ' + CONFIG.items[destroyed.item].name + ' destroyed by the ' + destroyed.by.toLowerCase();
  const taken = act.events.find(e => e.type === 'itemTaken');
  if (taken) tail += ' (' + taken.dieId + ' ' + taken.previous + ' → ' + taken.becomes + ')';

  if (checkLose(state.player)) {
    const info = markLost(state);
    events.push({ type: 'lose', scars: info.scars, dieId: info.dieId, dieLabel: info.dieLabel, rule: info.rule, cause: 'enemy' });
    return finish(tail + '; ' + CONFIG.text.lost + lostSuffix(info));
  }

  // next intent: take from the pre-rolled queue
  state.turn += 1;
  refreshUpcoming(enemy, rng);
  let cur = enemy.upcoming.shift();
  if (!cur) cur = rollIntent(enemy, rng);
  enemy.current = cur;
  if (enemy.foresight > 0) {
    ensureUpcoming(enemy, enemy.foresight, rng);
    enemy.shown = enemy.foresight;
    enemy.foresight = 0;
  } else enemy.shown = 0;
  syncNext(enemy);
  events.push({ type: 'newIntent', intent: copyIntent(cur), face: enemy.faces[cur.faceIdx].name,
    next: copyIntent(enemy.next), nextFace: enemy.next ? enemy.faces[enemy.next.faceIdx].name : null,
    list: shownList(enemy) });
  return finish(tail);
}
const lostSuffix = (info) => (info.dieId ? ' (' + fmt(CONFIG.text.lostDie, { die: info.dieLabel }) + ')' : '');
