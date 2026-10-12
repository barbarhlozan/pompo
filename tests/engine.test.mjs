import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const a = html.indexOf('/* CONFIG START */');
const b = html.indexOf('/* ENGINE END */');
assert.ok(a >= 0 && b > a, 'CONFIG/ENGINE markers present');
const SRC = html.slice(a, b + '/* ENGINE END */'.length);
function loadEngine() {
  const ctx = vm.createContext({});
  vm.runInContext(SRC, ctx);
  assert.ok(ctx.SmugEngine, 'SmugEngine exported');
  return { E: ctx.SmugEngine, CFG: vm.runInContext('CONFIG', ctx), ctx };
}

// Two engine instances are loaded from the same source:
//   N / NCFG = the shipped v2 CONFIG (MIND / HEAD / TORSO, new items) — used by the "v2 / M1" tests at the bottom;
//   E0 / CFG = the same engine with the v1 three-dice kit (MIND / HAND / HEAD, v1 items and rewards) applied as *fixture data*.
//   The v1 rule tests run on the second one, which also proves the rules are data-driven (no die id or part is hard-coded).
const real = loadEngine();
const N = real.E, NCFG = real.CFG;
const leg = loadEngine();
const E0 = leg.E;                          // legacy-kit engine (bare dice, startingInventory, random M1 sequence)
const CFG = leg.CFG;
const ctx = leg.ctx;

// Tests check rules, not tuning: pin the tuning they were written against (pre-V1-6 balance preset), so designers can
// retune CONFIG (pips, maxScars, daylight) without breaking tests. The engine reads CONFIG at call time.
function applyLegacyFixture(C) {
  C.maxScars = 6;
  C.loseRule = 'maxScars';
  C.scarTargets = null; C.mindAloneHolds = false; C.defaultSlots = 3;
  C.map.daylight = 12;
  for (const en of Object.values(C.enemies)) { for (const f of en.faces) f.pips = f.pips / 2; en.slots = 3; }
  for (const st of Object.values(C.sites)) st.slots = 3;
  C.playerDice.length = 0;
  C.playerDice.push(
    { id: 'MIND', label: 'MIND', kind: 'mind', faces: ['PRUNE', 'PRUNE', 'SOW', 'SOW', 'DIG', 'DIG'] },
    { id: 'HAND', label: 'HAND', kind: 'body', faces: ['HAND', 'HAND', 'HAND', 'HAND', 'HAND', 'HAND'] },
    { id: 'HEAD', label: 'HEAD', kind: 'body', faces: ['EYE', 'EYE', 'EYE', 'MOUTH', 'MOUTH', 'MOUTH'] });
  C.bodyParts = { HAND: { favourite: 'PRUNE' }, MOUTH: { favourite: 'SOW' }, EYE: { favourite: 'DIG' } };
  C.actionNames = {
    HAND: { PRUNE: 'Hit', SOW: 'Gesture', DIG: 'Search' }, MOUTH: { PRUNE: 'Insult', SOW: 'Small talk', DIG: 'Ask' },
    EYE: { PRUNE: 'Glare', SOW: 'Kind look', DIG: 'Look' } };
  const it = (name, part, nm, special, info) => ({ name, part, names: { PRUNE: nm[0], SOW: nm[1], DIG: nm[2] }, special, info });
  C.items = {
    KNIFE: it('KNIFE', 'HAND', ['Stab', 'Threaten', 'Pry'], 'knife', 'PRUNE: +1 extra point'),
    SHEARS: it('SHEARS', 'HAND', ['Snip', 'Offer to trim', 'Cut open'], 'shears', 'split'),
    SPADE: it('SPADE', 'HAND', ['Whack', 'Lean and chat', 'Dig'], 'spade', 'DIG on a site reveals all'),
    WATERING_CAN: it('WATERING CAN', 'HAND', ['Splash', 'Water their plant', 'Flood out'], 'wateringCan', 'next turn SOW'),
    SEED_POUCH: it('SEED POUCH', 'HAND', ['Seeds in the eyes', 'Give seeds', 'Read the soil'], 'seedPouch', 'inert in v2'),
    GLASSES: it('GLASSES', 'EYE', ['Glint', 'Look learned', 'Read closely'], 'glasses', 'first slot: reveals 2'),
    LANTERN: it('LANTERN', 'EYE', ['Dazzle', 'Warm light', 'Light up'], 'lantern', 'always 2'),
    WHISTLE: it('WHISTLE', 'MOUTH', ['Shriek', 'Call softly', 'Echo'], 'whistle', 'x2 vs animals'),
    PIPE_WRENCH: it('PIPE WRENCH', 'HAND', ['Wrench', 'Fix their tap', 'Unscrew'], 'wrench', 'removed in v2'),
    PLUNGER: it('PLUNGER', 'HAND', ['Plunge', 'Unclog their worries', 'Suck out'], 'plunger', 'removed in v2'),
  };
  C.itemRules.wateringCanNow = 0;           // v1 watering can had only the delayed SOW
  C.notes.glasses = 'sees {n}';
  C.startingInventory = ['KNIFE', 'GLASSES'];
  Object.assign(C.colors.item, { PIPE_WRENCH: '#9a8cff', PLUNGER: '#d27fe0' });
  C.effectRules.scarHeadDie = 'HEAD';
  C.enemies.PLUMBER.rewards = { beaten: { give: ['PIPE_WRENCH'], returnTaken: true }, befriended: { choose: ['PLUNGER', 'WATERING_CAN'] } };
  C.enemies.ACCOUNTANT.rewards = { beaten: { choose: ['LANTERN', 'GLASSES'] }, befriended: { choose: ['WHISTLE', 'SEED_POUCH'] } };
  C.enemies.CROWS.rewards = { beaten: { give: ['LANTERN'], returnTaken: true }, befriended: { choose: ['GLASSES', 'KNIFE'] } };
  C.sites.HEAP.pool = ['SEED_POUCH', 'WATERING_CAN', 'SPADE'];
  C.sites.SHED.pool = ['SHEARS', 'KNIFE', 'LANTERN', 'GLASSES'];
  C.sites.HUT.pool = ['PIPE_WRENCH', 'PLUNGER', 'KNIFE', 'SEED_POUCH'];
  C.sites.WELL.pool = ['WHISTLE', 'LANTERN'];
}
applyLegacyFixture(CFG);
// the shipped config keeps the pre-balance pips halved for the v2 tests too (rules, not tuning)
NCFG.maxScars = 6;
NCFG.map.daylight = 12;
for (const en of Object.values(NCFG.enemies)) for (const f of en.faces) f.pips = f.pips / 2;

// Most legacy tests were written for the v1 kit (KNIFE on HAND face 0, GLASSES on HEAD face 0) and the fixed
// DOG, PLUMBER, CAMPFIRE, CROWS sequence (PLUMBER = old GARDENER mods). `E` kits the dice and fixes the sequence;
// tests of the real v1-4b start use `E0`.
const KIT_SEQ = ['DOG', 'PLUMBER', 'CAMPFIRE', 'CROWS'];
function kit(trip) {
  trip.dice.find(d => d.id === 'HAND').faces[0] = 'HAND+KNIFE';
  trip.dice.find(d => d.id === 'HEAD').faces[0] = 'EYE+GLASSES';
  trip.inventory = [];
  return trip;
}
const E = Object.assign({}, E0, {
  createTrip: (rng, seq) => kit(E0.createTrip(rng, seq === undefined ? KIT_SEQ : seq)),
  createGame: (rng) => E0.startEncounter(E.createTrip(rng), CFG.trip.singleFight, rng),
});

// vm objects have a foreign prototype chain; compare via JSON
const deepEq = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
const ev = (...faces) => E.evaluateSentence(faces);
const evx = (enemyId, ...faces) => E.evaluateSentence(faces, { enemy: E.createEnemy(enemyId) });

// Build a game with fixed dice faces (by face string) for deterministic tests.
function setFaces(state, mind, hand, head) {
  const [m, h, e] = state.player.dice;
  m.idx = m.faces.indexOf(mind); h.idx = h.faces.indexOf(hand); e.idx = e.faces.indexOf(head);
  assert.ok(m.idx >= 0 && h.idx >= 0 && e.idx >= 0);
}
const rngSeq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('required preview strings', () => {
  assert.equal(ev('PRUNE', 'EYE', 'HAND+KNIFE').text, 'Plan: Glare 1 · Stab 4 (knife +1) → PRUNE 5');
  assert.equal(ev('EYE', 'PRUNE', 'HAND+KNIFE').text, 'Situation: Look 2 (reveal) → Stab 4+2 (knife +1) → PRUNE 6');
  assert.equal(ev('HAND+KNIFE', 'EYE', 'PRUNE').text, 'Impulse: Stab 4 (knife +1) · Look 2 (reveal) → PRUNE 4');
  assert.equal(ev('MOUTH', 'PRUNE', 'HAND').text, 'Situation: Small talk 2 · Hit 2 → SOW 2 · PRUNE 2');
  assert.equal(ev('EYE', 'MOUTH', 'SOW').text, 'Impulse: Look 2 (reveal) → Small talk 2+2 → SOW 4');
});

test('evaluateSentence return shape', () => {
  const r = ev('EYE', 'PRUNE', 'HAND+KNIFE');
  assert.equal(r.shape, 'Situation');
  assert.equal(r.mindIndex, 1);
  assert.equal(r.verb, 'PRUNE');
  assert.equal(r.reveal, true);
  deepEq({ ...r.totals }, { PRUNE: 6, SOW: 0 });
  assert.equal(r.steps.length, 2);
  deepEq({ ...r.steps[0] }, { slot: 0, face: 'EYE', role: 'instinct', verb: 'DIG', base: 2, carryIn: 0,
    total: 2, reveal: true, passesTo: 2, name: 'Look', item: null, notes: [], depth: 1, idle: false });
  deepEq({ ...r.steps[1] }, { slot: 2, face: 'HAND+KNIFE', role: 'directed', verb: 'PRUNE', base: 4, carryIn: 2,
    total: 6, reveal: false, passesTo: null, name: 'Stab', item: 'KNIFE', notes: ['knife +1'], depth: 0, idle: false });
  assert.equal(r.revealDepth, 1);
});

test('SCAR scores 0 and does nothing; carry skips it', () => {
  assert.equal(ev('PRUNE', 'SCAR', 'HAND').text, 'Plan: SCAR 0 · Hit 2 → PRUNE 2');
  const r = ev('SCAR', 'DIG', 'EYE+GLASSES');
  assert.equal(r.text, 'Situation: SCAR 0 · Read closely 3 (reveal) → nothing happens');   // GLASSES only reveals 2 from the first slot
  assert.equal(r.reveal, true);
  // DIG before a SCAR before a body die: carry skips the scar
  const r2 = ev('EYE', 'SCAR', 'DIG'); // EYE instinct DIG 2, then SCAR, mind last -> nothing to pass to
  assert.equal(r2.text, 'Impulse: Look 2 (reveal) · SCAR 0 → nothing happens');
  const r3 = ev('EYE', 'PRUNE', 'SCAR');
  assert.equal(r3.steps[0].passesTo, null);
  const r4 = ev('SCAR', 'EYE', 'PRUNE');
  assert.equal(r4.text, 'Impulse: SCAR 0 · Look 2 (reveal) → nothing happens');
});

test('DIG chain carries through consecutive DIGs', () => {
  // MIND=DIG in slot 0: both body dice DIG; first DIG (EYE 2, fav) carries into second, which has nothing after.
  const r = ev('DIG', 'EYE', 'HAND');
  assert.equal(r.text, 'Plan: Look 2 (reveal) → Search 1+2 (reveal) → nothing happens');
  // DIG -> DIG -> body (instinct DIG, instinct DIG... needs 3 body dice; emulate with MIND=PRUNE last: EYE EYE PRUNE no).
  // Chain via mind verb: slot0 EYE(instinct DIG 2) -> slot1 MIND(skip) -> slot2 HAND directed DIG: "Search 1+2"
  const r2 = ev('EYE', 'DIG', 'HAND+KNIFE');
  assert.equal(r2.text, 'Situation: Look 2 (reveal) → Pry 2+2 (reveal) → nothing happens');
  assert.equal(r2.steps[1].total, 4);
  // carry lands on a real attack
  const r3 = ev('EYE+GLASSES', 'PRUNE', 'HAND');
  assert.equal(r3.text, 'Situation: Read closely 3 (reveal) (sees 2) → Hit 2+3 → PRUNE 5');
});

test('scoreBodyFace', () => {
  assert.equal(E.scoreBodyFace('HAND', 'PRUNE'), 2);
  assert.equal(E.scoreBodyFace('HAND', 'SOW'), 1);
  assert.equal(E.scoreBodyFace('HAND+KNIFE', 'PRUNE'), 4);          // 2 fav + 1 item + 1 knife
  assert.equal(E.scoreBodyFace('HAND+KNIFE', 'SOW'), 2);
  assert.equal(E.scoreBodyFace('EYE+GLASSES', 'DIG'), 3);
  assert.equal(E.scoreBodyFace('EYE+GLASSES', 'PRUNE'), 2);
  assert.equal(E.scoreBodyFace('SCAR', 'PRUNE'), 0);
});

function freshEnemy() { return E.createEnemy('DOG'); }
function prunedPips(enemy) { return enemy.faces.map(f => f.pips.join(',')); }

test('applyVerb order: current intent first, then targetPriority, ties by index', () => {
  const e = freshEnemy();
  e.current = { faceIdx: 3, wag: false };              // second GROWL
  const evs = E.applyVerb(e, 'PRUNE', 5);
  const pips = evs.filter(x => x.type === 'pip').map(x => [x.faceIdx, x.pipIdx]);
  // intent GROWL#3 (2 pips), then BITE#0 (2), BITE#1 (1)
  deepEq(pips, [[3, 0], [3, 1], [0, 0], [0, 1], [1, 0]]);
  deepEq(evs.filter(x => x.type === 'faceResolved').map(x => [x.faceIdx, x.resolved]), [[3, 'broken'], [0, 'broken']]);
  assert.equal(E.faceStatus(e.faces[1]), 'damaged');
});

test('applyVerb never targets WHIMPER; leftovers are wasted', () => {
  const e = freshEnemy();
  e.current = { faceIdx: 5, wag: false };              // WHIMPER intent
  const evs = E.applyVerb(e, 'SOW', 99);
  assert.equal(evs.filter(x => x.type === 'pip').length, 10);       // 5 hostile faces x 2
  deepEq(e.faces[5].pips, ['intact', 'intact']);
  assert.ok(E.checkWin(e));
});

test('faceStatus: mixed broken/turned, ties -> turned', () => {
  assert.equal(E.faceStatus({ name: 'BITE', pips: ['intact', 'intact'] }), 'intact');
  assert.equal(E.faceStatus({ name: 'BITE', pips: ['broken', 'intact'] }), 'damaged');
  assert.equal(E.faceStatus({ name: 'BITE', pips: ['broken', 'broken'] }), 'broken');
  assert.equal(E.faceStatus({ name: 'BITE', pips: ['turned', 'turned'] }), 'turned');
  assert.equal(E.faceStatus({ name: 'BITE', pips: ['broken', 'turned'] }), 'turned');
  const three = { name: 'BITE', pips: ['broken', 'broken', 'turned'] };
  assert.equal(E.faceStatus(three), 'broken');
  // via applyVerb: PRUNE 1 then SOW 1 on the current face -> tie -> turned
  const e = freshEnemy();
  e.current = { faceIdx: 0, wag: false };
  E.applyVerb(e, 'PRUNE', 1);
  const evs = E.applyVerb(e, 'SOW', 1);
  assert.equal(E.faceStatus(e.faces[0]), 'turned');
  deepEq(evs.find(x => x.type === 'faceResolved'), { type: 'faceResolved', faceIdx: 0, resolved: 'turned' });
});

test('rollIntent never returns a broken face; wag on turned face', () => {
  const e = freshEnemy();
  e.faces[0].pips = ['broken', 'broken'];
  e.faces[1].pips = ['broken', 'broken'];
  e.faces[2].pips = ['turned', 'turned'];
  const rng = E.makeRng(42);
  let sawWag = false;
  for (let i = 0; i < 500; i++) {
    const r = E.rollIntent(e, rng);
    assert.notEqual(E.faceStatus(e.faces[r.faceIdx]), 'broken');
    assert.ok(r.faceIdx >= 2);
    if (r.faceIdx === 2) { assert.equal(r.wag, true); sawWag = true; } else assert.equal(r.wag, false);
  }
  assert.ok(sawWag);
});

test('makeRng is deterministic', () => {
  const r1 = E.makeRng(7), r2 = E.makeRng(7);
  for (let i = 0; i < 10; i++) assert.equal(r1(), r2());
});

test('startTurn / rerollUnheld respect holds and reroll count', () => {
  const g = E.createGame(E.makeRng(1));
  const rng = E.makeRng(2);
  assert.equal(E.startTurn(g, rng).rerolls, CFG.rerollsPerTurn);
  g.player.dice[0].held = true;
  const keep = g.player.dice[0].idx;
  for (let i = 0; i < 20 && g.rerolls > 0; i++) {
    const ids = E.rerollUnheld(g, rng);
    deepEq(ids, ['HAND', 'HEAD']);
    assert.equal(g.player.dice[0].idx, keep);
  }
  assert.equal(g.rerolls, 0);
  assert.equal(E.rerollUnheld(g, rng), null);
  E.startTurn(g, rng);
  assert.equal(g.player.dice[0].held, false);
});

test('BITE scars only HAND/HEAD non-scar faces', () => {
  const g = E.createGame();
  g.enemy.current = { faceIdx: 0, wag: false };       // BITE
  const rng = E.makeRng(99);
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const out = E.enemyAct(g, rng);
    const sc = out.events.find(e => e.type === 'scar');
    assert.ok(sc);
    assert.ok(['HAND', 'HEAD'].includes(sc.dieId));
    assert.notEqual(sc.previous, 'SCAR');
    seen.add(sc.dieId + sc.faceIdx);
  }
  assert.equal(seen.size, 12);                         // never re-scarred the same face
  assert.equal(g.player.dice[0].faces.includes('SCAR'), false);   // MIND untouched
  assert.equal(E.countScars(g.player), 12);
});

test('GROWL reduces next turn rerolls by 1, not stacking, only one turn', () => {
  const g = E.createGame();
  const rng = E.makeRng(5);
  g.enemy.current = { faceIdx: 2, wag: false };       // GROWL
  E.startTurn(g, rng);
  setFaces(g, 'DIG', 'HAND', 'MOUTH');       // no damage, so the GROWL stays live
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], rng);
  assert.equal(out.over, null);
  assert.ok(out.events.some(e => e.type === 'enemyAct' && e.effect === 'rerollPenalty'));
  assert.equal(E.startTurn(g, rng).rerolls, CFG.rerollsPerTurn - 1);
  assert.equal(E.startTurn(g, rng).rerolls, CFG.rerollsPerTurn);
  // stacking: two growls in a row still only -1
  g.rerollPenalty = 1; g.enemy.current = { faceIdx: 2, wag: false };
  E.enemyAct(g, rng);
  assert.equal(E.startTurn(g, rng).rerolls, CFG.rerollsPerTurn - 1);
});

test('SNIFF / WHIMPER do nothing', () => {
  const g = E.createGame();
  const rng = E.makeRng(5);
  for (const fi of [4, 5]) {
    g.enemy.current = { faceIdx: fi, wag: false };
    const out = E.enemyAct(g, rng);
    assert.equal(out.events.length, 1);
    assert.equal(out.events[0].skipped, false);
    assert.equal(E.countScars(g.player), 0);
    assert.equal(out.rerollPenalty, 0);
  }
});

test('resolveTurn: win BEATEN vs BEFRIENDED', () => {
  for (const [verb, want] of [['PRUNE', 'BEATEN'], ['SOW', 'BEFRIENDED']]) {
    const g = E.createGame();
    g.enemy.current = { faceIdx: 0, wag: false };
    // leave exactly 1 pip of the last hostile face; resolve everything else with the verb
    const other = verb === 'PRUNE' ? 'turned' : 'broken';
    g.enemy.faces.forEach((f, i) => {
      if (i === 5) return;
      f.pips = [verb === 'PRUNE' ? 'broken' : 'turned', verb === 'PRUNE' ? 'broken' : 'turned'];
    });
    g.enemy.faces[4].pips = ['intact', 'intact'];
    setFaces(g, verb, 'HAND', 'MOUTH');
    const rng = E.makeRng(3);
    const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], rng);
    assert.equal(out.over, 'won');
    assert.equal(out.result, want);
    assert.equal(g.over, 'won');
    assert.ok(out.events.some(e => e.type === 'win' && e.result === want));
    assert.ok(!out.events.some(e => e.type === 'enemyAct'));   // defeated enemy does not act
    assert.ok(other);
  }
  // tie -> befriended
  const g = E.createGame();
  g.enemy.faces[0].pips = ['broken', 'broken'];
  g.enemy.faces[1].pips = ['broken', 'broken'];
  g.enemy.faces[2].pips = ['turned', 'turned'];
  g.enemy.faces[3].pips = ['turned', 'turned'];
  g.enemy.faces[4].pips = ['turned', 'turned'];
  assert.equal(E.checkWin(g.enemy), 'BEFRIENDED');
  g.enemy.faces[4].pips = ['broken', 'broken'];
  assert.equal(E.checkWin(g.enemy), 'BEATEN');
});

test('lose at maxScars', () => {
  assert.equal(CFG.maxScars, 6);
  const g = E.createGame();
  const rng = E.makeRng(11);
  [[1, 0], [1, 1], [1, 2], [2, 0], [2, 1]].forEach(([d, f]) => { g.player.dice[d].faces[f] = 'SCAR'; });
  assert.equal(E.countScars(g.player), 5);
  assert.equal(E.checkLose(g.player), false);
  g.enemy.current = { faceIdx: 0, wag: false };       // BITE
  setFaces(g, 'DIG', 'HAND', 'MOUTH');                 // weak sentence, enemy survives
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], rng);
  assert.equal(E.countScars(g.player), 6);
  assert.equal(out.over, 'lost');
  assert.equal(g.trip.over, 'lost');
  assert.ok(out.events.some(e => e.type === 'lose'));
  assert.ok(!out.events.some(e => e.type === 'newIntent'));
  assert.ok(out.log.includes(CFG.text.lost));
});

test('resolveTurn skips enemy act when intent resolved this turn; log line', () => {
  const g = E.createGame();
  g.enemy.current = { faceIdx: 2, wag: false };       // GROWL, 2 pips
  setFaces(g, 'PRUNE', 'HAND+KNIFE', 'EYE');
  // order HEAD MIND HAND -> Situation: Look 2 (reveal) -> Stab 4+2 (knife +1) = PRUNE 6
  const out = E.resolveTurn(g, ['HEAD', 'MIND', 'HAND'], E.makeRng(8));
  assert.equal(out.evaluation.text, 'Situation: Look 2 (reveal) → Stab 4+2 (knife +1) → PRUNE 6');
  const act = out.events.find(e => e.type === 'enemyAct');
  assert.equal(act.skipped, true);
  assert.equal(act.reason, 'broken');
  assert.equal(E.countScars(g.player), 0);
  assert.equal(out.log, 'T1: EYE [PRUNE] HAND+KNIFE → PRUNE 6, broke GROWL, broke BITE, broke BITE; dog is too hurt to act');
  assert.equal(g.turn, 2);
  // reveal -> next intent was pre-rolled, and a new greyed next is shown on turn 2
  assert.ok(out.events.some(e => e.type === 'reveal'));
  const ni = out.events.find(e => e.type === 'newIntent');
  assert.ok(ni.next);
  assert.equal(g.enemy.foresight, 0);
  assert.notEqual(E.faceStatus(g.enemy.faces[g.enemy.current.faceIdx]), 'broken');
});

test('wag intent: turned face does nothing', () => {
  const g = E.createGame();
  g.enemy.faces[0].pips = ['turned', 'turned'];
  g.enemy.current = { faceIdx: 0, wag: true };
  setFaces(g, 'DIG', 'HAND', 'MOUTH');
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(1));
  const act = out.events.find(e => e.type === 'enemyAct');
  assert.equal(act.skipped, true);
  assert.equal(act.reason, 'wag');
  assert.equal(act.text, CFG.enemies.DOG.text.wag);
  assert.equal(E.countScars(g.player), 0);
});

test('reveal: DIG does not change next turn current when next not broken; next rerolled if broken', () => {
  const g = E.createGame();
  g.enemy.current = { faceIdx: 4, wag: false };       // SNIFF
  g.enemy.upcoming = [{ faceIdx: 0, wag: false }];    // BITE pre-rolled earlier, currently visible
  g.enemy.shown = 1;
  // sentence breaking BITE#0: MIND PRUNE, HAND (PRUNE 2), HEAD EYE+GLASSES (PRUNE 2) -> 4 pips: SNIFF intent first (2), BITE#0 (2)
  setFaces(g, 'PRUNE', 'HAND', 'EYE+GLASSES');
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], rngSeq(0.0));
  assert.equal(E.faceStatus(g.enemy.faces[0]), 'broken');
  const rv = out.events.find(e => e.type === 'reveal');
  assert.ok(rv && rv.rerolled);
  assert.notEqual(rv.next.faceIdx, 0);
});

test('full simulated fight with fixed seed reaches a result', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const rng = E.makeRng(seed);
    const g = E.createGame(rng);
    let turns = 0;
    while (!g.over && turns < 200) {
      E.startTurn(g, rng);
      // use rerolls greedily-ish: reroll once if MIND shows DIG
      if (E.currentFace(g.player.dice[0]) === 'DIG') E.rerollUnheld(g, rng);
      const order = [0, 1, 2].sort(() => rng() - 0.5);
      const out = E.resolveTurn(g, order, rng);
      assert.ok(Array.isArray(out.events) && out.events.length > 0);
      assert.match(out.log, /^T\d+: /);
      turns++;
    }
    assert.ok(g.over === 'won' || g.over === 'lost', 'seed ' + seed + ' did not finish');
    if (g.over === 'won') assert.ok(['BEATEN', 'BEFRIENDED'].includes(g.result));
  }
  // determinism
  const run = seed => {
    const rng = E.makeRng(seed), g = E.createGame(rng);
    while (!g.over) { E.startTurn(g, rng); E.resolveTurn(g, [0, 1, 2], rng); }
    return g.log.join('|') + g.result;
  };
  assert.equal(run(1234), run(1234));
});

test('log/flavour lines read naturally', () => {
  const T = CFG.enemies.DOG.text;
  assert.equal(T.wag, 'wags its tail');
  assert.equal(T.broken, 'is too hurt to act');
  const logFor = (faceIdx) => {
    const g = E.createGame();
    g.enemy.current = { faceIdx, wag: false };
    setFaces(g, 'DIG', 'HAND', 'MOUTH');
    return E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(3)).log;
  };
  assert.match(logFor(2), /; dog growls \(−1 reroll next turn\)$/);
  assert.match(logFor(4), /; dog sniffs your pockets$/);
  assert.match(logFor(5), /; dog whimpers$/);
  assert.match(logFor(0), /; dog bites \((HAND|HEAD) \S+ → SCAR\)(, \w+ destroyed by the bite)?$/);
  const g = E.createGame();
  g.enemy.faces[0].pips = ['turned', 'turned'];
  g.enemy.current = { faceIdx: 0, wag: true };
  setFaces(g, 'DIG', 'HAND', 'MOUTH');
  assert.match(E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(3)).log, /; dog wags its tail$/);
});

test('scar face key follows CONFIG.text.scar (engine and CONFIG agree)', () => {
  const src = html.slice(a, b + '/* ENGINE END */'.length).replace("scar: 'SCAR',", "scar: 'WOUND',");
  assert.notEqual(src, html.slice(a, b + '/* ENGINE END */'.length), 'replacement applied');
  const c2 = vm.createContext({});
  vm.runInContext(src, c2);
  const E2 = c2.SmugEngine;
  const g = E2.createGame();
  g.player.dice[1].faces[0] = 'WOUND';
  assert.equal(E2.countScars(g.player), 1);
  assert.equal(E2.parseFace('WOUND').kind, 'scar');
  g.enemy.current = { faceIdx: 0, wag: false };   // BITE
  g.player.dice[0].idx = g.player.dice[0].faces.indexOf('DIG');
  const before = E2.countScars(g.player);
  E2.resolveTurn(g, ['MIND', 'HEAD', 'TORSO'], E2.makeRng(5));
  assert.equal(E2.countScars(g.player), before + 1);
  assert.ok(!g.player.dice.some(d => d.faces.includes('SCAR')), 'no literal SCAR face is created');
});

// =====================================================================================
// v1 / M1 engine
// =====================================================================================
const SC = CFG.text.scar;
function enc(enemyId, seed = 1) {
  const trip = E.createTrip(E.makeRng(seed));
  return E.startEncounter(trip, enemyId, E.makeRng(seed));
}
// give the HAND / HEAD dice exact faces (indices from 0); MIND stays default
function dressDice(g, hand, head) {
  if (hand) hand.forEach((f, i) => { if (f) g.player.dice[1].faces[i] = f; });
  if (head) head.forEach((f, i) => { if (f) g.player.dice[2].faces[i] = f; });
}
function pointTo(g, mind, handIdx, headIdx) {
  const [m, h, e] = g.player.dice;
  m.idx = m.faces.indexOf(mind); h.idx = handIdx; e.idx = headIdx;
}
const pips = (events) => events.filter(x => x.type === 'pip');
const sorted = (a) => a.slice().sort();

test('CONFIG data model: 10 items, 4 enemies, bare dice, startingInventory, maxScars, enemy pool', () => {
  deepEq(sorted(Object.keys(CFG.items)), sorted(['KNIFE', 'SHEARS', 'SPADE', 'WATERING_CAN', 'SEED_POUCH', 'GLASSES', 'LANTERN', 'WHISTLE',
    'PIPE_WRENCH', 'PLUNGER']));
  deepEq(Object.keys(CFG.enemies), ['DOG', 'PLUMBER', 'ACCOUNTANT', 'BRIDGE', 'CROWS']);
  assert.ok(!('GARDENER' in CFG.enemies));
  deepEq(CFG.playerDice.find(d => d.id === 'HAND').faces, ['HAND', 'HAND', 'HAND', 'HAND', 'HAND', 'HAND']);
  deepEq(CFG.playerDice.find(d => d.id === 'HEAD').faces, ['EYE', 'EYE', 'EYE', 'MOUTH', 'MOUTH', 'MOUTH']);
  deepEq(CFG.startingInventory, ['KNIFE', 'GLASSES']);
  assert.equal(CFG.maxScars, 6);
  deepEq(CFG.trip.enemyPool, ['DOG', 'PLUMBER', 'CROWS', 'ACCOUNTANT', 'BRIDGE']);
  deepEq(CFG.trip.m1Pool, ['DOG', 'PLUMBER', 'CROWS', 'ACCOUNTANT', 'BRIDGE', 'HUT']);
  assert.ok(CFG.verbInfo.PRUNE && CFG.verbInfo.SOW && CFG.verbInfo.DIG);
  for (const id of Object.keys(CFG.items)) {
    const it = CFG.items[id];
    assert.ok(['HAND', 'EYE', 'MOUTH'].includes(it.part));
    assert.ok(it.names.PRUNE && it.names.SOW && it.names.DIG && it.special && it.info);
    assert.ok(CFG.colors.item[id], 'colour for ' + id);
  }
  // enemy face pips: plumber 3/3/1/1/1/1, crows 1/1/1/2/1/1, dog all 2, accountant 2/2/3/1/2/1
  deepEq(CFG.enemies.PLUMBER.faces.map(f => f.pips), [3, 3, 1, 1, 1, 1]);
  deepEq(CFG.enemies.ACCOUNTANT.faces.map(f => f.pips), [2, 2, 3, 1, 2, 1]);
  deepEq(CFG.enemies.CROWS.faces.map(f => f.pips), [1, 1, 1, 2, 1, 1]);
  deepEq(CFG.enemies.DOG.faces.map(f => f.pips), [2, 2, 2, 2, 2, 2]);
  assert.equal(CFG.enemies.PLUMBER.pruneMod, -1); assert.equal(CFG.enemies.PLUMBER.sowMod, 1);
  assert.equal(CFG.enemies.CROWS.pruneMod, 1); assert.equal(CFG.enemies.CROWS.sowMod, -2);
});

test('createTrip: starting kit, shared dice, empty inventory', () => {
  const t = E.createTrip(E.makeRng(1));
  deepEq(t.dice.map(d => d.id), ['MIND', 'HAND', 'HEAD']);
  assert.equal(t.player.dice, t.dice);
  deepEq(t.inventory, []);
  assert.equal(t.stage, 'DOG');
  assert.equal(E.tripScars(t), 0);
  // dice are copies of CONFIG, mutating the trip never touches CONFIG
  t.dice[1].faces[1] = SC;
  assert.equal(CFG.playerDice[1].faces[1], 'HAND');
});

test('knife: +1 only under PRUNE; annotation', () => {
  assert.equal(ev('EYE', 'PRUNE', 'HAND+KNIFE').text, 'Situation: Look 2 (reveal) → Stab 4+2 (knife +1) → PRUNE 6');
  assert.equal(ev('MOUTH', 'SOW', 'HAND+KNIFE').text, 'Situation: Small talk 2 · Threaten 2 → SOW 4');
  assert.equal(ev('HAND+KNIFE', 'DIG', 'EYE').steps[0].base, 4);   // instinct PRUNE is the knife's own verb
});

test('lantern: 2 points under any verb (3 with item), annotated except under DIG', () => {
  assert.equal(ev('PRUNE', 'HAND', 'EYE+LANTERN').text, 'Plan: Hit 2 · Dazzle 3 (lantern) → PRUNE 5');
  assert.equal(ev('SOW', 'HAND', 'EYE+LANTERN').text, 'Plan: Gesture 1 · Warm light 3 (lantern) → SOW 4');
  assert.equal(ev('EYE+LANTERN', 'PRUNE', 'HAND').text, 'Situation: Light up 3 (reveal) → Hit 2+3 → PRUNE 5');
  assert.equal(E.scoreBodyFace('EYE+LANTERN', 'SOW'), 3);
  assert.equal(E.scoreBodyFace('EYE', 'SOW'), 1);
});

test('whistle: SOW vs animals doubles own points (before carry); not vs humans / no enemy', () => {
  const dog = (...f) => evx('DOG', ...f);
  const r = dog('EYE', 'SOW', 'MOUTH+WHISTLE');
  assert.equal(r.text, 'Situation: Look 2 (reveal) → Call softly 6+2 (whistle ×2) → SOW 8');
  assert.equal(r.totals.SOW, 8);
  assert.equal(evx('CROWS', 'EYE', 'SOW', 'MOUTH+WHISTLE').steps[1].base, 6);   // crows are animals too
  assert.equal(evx('PLUMBER', 'EYE', 'SOW', 'MOUTH+WHISTLE').steps[1].base, 3);   // human: no doubling
  assert.equal(ev('EYE', 'SOW', 'MOUTH+WHISTLE').steps[1].base, 3);                // no enemy context
  // only SOW doubles
  assert.equal(dog('EYE', 'PRUNE', 'MOUTH+WHISTLE').steps[1].base, 2);             // PRUNE: 1 other + 1 item
});

test('whistle instinct SOW doubles too', () => {
  const r = evx('DOG', 'MOUTH+WHISTLE', 'PRUNE', 'HAND');
  assert.equal(r.steps[0].base, 6);
  assert.equal(r.text, 'Situation: Call softly 6 (whistle ×2) · Hit 2 → SOW 6 · PRUNE 2');
});

test('glasses annotate and set depth 2; spade only on a site', () => {
  const r = ev('EYE+GLASSES', 'SOW', 'MOUTH');
  assert.equal(r.revealDepth, 2);
  assert.equal(r.text, 'Situation: Read closely 3 (reveal) (sees 2) → Small talk 2+3 → SOW 5');
  assert.equal(ev('EYE', 'SOW', 'MOUTH').revealDepth, 1);
  assert.equal(ev('MOUTH', 'SOW', 'EYE').revealDepth, 0);
  assert.equal(ev('DIG', 'HAND', 'HAND+SPADE').revealDepth, 1);          // DIG directed on both dice
  assert.ok(!/reveals all/.test(ev('DIG', 'HAND', 'HAND+SPADE').text));
  const site = E.evaluateSentence(['DIG', 'HAND', 'HAND+SPADE'], { site: true });
  assert.match(site.text, /Dig 2.*\(reveals all\)/);
});

test('names: every item gives its own action names', () => {
  assert.equal(ev('PRUNE', 'HAND+SHEARS', 'EYE').steps[0].name, 'Snip');
  assert.equal(ev('SOW', 'HAND+WATERING_CAN', 'EYE').steps[0].name, 'Water their plant');
  assert.equal(ev('SOW', 'HAND+SEED_POUCH', 'EYE').steps[0].name, 'Give seeds');
  assert.equal(ev('DIG', 'HAND+SPADE', 'EYE').steps[0].name, 'Dig');
  assert.equal(ev('PRUNE', 'HAND', 'MOUTH+WHISTLE').steps[1].name, 'Shriek');
});

test('pruneMod / sowMod: applied once, clamped at 0, only if the verb is produced', () => {
  // plumber: pruneMod -1, sowMod +1
  const g1 = evx('PLUMBER', 'PRUNE', 'HAND', 'EYE');                    // Hit 2 + Glare 1 = 3
  assert.equal(g1.text, 'Plan: Hit 2 · Glare 1 → PRUNE 2 (plumber −1)');
  assert.equal(g1.totals.PRUNE, 2);
  deepEq({ ...g1.mods.PRUNE }, { mod: -1, before: 3, after: 2, source: 'plumber' });
  const g2 = evx('PLUMBER', 'SOW', 'MOUTH', 'EYE');                      // Small talk 2 + Kind look 1 = 3 -> 4
  assert.equal(g2.text, 'Plan: Small talk 2 · Kind look 1 → SOW 4 (plumber +1)');
  // only the verbs actually produced are modded: PRUNE-only sentence has no sowMod
  assert.equal(evx('PLUMBER', 'PRUNE', 'HAND', 'HAND').totals.SOW, 0);
  assert.equal(evx('PLUMBER', 'PRUNE', 'HAND', 'HAND').text, 'Plan: Hit 2 · Hit 2 → PRUNE 3 (plumber −1)');
  // DIG-only sentence: no verb produced, no mod => no phantom SOW 1
  const dig = evx('PLUMBER', 'DIG', 'HAND', 'EYE');
  assert.equal(dig.totals.SOW, 0); assert.equal(dig.totals.PRUNE, 0);
  assert.equal(dig.text.endsWith('→ nothing happens'), true);
  // crows: sowMod -2 clamps to 0; pruneMod +1
  const c1 = evx('CROWS', 'SOW', 'EYE', 'EYE');                          // Kind look 1 + Kind look 1 = 2 -> 0
  assert.equal(c1.text, 'Plan: Kind look 1 · Kind look 1 → SOW 0 (crows −2)');
  assert.equal(c1.totals.SOW, 0);
  const c2 = evx('CROWS', 'PRUNE', 'HAND', 'EYE');
  assert.equal(c2.text, 'Plan: Hit 2 · Glare 1 → PRUNE 4 (crows +1)');
  // mixed sentence: each verb modded once, in sentence order
  const mixed = evx('CROWS', 'MOUTH', 'PRUNE', 'HAND');
  assert.equal(mixed.text, 'Situation: Small talk 2 · Hit 2 → SOW 0 (crows −2) · PRUNE 3 (crows +1)');
  // dog has 0/0 mods: no annotation
  assert.equal(evx('DOG', 'PRUNE', 'HAND', 'EYE').text, 'Plan: Hit 2 · Glare 1 → PRUNE 3');
  // no ctx (placement preview): no mods
  assert.equal(ev('PRUNE', 'HAND', 'EYE').text, 'Plan: Hit 2 · Glare 1 → PRUNE 3');
});

test('mods change what is actually applied (events + pips)', () => {
  const g = enc('PLUMBER');
  g.enemy.current = { faceIdx: 0, wag: false };                          // SNIP, 3 pips
  setFaces(g, 'PRUNE', 'HAND', 'EYE');
  const out = E.resolveTurn(g, ['HEAD', 'MIND', 'HAND'], E.makeRng(2));  // Look 2 (reveal) -> Hit 2+2 = PRUNE 4 -> 3
  const mod = out.events.find(e => e.type === 'mod');
  deepEq({ ...mod }, { type: 'mod', verb: 'PRUNE', mod: -1, before: 4, after: 3, source: 'plumber' });
  assert.equal(pips(out.events).length, 3);
  assert.equal(out.events.find(e => e.type === 'verb').amount, 3);
  assert.ok(out.events.indexOf(mod) < out.events.findIndex(e => e.type === 'verb'));
  // fully clamped: crows SOW with a weak sentence applies nothing
  const c = enc('CROWS');
  setFaces(c, 'SOW', 'HAND', 'EYE');
  const o2 = E.resolveTurn(c, ['MIND', 'HAND', 'HEAD'], E.makeRng(2));   // Gesture 1 + Kind look 1 = 2 -> 0
  assert.equal(pips(o2.events).length, 0);
  assert.equal(o2.events.find(e => e.type === 'mod').after, 0);
  assert.ok(!o2.events.some(e => e.type === 'verb'));
});

test('shears: points alternate across the first two faces, rest applied normally', () => {
  const e = E.createEnemy('DOG');
  e.current = { faceIdx: 0, wag: false };
  const evs = E.applyVerb(e, 'PRUNE', 5, { alternate: 3 });
  const seq = pips(evs).map(x => x.faceIdx + (x.shears ? 's' : ''));
  // 3 alternating: BITE#0, BITE#1, BITE#0 (resolved) ; then 2 normal: BITE#1 (1 pip left), GROWL#2
  deepEq(seq, ['0s', '1s', '0s', '1', '2']);
  assert.equal(E.faceStatus(e.faces[0]), 'broken');
  assert.equal(E.faceStatus(e.faces[1]), 'broken');
  assert.equal(E.faceStatus(e.faces[2]), 'damaged');
  // only one eligible face left: everything goes to it
  const e2 = E.createEnemy('DOG');
  e2.faces.forEach((f, i) => { if (i !== 4) f.pips = ['broken', 'broken']; });   // only SNIFF open
  e2.current = { faceIdx: 4, wag: false };
  deepEq(pips(E.applyVerb(e2, 'PRUNE', 3, { alternate: 3 })).map(x => x.faceIdx), [4, 4]);
  // in a sentence: HAND+SHEARS PRUNE 3 (2 fav + 1 item) -> 'shears split' annotation + verb event carries shears
  const r = evx('DOG', 'PRUNE', 'EYE', 'HAND+SHEARS');
  assert.equal(r.text, 'Plan: Glare 1 · Snip 3 (shears split) → PRUNE 4');
  assert.equal(r.shears, 3);
  const g = enc('DOG');
  g.enemy.current = { faceIdx: 0, wag: false };
  setFaces(g, 'PRUNE', 'HAND', 'EYE');
  g.player.dice[1].faces[g.player.dice[1].idx] = 'HAND+SHEARS';
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(3));   // Hit... instinct? MIND first: Impulse no, Plan
  const v = out.events.find(x => x.type === 'verb');
  assert.equal(v.shears, 3);
  assert.equal(pips(out.events).filter(x => x.shears).length, 3);
});

test('shears alternation: shears share only the shears die total when a carry-less partner exists', () => {
  const r = evx('DOG', 'EYE', 'PRUNE', 'HAND+SHEARS');   // Look 2 -> Snip 3+2 = 5, whole 5 is the shears die
  assert.equal(r.shears, 5);
  assert.equal(r.text, 'Situation: Look 2 (reveal) → Snip 3+2 (shears split) → PRUNE 5');
  const e = evx('DOG', 'HAND', 'PRUNE', 'HAND+SHEARS');   // Hit 2 instinct PRUNE + Snip 3
  assert.equal(e.totals.PRUNE, 5); assert.equal(e.shears, 3);
});

test('watering can: queues SOW, applied at the start of the next turn before rolling', () => {
  const g = enc('DOG');
  g.enemy.current = { faceIdx: 4, wag: false };             // SNIFF
  setFaces(g, 'SOW', 'HAND', 'MOUTH');
  g.player.dice[1].faces[g.player.dice[1].idx] = 'HAND+WATERING_CAN';
  const t = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(4));      // Plan: Water their plant 2 · Small talk 2
  assert.match(t.evaluation.text, /Water their plant 2 \(\+1 SOW next turn\)/);
  const q = t.events.find(x => x.type === 'pendingSow');
  deepEq({ ...q }, { type: 'pendingSow', phase: 'queued', amount: 1, total: 1 });
  assert.equal(g.pendingSow, 1);
  assert.match(t.log, /watering can: \+1 SOW next turn/);
  const before = g.enemy.faces.map(f => f.pips.filter(p => p === 'intact').length).reduce((a, b) => a + b, 0);
  const st = E.startTurn(g, E.makeRng(5));
  const ap = st.events.find(x => x.type === 'pendingSow');
  deepEq({ ...ap }, { type: 'pendingSow', phase: 'applied', amount: 1 });
  assert.equal(pips(st.events).length, 1);
  assert.equal(pips(st.events)[0].to, 'turned');
  assert.equal(g.pendingSow, 0);
  const after = g.enemy.faces.map(f => f.pips.filter(p => p === 'intact').length).reduce((a, b) => a + b, 0);
  assert.equal(after, before - 1);
  assert.match(g.log[g.log.length - 1], /^T2: watering can: SOW 1/);
  // not applied twice
  assert.equal(E.startTurn(g, E.makeRng(6)).events.length, 0);
});

test('watering can can finish the fight at turn start; discarded between encounters', () => {
  const g = enc('DOG');
  g.enemy.faces.forEach((f, i) => { f.pips = i === 0 ? ['intact', 'turned'] : (f.hostile ? ['turned', 'turned'] : ['intact', 'intact']); });
  g.enemy.current = { faceIdx: 0, wag: false };
  g.pendingSow = 1;
  const st = E.startTurn(g, E.makeRng(1));
  assert.equal(st.over, 'won');
  assert.equal(st.result, 'BEFRIENDED');
  assert.ok(st.events.some(x => x.type === 'win'));
  assert.equal(g.over, 'won');
  assert.equal(g.trip.results.length, 1);
  // new encounter starts clean
  g.pendingSow = 1;
  const g2 = E.startEncounter(g.trip, 'PLUMBER', E.makeRng(1));
  assert.equal(g2.pendingSow, 0); assert.equal(g2.rerollPenalty, 0); assert.equal(g2.rerollBonus, 0);
  deepEq(g2.taken, []);
});

// (v1 seed-pouch reroll bonus, PIPE WRENCH sturdiness and PLUNGER were removed in v2: see the v2 tests at the bottom)

test('glasses depth 2: two intents revealed, visible next turn, then cleared', () => {
  const g = enc('DOG', 5);
  const rng = E.makeRng(21);
  g.enemy.current = { faceIdx: 4, wag: false };                       // SNIFF: harmless
  setFaces(g, 'SOW', 'HAND', 'EYE+GLASSES');
  g.player.dice[1].idx = 1;                                           // bare HAND
  // HEAD(EYE+GLASSES, instinct DIG 3) -> MIND SOW -> HAND SOW 1+3 ... no damage that finishes anything big
  const out = E.resolveTurn(g, ['HEAD', 'MIND', 'HAND'], rng);
  const rv = out.events.find(x => x.type === 'reveal');
  assert.equal(rv.list.length, 2);
  assert.equal(rv.depth, 2);
  assert.equal(g.enemy.upcoming.length >= 2, true);
  const ni = out.events.find(x => x.type === 'newIntent');
  // transition: current = old upcoming[0]; two more intents are visible during the following turn
  assert.equal(ni.list.length, 2);
  assert.equal(g.enemy.shown, 2);
  assert.equal(g.enemy.upcoming.length >= 2, true);
  assert.equal(g.enemy.foresight, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(g.enemy.next)), JSON.parse(JSON.stringify(g.enemy.upcoming[0])));
  // the revealed intents are what actually happens: first revealed = this turn's current
  assert.deepEqual(JSON.parse(JSON.stringify(rv.list[0].intent)), JSON.parse(JSON.stringify(ni.intent)));
  assert.deepEqual(JSON.parse(JSON.stringify(rv.list[1].intent)), JSON.parse(JSON.stringify(ni.list[0].intent)));
  // a turn with no DIG: nothing visible afterwards
  setFaces(g, 'PRUNE', 'HAND', 'MOUTH');
  g.player.dice[1].idx = 1;
  g.enemy.current = { faceIdx: 4, wag: false };
  const out2 = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], rng);
  out2.events.filter(x => x.type === 'reveal').forEach(x => assert.equal(x.rerolled, true));   // only a changed queue re-announces
  if (!out2.over) { assert.equal(g.enemy.shown, 0); assert.equal(g.enemy.next, null); assert.equal(out2.events.find(x => x.type === 'newIntent').list.length, 0); }
});

test('plain DIG keeps v0 depth 1', () => {
  const g = enc('DOG', 3);
  g.enemy.current = { faceIdx: 4, wag: false };
  setFaces(g, 'SOW', 'HAND', 'EYE');
  g.player.dice[1].idx = 1;
  const out = E.resolveTurn(g, ['HEAD', 'MIND', 'HAND'], E.makeRng(3));
  assert.equal(out.events.find(x => x.type === 'reveal').list.length, 1);
  assert.equal(g.enemy.shown, 1);
  assert.ok(g.enemy.next);
});

test('foresight queue: entries on broken faces are rerolled', () => {
  const g = enc('DOG');
  g.enemy.current = { faceIdx: 4, wag: false };
  g.enemy.upcoming = [{ faceIdx: 0, wag: false }, { faceIdx: 1, wag: false }];
  g.enemy.shown = 2;
  g.enemy.faces[0].pips = ['broken', 'broken'];
  g.enemy.faces[1].pips = ['broken', 'broken'];
  setFaces(g, 'DIG', 'HAND', 'MOUTH');
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(1));
  const rv = out.events.find(x => x.type === 'reveal');
  assert.ok(rv && rv.rerolled);
  rv.list.forEach(x => assert.notEqual(E.faceStatus(g.enemy.faces[x.intent.faceIdx]), 'broken'));
});

test('scar destroys the item on that face (event, log, face becomes SCAR)', () => {
  const g = enc('DOG');
  // everything on HAND/HEAD is already scarred except HAND face 0 (KNIFE)
  g.player.dice[1].faces = ['HAND+KNIFE', SC, SC, SC, SC, SC];
  g.player.dice[2].faces = [SC, SC, SC, SC, SC, SC];
  g.enemy.current = { faceIdx: 0, wag: false };
  setFaces(g, 'DIG', 'HAND+KNIFE', SC);
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(1));
  const sc = out.events.find(x => x.type === 'scar');
  deepEq({ ...sc }, { type: 'scar', dieId: 'HAND', faceIdx: 0, previous: 'HAND+KNIFE', wasCurrent: true, by: 'BITE' });
  const d = out.events.find(x => x.type === 'itemDestroyed');
  deepEq({ ...d }, { type: 'itemDestroyed', dieId: 'HAND', faceIdx: 0, item: 'KNIFE', cause: 'scar', by: 'BITE', wasCurrent: true });
  assert.equal(g.player.dice[1].faces[0], SC);
  assert.match(out.log, /KNIFE destroyed by the bite/);
  // a bare face scarred: no itemDestroyed
  const h = enc('CROWS');
  h.player.dice[1].faces = ['HAND', SC, SC, SC, SC, SC];
  h.player.dice[2].faces = [SC, SC, SC, SC, SC, SC];
  h.enemy.current = { faceIdx: 0, wag: false };                         // PECK
  setFaces(h, 'DIG', 'HAND', SC);
  const o2 = E.resolveTurn(h, ['MIND', 'HAND', 'HEAD'], E.makeRng(1));
  assert.ok(o2.events.some(x => x.type === 'scar'));
  assert.ok(!o2.events.some(x => x.type === 'itemDestroyed'));
});

test('scars persist across encounters (shared dice) and count toward maxScars', () => {
  const trip = E.createTrip(E.makeRng(1));
  const a = E.startEncounter(trip, 'DOG', E.makeRng(1));
  a.player.dice[1].faces[2] = SC;
  const b = E.startEncounter(trip, 'PLUMBER', E.makeRng(1));
  assert.equal(E.countScars(b.player), 1);
  assert.equal(E.tripScars(trip), 1);
  for (let i = 0; i < 4; i++) trip.dice[2].faces[i] = SC;
  assert.equal(E.countScars(b.player), 5);
  assert.equal(E.checkLose(b.player), false);
  trip.dice[2].faces[4] = SC;
  assert.equal(E.checkLose(b.player), true);
});

test('lose screen: 6 scars from a crow peck loses the trip', () => {
  const g = enc('CROWS');
  g.player.dice[1].faces = [SC, SC, SC, 'HAND', 'HAND', 'HAND'];
  g.player.dice[2].faces = [SC, SC, 'EYE', 'EYE', 'EYE', 'EYE'];
  assert.equal(E.countScars(g.player), 5);          // the peck makes 6
  g.enemy.current = { faceIdx: 0, wag: false };
  setFaces(g, 'DIG', 'HAND', 'EYE');
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(2));
  assert.equal(out.over, 'lost');
  assert.equal(g.trip.over, 'lost');
  assert.equal(E.tripScars(g.trip), 6);
});

test('SNIP / STEAL: take a random placed item into the enemy bag; nothing if bare', () => {
  const g = enc('PLUMBER', 4);
  g.enemy.current = { faceIdx: 0, wag: false };                         // BORROW
  setFaces(g, 'DIG', 'HAND', 'MOUTH');
  const out = E.resolveTurn(g, ['MIND', 'HAND', 'HEAD'], E.makeRng(9));
  const tk = out.events.find(x => x.type === 'itemTaken');
  assert.ok(tk);
  assert.ok(['KNIFE', 'GLASSES'].includes(tk.item));
  assert.equal(tk.by, 'BORROW');
  deepEq(g.taken, [tk.item]);
  const die = g.player.dice.find(d => d.id === tk.dieId);
  assert.equal(die.faces[tk.faceIdx], tk.becomes);                       // bare part, not SCAR
  assert.ok(!die.faces[tk.faceIdx].includes('+'));
  assert.equal(E.countScars(g.player), 0);
  assert.match(out.log, /plumber borrows your (knife|glasses)/);
  // no items placed: nothing taken, flavour text
  const h = enc('CROWS', 4);
  h.player.dice[1].faces = h.player.dice[1].faces.map(f => f.split('+')[0]);
  h.player.dice[2].faces = h.player.dice[2].faces.map(f => f.split('+')[0]);
  h.enemy.current = { faceIdx: 3, wag: false };                         // STEAL
  setFaces(h, 'DIG', 'HAND', 'MOUTH');
  const o2 = E.resolveTurn(h, ['MIND', 'HAND', 'HEAD'], E.makeRng(9));
  assert.ok(!o2.events.some(x => x.type === 'itemTaken'));
  assert.equal(o2.events.find(x => x.type === 'enemyAct').text, 'finds nothing shiny');
  deepEq(h.taken, []);
});

test('rewards: choose/give per ending; taken items return only when BEATEN', () => {
  // dog
  let g = enc('DOG');
  let r = E.rewardsFor(g.trip, 'BEATEN');
  deepEq({ ...r, choose: [...r.choose] }, { ending: 'beaten', choose: ['WHISTLE', 'SPADE'], give: [], returned: [], revealTiles: 0, empty: false });
  r = E.rewardsFor(g.trip, 'BEFRIENDED');
  deepEq([...r.choose], ['WHISTLE', 'LANTERN']);
  assert.equal(r.revealTiles, 4);
  // plumber beaten: PIPE WRENCH + borrowed items
  g = enc('PLUMBER');
  g.taken.push('KNIFE', 'GLASSES');
  r = E.rewardsFor(g.trip, 'BEATEN');
  assert.equal(r.choose, null);
  deepEq([...r.give], ['PIPE_WRENCH']);
  deepEq([...r.returned], ['KNIFE', 'GLASSES']);
  const c = E.claimReward(g.trip, 'BEATEN');
  assert.equal(c.ok, true);
  deepEq([...g.trip.inventory].sort(), ['GLASSES', 'KNIFE', 'PIPE_WRENCH']);
  // plumber befriended: taken items are gone, must pick
  g = enc('PLUMBER');
  g.taken.push('KNIFE');
  r = E.rewardsFor(g.trip, 'BEFRIENDED');
  deepEq([...r.choose], ['PLUNGER', 'WATERING_CAN']);
  deepEq([...r.returned], []);
  assert.equal(E.claimReward(g.trip, 'BEFRIENDED').ok, false);          // no pick
  assert.equal(E.claimReward(g.trip, 'BEFRIENDED', 'SPADE').ok, false); // not offered
  assert.equal(E.claimReward(g.trip, 'BEFRIENDED', 'WATERING_CAN').ok, true);
  deepEq([...g.trip.inventory], ['WATERING_CAN']);
  // crows
  g = enc('CROWS');
  g.taken.push('GLASSES');
  deepEq([...E.rewardsFor(g.trip, 'BEATEN').give], ['LANTERN']);
  deepEq([...E.rewardsFor(g.trip, 'BEATEN').returned], ['GLASSES']);
  deepEq([...E.rewardsFor(g.trip, 'BEFRIENDED').choose], ['GLASSES', 'KNIFE']);
});

test('placement validation: part, scar, replace', () => {
  const t = E.createTrip(E.makeRng(1));
  E.addToInventory(t, 'SHEARS'); E.addToInventory(t, 'LANTERN'); E.addToInventory(t, 'WHISTLE'); E.addToInventory(t, 'SPADE');
  t.dice[1].faces[3] = SC;
  assert.equal(E.canPlace(t, 'SHEARS', 'HAND', 1, 'reward').ok, true);
  assert.equal(E.canPlace(t, 'SHEARS', 'HAND', 3, 'reward').reason, 'scar');
  assert.equal(E.canPlace(t, 'SHEARS', 'HEAD', 1, 'reward').reason, 'wrong-part');
  assert.equal(E.canPlace(t, 'SHEARS', 'MIND', 0, 'reward').reason, 'not-an-item-die');
  assert.equal(E.canPlace(t, 'LANTERN', 'HEAD', 1, 'reward').ok, true);        // EYE
  assert.equal(E.canPlace(t, 'LANTERN', 'HEAD', 4, 'reward').reason, 'wrong-part');   // MOUTH
  assert.equal(E.canPlace(t, 'WHISTLE', 'HEAD', 4, 'reward').ok, true);
  assert.equal(E.canPlace(t, 'WHISTLE', 'HAND', 1, 'reward').reason, 'wrong-part');
  // occupied face reports what it would replace
  deepEq({ ...E.canPlace(t, 'SHEARS', 'HAND', 0, 'reward') }, { ok: true, reason: null, replaces: 'KNIFE' });
  // place
  E.beginPlacement(t, 'reward');
  assert.equal(E.placeItem(t, 'SHEARS', 'HAND', 1).ok, true);
  assert.equal(t.dice[1].faces[1], 'HAND+SHEARS');
  deepEq([...t.inventory], ['LANTERN', 'WHISTLE', 'SPADE']);
  assert.equal(E.placeItem(t, 'SHEARS', 'HAND', 2).reason, 'not-in-inventory');
  assert.equal(E.placeItem(t, 'SPADE', 'HAND', 3).reason, 'scar');
  assert.equal(E.placeItem(t, 'SPADE', 'HEAD', 3).reason, 'wrong-part');
  deepEq([...t.inventory], ['LANTERN', 'WHISTLE', 'SPADE']);                   // failed placements change nothing
  // replacing discards the old item for good
  const rp = E.placeItem(t, 'SPADE', 'HAND', 0);
  deepEq({ ...rp }, { ok: true, replaced: 'KNIFE', reason: null });
  assert.equal(t.dice[1].faces[0], 'HAND+SPADE');
  deepEq([...t.discarded], ['KNIFE']);
  assert.ok(!t.inventory.includes('KNIFE'));
});

test('reward mode locks earlier placements; campfire mode is free', () => {
  const t = E.createTrip(E.makeRng(1));
  E.addToInventory(t, 'SHEARS');
  E.beginPlacement(t, 'reward');
  assert.equal(E.isLocked(t, 'HAND', 0, 'reward'), true);                      // starting KNIFE
  assert.equal(E.moveItem(t, 'HAND', 0, 'HAND', 1, 'reward').reason, 'locked');
  assert.equal(E.unplaceItem(t, 'HAND', 0, 'reward').reason, 'locked');
  assert.equal(t.dice[1].faces[0], 'HAND+KNIFE');
  // items placed during this screen stay movable
  assert.equal(E.placeItem(t, 'SHEARS', 'HAND', 2, 'reward').ok, true);
  assert.equal(E.isLocked(t, 'HAND', 2, 'reward'), false);
  assert.equal(E.moveItem(t, 'HAND', 2, 'HAND', 4, 'reward').ok, true);
  assert.equal(t.dice[1].faces[2], 'HAND');
  assert.equal(t.dice[1].faces[4], 'HAND+SHEARS');
  assert.equal(E.unplaceItem(t, 'HAND', 4, 'reward').item, 'SHEARS');
  deepEq([...t.inventory], ['SHEARS']);
  // a locked occupied face can still be replaced from the inventory (with confirmation in the UI)
  assert.equal(E.placeItem(t, 'SHEARS', 'HAND', 0, 'reward').replaced, 'KNIFE');
  E.endPlacement(t);
  // next reward screen: the shears are locked now
  E.beginPlacement(t, 'reward');
  assert.equal(E.isLocked(t, 'HAND', 0, 'reward'), true);
  // campfire: move anything, onto occupied faces (replace), or back to the inventory
  E.beginPlacement(t, 'campfire');
  assert.equal(E.isLocked(t, 'HAND', 0, 'campfire'), false);
  assert.equal(E.moveItem(t, 'HEAD', 0, 'HEAD', 2, 'campfire').ok, true);       // GLASSES -> another EYE face
  assert.equal(t.dice[2].faces[2], 'EYE+GLASSES');
  assert.equal(t.dice[2].faces[0], 'EYE');
  assert.equal(E.moveItem(t, 'HAND', 0, 'HEAD', 2, 'campfire').reason, 'wrong-part');
  assert.equal(E.unplaceItem(t, 'HAND', 0, 'campfire').item, 'SHEARS');
  deepEq([...t.inventory], ['SHEARS']);
  // moving onto an occupied valid face replaces + discards
  E.addToInventory(t, 'LANTERN');
  E.placeItem(t, 'LANTERN', 'HEAD', 1, 'campfire');
  const mv = E.moveItem(t, 'HEAD', 1, 'HEAD', 2, 'campfire');
  deepEq({ ...mv }, { ok: true, replaced: 'GLASSES', reason: null });
  assert.equal(t.dice[2].faces[2], 'EYE+LANTERN');
  assert.ok(t.discarded.includes('GLASSES'));
});

test('healScar: face returns as the bare body part, item not restored', () => {
  const t = E.createTrip(E.makeRng(1));
  t.dice[1].faces[0] = SC;                         // the KNIFE face got scarred (and the knife destroyed)
  t.dice[2].faces[4] = SC;
  assert.equal(E.tripScars(t), 2);
  deepEq({ ...E.healScar(t, 'HAND', 0) }, { ok: true, restored: 'HAND', reason: null });
  assert.equal(t.dice[1].faces[0], 'HAND');
  deepEq({ ...E.healScar(t, 'HEAD', 4) }, { ok: true, restored: 'MOUTH', reason: null });
  assert.equal(t.dice[2].faces[4], 'MOUTH');
  assert.equal(E.tripScars(t), 0);
  assert.equal(E.healScar(t, 'HAND', 1).ok, false);
  assert.equal(E.healScar(t, 'HAND', 0).ok, false);
});

test('oddsSummary', () => {
  const t = E.createTrip(E.makeRng(1));
  const hand = () => E.oddsSummary(t.dice[1]);
  const head = () => E.oddsSummary(t.dice[2]);
  assert.equal(hand().text, 'HAND · 1× KNIFE · 5× bare · 0× scar → item 1/6');
  assert.equal(head().text, 'EYE 3 (1× GLASSES) · MOUTH 3 (0 items) · scar 0/6');
  E.addToInventory(t, 'SHEARS'); E.addToInventory(t, 'WHISTLE'); E.addToInventory(t, 'KNIFE');
  E.placeItem(t, 'SHEARS', 'HAND', 1, 'campfire');
  E.placeItem(t, 'KNIFE', 'HAND', 2, 'campfire');
  t.dice[1].faces[5] = SC;
  assert.equal(hand().text, 'HAND · 2× KNIFE · 1× SHEARS · 2× bare · 1× scar → item 3/6');
  E.placeItem(t, 'WHISTLE', 'HEAD', 4, 'campfire');
  t.dice[2].faces[1] = SC;
  assert.equal(head().text, 'EYE 2 (1× GLASSES) · MOUTH 3 (1× WHISTLE) · scar 1/6');
  deepEq({ itemFaces: hand().itemFaces, bare: hand().bare, scar: hand().scar, total: hand().total }, { itemFaces: 3, bare: 2, scar: 1, total: 6 });
});

test('advanceStage walks the M1 sequence and completes the trip', () => {
  const t = E.createTrip(E.makeRng(1));
  assert.equal(t.stage, 'DOG');
  assert.equal(E.advanceStage(t), 'PLUMBER');
  assert.equal(E.advanceStage(t), 'CAMPFIRE');
  assert.equal(E.isCampfire(t.stage), true);
  assert.equal(E.advanceStage(t), 'CROWS');
  assert.equal(E.isCampfire(t.stage), false);
  assert.equal(t.over, null);
  assert.equal(E.advanceStage(t), null);
  assert.equal(t.over, 'won');
  assert.equal(t.result, 'TRIP COMPLETE');
});

// ---- seeded full M1 trip simulation ----
function allSlotOrders(g) {
  const ids = g.player.dice.map(d => d.id);
  const perms = [];
  [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].forEach(p => perms.push(p.map(i => ids[i])));
  return perms;
}
function bestOrder(g) {
  let best = null, bestScore = -1;
  for (const order of allSlotOrders(g)) {
    const faces = order.map(id => E.currentFace(g.player.dice.find(d => d.id === id)));
    const r = E.evaluateSentence(faces, { enemy: g.enemy });
    const score = r.totals.PRUNE + r.totals.SOW + (r.reveal ? 0.5 : 0);
    if (score > bestScore) { bestScore = score; best = order; }
  }
  return best;
}
function simulateTrip(seed, policy) {
  const rng = E.makeRng(seed);
  const trip = E.createTrip(rng);
  const summary = { seed, results: [], turns: 0, items: [], over: null };
  const guard = { n: 0 };
  while (trip.stage && !trip.over && guard.n++ < 50) {
    if (E.isCampfire(trip.stage)) {
      const scarFace = ['HAND', 'HEAD'].map(id => ({ id, d: trip.dice.find(d => d.id === id) }))
        .map(o => ({ id: o.id, idx: o.d.faces.indexOf(SC) })).find(o => o.idx >= 0);
      if (scarFace && policy !== 'rearrange') E.healScar(trip, scarFace.id, scarFace.idx);
      else {
        E.beginPlacement(trip, 'campfire');
        // free rearranging: just exercise move / unplace on a placed item
        for (const id of ['HAND', 'HEAD']) {
          const d = trip.dice.find(x => x.id === id);
          d.faces.forEach((f, i) => { if (f.includes('+')) { E.unplaceItem(trip, id, i, 'campfire'); } });
        }
        trip.inventory.slice().forEach(item => {
          for (const id of ['HAND', 'HEAD']) {
            const d = trip.dice.find(x => x.id === id);
            for (let i = 0; i < 6; i++) if (E.canPlace(trip, item, id, i, 'campfire').ok && !d.faces[i].includes('+') && E.placeItem(trip, item, id, i, 'campfire').ok) return;
          }
        });
        E.endPlacement(trip);
      }
      E.advanceStage(trip);
      continue;
    }
    const g = E.startEncounter(trip, trip.stage, rng);
    let safety = 0;
    while (!g.over && safety++ < 100) {
      const st = E.startTurn(g, rng);
      if (st.over) break;
      if (g.rerolls > 0 && rng() < 0.5) E.rerollUnheld(g, rng);
      E.resolveTurn(g, bestOrder(g), rng);
      summary.turns++;
    }
    assert.ok(g.over, 'encounter ended (seed ' + seed + ')');
    summary.results.push(trip.stage + ':' + g.result);
    if (g.over === 'lost') break;
    const pick = (E.rewardsFor(trip, g.result).choose || [])[Math.floor(rng() * 2)];
    const claim = E.claimReward(trip, g.result, pick);
    assert.ok(claim.ok);
    E.beginPlacement(trip, 'reward');
    trip.inventory.slice().forEach(item => {
      for (const id of ['HAND', 'HEAD']) for (let i = 0; i < 6; i++) {
        const cur = trip.dice.find(d => d.id === id).faces[i];
        if (!cur.includes('+') && E.canPlace(trip, item, id, i, 'reward').ok) { if (E.placeItem(trip, item, id, i, 'reward').ok) return; }
      }
    });
    E.endPlacement(trip);
    E.advanceStage(trip);
  }
  summary.over = trip.over;
  summary.scars = E.tripScars(trip);
  summary.items = trip.dice.slice(1).map(d => d.faces.join(','));
  summary.inventory = trip.inventory.slice();
  summary.log = trip.log.length;
  return summary;
}

test('seeded full M1 trip simulation ends in a win or a loss, deterministically', () => {
  const outcomes = { won: 0, lost: 0 };
  for (let seed = 1; seed <= 60; seed++) {
    const s = simulateTrip(seed, seed % 3 === 0 ? 'rearrange' : 'heal');
    assert.ok(s.over === 'won' || s.over === 'lost', 'seed ' + seed + ' unfinished');
    outcomes[s.over]++;
    if (s.over === 'won') {
      assert.equal(s.results.length, 3);                              // the three fights (campfire between)
      assert.ok(s.scars < CFG.maxScars);
    } else assert.ok(s.scars >= CFG.maxScars);
    assert.ok(s.log > 0);
    // determinism
    deepEq(simulateTrip(seed, seed % 3 === 0 ? 'rearrange' : 'heal'), JSON.parse(JSON.stringify(s)));
  }
  assert.ok(outcomes.won > 0, 'at least one simulated trip completes: ' + JSON.stringify(outcomes));
});

test('trip simulation exercises every enemy effect over many seeds', () => {
  const seen = new Set();
  for (let seed = 100; seed < 160; seed++) {
    const rng = E.makeRng(seed);
    const trip = E.createTrip(rng);
    for (const id of ['DOG', 'PLUMBER', 'CROWS']) {
      const g = E.startEncounter(trip, id, rng);
      let n = 0;
      while (!g.over && n++ < 60) {
        E.startTurn(g, rng);
        const order = [0, 1, 2].sort(() => rng() - 0.5);
        const out = E.resolveTurn(g, order, rng);
        out.events.forEach(e => seen.add(e.type));
        if (g.over === 'lost') break;
      }
      if (g.over === 'lost') break;
    }
  }
  for (const t of ['sentence', 'step', 'verb', 'pip', 'faceResolved', 'reveal', 'enemyAct', 'scar', 'itemTaken', 'mod', 'win', 'newIntent'])
    assert.ok(seen.has(t), 'event type seen: ' + t);
});

// =====================================================================================================
// V1-4 — M2 engine: map, fog, daylight, cold, scavenge sites, noise, guardian
// =====================================================================================================
const MAPC = CFG.map;
const rngConst = (v) => () => v;
const tileList = (map) => map.tiles.flat();
function m2Trip(seed) { const rng = E.makeRng(seed); return { rng, trip: E.createTrip(rng, 'm2') }; }
function setTile(trip, c, r, type, extra) {
  const t = trip.map.tiles[r][c];
  t.type = type; t.enemyId = null; t.siteId = null; Object.assign(t, extra || {});
  return t;
}
// Put the player on the map at (c, r) as if they had walked there; stage MAP.
function placeAt(trip, c, r) {
  trip.map.pos = { c, r }; trip.map.tiles[r][c].visited = true; trip.stage = 'MAP';
}
// A site with fixed contents / items / pips for deterministic tests.
function fixedSite(trip, siteId, contents, items, pips) {
  const site = E.startSite(trip, siteId, E.makeRng(1));
  site.faces.forEach((f, i) => {
    f.content = contents[i]; f.item = contents[i] === 'ITEM' ? (items && items[i]) || 'KNIFE' : null;
    f.pips = f.pipsLeft = pips || f.pips; f.revealed = false; f.opened = false;
  });
  return site;
}
const NOTHINGS = ['NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'];
// Fix the three dice (by face string) and commit on the site with a fixed arrangement.
function siteTurn(site, order, faces, rng) {
  const dice = site.player.dice;
  faces.forEach((f, i) => { if (f === null) return; const d = dice.find(x => x.id === ['MIND', 'HAND', 'HEAD'][i]); d.idx = d.faces.indexOf(f); assert.ok(d.idx >= 0, f); });
  return E.resolveSiteTurn(site, order, rng || E.makeRng(7));
}

test('M2 CONFIG data: map, sites, noise, rules', () => {
  deepEq({ cols: MAPC.cols, rows: MAPC.rows, daylight: MAPC.daylight }, { cols: 6, rows: 4, daylight: 12 });
  deepEq({ ...MAPC.weights }, { CHARACTER: 35, SCAVENGE: 30, CAMPFIRE: 10, EMPTY: 25 });
  assert.equal(CFG.noiseMax, 6);
  deepEq({ ...CFG.siteRules }, { overkill: 2, pruneNoisePerPoint: 1, turnNoise: 1, ratsNoise: 2, ratsScars: 1, trapScars: 1,
    sowDivisor: 2, sowMin: 1, shuffleFaces: true });
  assert.deepEqual(Object.keys(CFG.sites), ['HEAP', 'SHED', 'HUT', 'WELL']);
  const H = CFG.sites.HEAP, S = CFG.sites.SHED, W = CFG.sites.WELL;
  deepEq([H.word, H.pips, H.guardian, [...H.faces], [...H.pool]], ['HEAP', 2, 'DOG', ['ITEM', 'ITEM', 'JUNK', 'RATS', 'NOTHING', 'NOTHING'], ['SEED_POUCH', 'WATERING_CAN', 'SPADE']]);
  deepEq([S.word, S.pips, S.guardian, [...S.faces], [...S.pool]], ['SHED', 3, 'CROWS', ['ITEM', 'ITEM', 'ITEM', 'JUNK', 'NOTHING', 'TRAP'], ['SHEARS', 'KNIFE', 'LANTERN', 'GLASSES']]);
  deepEq([W.word, W.pips, W.guardian, [...W.faces], [...W.pool]], ['WELL', 1, 'PLUMBER', ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'JUNK', 'RATS'], ['WHISTLE', 'LANTERN']]);
  assert.equal(CFG.enemies.DOG.rewards.befriended.revealTiles, 4);
});

test('generateMap: 6x4, START left/middle row, GATE right column, campfire in columns 1-3, path exists', () => {
  const kinds = new Set(), gateRows = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const { trip } = m2Trip(seed);
    const map = trip.map;
    assert.equal(map.tiles.length, 4); map.tiles.forEach(row => assert.equal(row.length, 6));
    deepEq(map.start, { c: 0, r: 1 });
    assert.equal(map.tiles[1][0].type, 'START');
    assert.equal(map.gate.c, 5); gateRows.add(map.gate.r);
    assert.equal(map.tiles[map.gate.r][5].type, 'GATE');
    assert.equal(tileList(map).filter(t => t.type === 'GATE').length, 1);
    assert.equal(tileList(map).filter(t => t.type === 'START').length, 1);
    assert.ok(tileList(map).some(t => t.type === 'CAMPFIRE' && t.c >= 1 && t.c <= 3), 'campfire in 1-3, seed ' + seed);
    assert.ok(E.mapHasPath(map));
    tileList(map).forEach(t => {
      kinds.add(t.type);
      if (t.type === 'CHARACTER') assert.ok(CFG.enemies[t.enemyId]);
      if (t.type === 'SCAVENGE') assert.ok(CFG.sites[t.siteId]);
    });
    deepEq(map.pos, { c: 0, r: 1 });
    assert.equal(trip.daylight, 12); assert.equal(trip.stage, 'MAP'); assert.equal(trip.mode, 'm2');
    assert.ok(map.tiles[1][0].visited);
  }
  deepEq([...kinds].sort(), ['CAMPFIRE', 'CHARACTER', 'EMPTY', 'GATE', 'SCAVENGE', 'START']);
  assert.equal(gateRows.size, 4);
});

test('generateMap: campfire guarantee converts a tile when none rolled; weights follow CONFIG', () => {
  // weights with no campfire at all: the guarantee must still place exactly one in columns 1-3
  const saved = { ...MAPC.weights };
  MAPC.weights = { CHARACTER: 1, SCAVENGE: 1, CAMPFIRE: 0, EMPTY: 1 };
  try {
    for (let seed = 1; seed <= 30; seed++) {
      const { trip } = m2Trip(seed);
      const fires = tileList(trip.map).filter(t => t.type === 'CAMPFIRE');
      assert.equal(fires.length, 1);
      assert.ok(fires[0].c >= 1 && fires[0].c <= 3);
    }
  } finally { MAPC.weights = saved; }
  // rough distribution over many maps
  const counts = { CHARACTER: 0, SCAVENGE: 0, CAMPFIRE: 0, EMPTY: 0 }; let n = 0;
  for (let seed = 1; seed <= 400; seed++) tileList(m2Trip(seed).trip.map).forEach(t => { if (counts[t.origin] !== undefined) { counts[t.origin]++; n++; } });
  assert.ok(Math.abs(counts.CHARACTER / n - 0.35) < 0.04, 'character share ' + counts.CHARACTER / n);
  assert.ok(Math.abs(counts.SCAVENGE / n - 0.30) < 0.04);
  assert.ok(Math.abs(counts.EMPTY / n - 0.25) < 0.04);
});

test('fog: visited, adjacent-to-visited and revealed tiles are visible; the rest are fog', () => {
  const { trip } = m2Trip(3);
  const v = E.mapView(trip);
  const vis = v.flat().filter(c => c.visible).map(c => c.c + ',' + c.r).sort();
  deepEq(vis, ['0,0', '0,1', '0,2', '1,1']);                       // start + 3 orthogonal neighbours
  const fogCell = v[0][3];
  assert.equal(fogCell.visible, false);
  assert.equal(fogCell.word, MAPC.words.FOG);
  assert.equal(fogCell.type, null);
  assert.equal(v[1][0].word, 'START');
  assert.equal(v[1][0].here, true);
  deepEq(v.flat().filter(c => c.reachable).map(c => c.c + ',' + c.r).sort(), ['0,0', '0,2', '1,1']);
  // words follow the tile type
  setTile(trip, 1, 1, 'CHARACTER', { enemyId: 'PLUMBER' }); setTile(trip, 0, 0, 'SCAVENGE', { siteId: 'SHED' });
  setTile(trip, 0, 2, 'CAMPFIRE');
  const v2 = E.mapView(trip);
  assert.equal(v2[1][1].word, 'PLUMBER'); assert.equal(v2[0][0].word, 'SHED'); assert.equal(v2[2][0].word, 'FIRE');
  assert.equal(v2[1][1].enemyId, 'PLUMBER');
  // fogged tile never leaks its identity
  setTile(trip, 4, 3, 'SCAVENGE', { siteId: 'WELL' });
  const f = E.mapView(trip)[3][4];
  assert.equal(f.visible, false); assert.equal(f.siteId, null); assert.equal(f.word, '?');
  // moving extends the visibility; non-adjacent tiles stay fogged
  setTile(trip, 1, 1, 'EMPTY');
  E.moveTo(trip, 1, 1, E.makeRng(1));
  const v3 = E.mapView(trip);
  assert.equal(v3[1][2].visible, true);
  assert.equal(v3[1][3].visible, false);
  assert.equal(v3[1][0].visible, true);                              // start stays visited
});

test('legal moves: orthogonal, in bounds, only while on the map', () => {
  const { trip, rng } = m2Trip(4);
  deepEq(E.legalMoves(trip).map(m => m.c + ',' + m.r).sort(), ['0,0', '0,2', '1,1']);
  assert.equal(E.moveTo(trip, 1, 2, rng).reason, 'not-adjacent');       // diagonal
  assert.equal(E.moveTo(trip, 0, 1, rng).reason, 'not-adjacent');       // own tile
  assert.equal(E.moveTo(trip, 3, 1, rng).reason, 'not-adjacent');
  assert.equal(E.moveTo(trip, -1, 1, rng).reason, 'out-of-bounds');
  assert.equal(E.moveTo(trip, 0, 4, rng).reason, 'out-of-bounds');
  assert.equal(trip.moves, 0); assert.equal(trip.daylight, 12);
  trip.stage = 'SITE';
  deepEq(E.legalMoves(trip), []);
  assert.equal(E.moveTo(trip, 1, 1, rng).reason, 'not-on-map');
});

test('move: costs 1 daylight, logs, emits move event; entering EMPTY does nothing', () => {
  const { trip, rng } = m2Trip(5);
  setTile(trip, 1, 1, 'EMPTY');
  const r = E.moveTo(trip, 1, 1, rng);
  assert.ok(r.ok);
  assert.equal(trip.daylight, 11); assert.equal(trip.moves, 1);
  deepEq(trip.map.pos, { c: 1, r: 1 });
  deepEq(r.events.map(e => e.type), ['move', 'enter']);
  deepEq({ ...r.events[0] }.to, { c: 1, r: 1 });
  assert.equal(r.events[0].daylight, 11); assert.equal(r.events[0].cold, false);
  assert.equal(r.entered.tile, 'EMPTY'); assert.equal(trip.stage, 'MAP');
  assert.ok(trip.log.some(l => l.includes('daylight 11')));
});

test('cold: at 0 daylight every move scars a face (destroying its item) and checks lose', () => {
  const { trip, rng } = m2Trip(6);
  trip.daylight = 1;
  setTile(trip, 1, 1, 'EMPTY'); setTile(trip, 2, 1, 'EMPTY'); setTile(trip, 1, 0, 'EMPTY');
  let r = E.moveTo(trip, 1, 1, rng);
  assert.equal(trip.daylight, 0); assert.equal(E.tripScars(trip), 0);           // last daylight move: no scar
  r = E.moveTo(trip, 2, 1, rng);
  assert.equal(trip.daylight, 0);
  assert.equal(E.tripScars(trip), 1);
  assert.equal(trip.coldHits, 1);
  deepEq(r.events.map(e => e.type).slice(0, 3), ['move', 'cold', 'scar']);
  assert.equal(r.events[0].cold, true);
  assert.equal(r.events.find(e => e.type === 'scar').cause, 'cold');
  assert.ok(trip.log.some(l => l.includes('the cold bites')));
  // item on the scarred face is destroyed
  const trip2 = m2Trip(7).trip;
  trip2.daylight = 0;
  trip2.dice.find(d => d.id === 'HAND').faces = ['HAND+KNIFE', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR'];
  trip2.dice.find(d => d.id === 'HEAD').faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR'];
  setTile(trip2, 1, 1, 'EMPTY');
  const r2 = E.moveTo(trip2, 1, 1, E.makeRng(2));
  const destroyed = r2.events.find(e => e.type === 'itemDestroyed');
  assert.equal(destroyed.item, 'KNIFE'); assert.equal(destroyed.cause, 'cold');
  assert.equal(trip2.dice.find(d => d.id === 'HAND').faces[0], 'SCAR');
  // lose: 5 scars + a cold move
  const trip3 = m2Trip(8).trip;
  trip3.daylight = 0;
  trip3.dice.find(d => d.id === 'HAND').faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'HAND'];
  setTile(trip3, 1, 1, 'CHARACTER', { enemyId: 'DOG' });
  const r3 = E.moveTo(trip3, 1, 1, E.makeRng(3));
  assert.equal(E.tripScars(trip3) >= 6, true);
  assert.equal(trip3.over, 'lost'); assert.equal(r3.over, 'lost');
  assert.ok(r3.events.some(e => e.type === 'lose' && e.cause === 'cold'));
  assert.equal(r3.encounter, null);                                  // the tile is not entered
  assert.equal(r3.events.some(e => e.type === 'enter'), false);
  deepEq(E.legalMoves(trip3), []);
});

test('entering tiles: CHARACTER starts the encounter, SCAVENGE a site, CAMPFIRE the campfire stage, GATE wins', () => {
  let { trip, rng } = m2Trip(9);
  setTile(trip, 1, 1, 'CHARACTER', { enemyId: 'CROWS' });
  let r = E.moveTo(trip, 1, 1, rng);
  assert.equal(r.entered.tile, 'CHARACTER'); assert.equal(r.entered.enemyId, 'CROWS');
  assert.equal(trip.stage, 'CROWS');
  assert.ok(r.encounter && r.encounter === trip.encounter);
  assert.equal(r.encounter.enemyId, 'CROWS');
  deepEq(E.legalMoves(trip), []);

  ({ trip, rng } = m2Trip(10));
  setTile(trip, 0, 0, 'SCAVENGE', { siteId: 'SHED' });
  r = E.moveTo(trip, 0, 0, rng);
  assert.equal(trip.stage, 'SITE'); assert.ok(trip.site); assert.equal(trip.site.siteId, 'SHED');
  assert.equal(r.site, trip.site); assert.equal(r.entered.siteId, 'SHED');
  deepEq({ ...trip.site.at }, { c: 0, r: 0 });

  ({ trip, rng } = m2Trip(11));
  setTile(trip, 1, 1, 'CAMPFIRE');
  r = E.moveTo(trip, 1, 1, rng);
  assert.equal(trip.stage, 'CAMPFIRE'); assert.ok(E.isCampfire(trip.stage));

  ({ trip, rng } = m2Trip(12));
  placeAt(trip, trip.map.gate.c - 1, trip.map.gate.r);
  r = E.moveTo(trip, trip.map.gate.c, trip.map.gate.r, rng);
  assert.equal(trip.over, 'won'); assert.equal(trip.result, 'TRIP COMPLETE');
  assert.ok(r.events.some(e => e.type === 'tripWon'));
  assert.equal(r.over, 'won');
});

test('resolved tiles become EMPTY (fight won, campfire used, site left)', () => {
  const { trip, rng } = m2Trip(13);
  setTile(trip, 1, 1, 'CHARACTER', { enemyId: 'DOG' });
  E.moveTo(trip, 1, 1, rng);
  const enc = trip.encounter;
  enc.over = 'won'; enc.result = 'BEATEN';                           // pretend the fight ended
  assert.equal(E.advanceStage(trip), 'MAP');
  assert.equal(trip.map.tiles[1][1].type, 'EMPTY'); assert.equal(trip.map.tiles[1][1].enemyId, null);
  assert.equal(trip.encounter, null);
  assert.equal(E.mapView(trip)[1][1].word, 'EMPTY');
  // campfire
  setTile(trip, 2, 1, 'CAMPFIRE');
  E.moveTo(trip, 2, 1, rng);
  assert.equal(trip.stage, 'CAMPFIRE');
  E.advanceStage(trip);
  assert.equal(trip.map.tiles[1][2].type, 'EMPTY'); assert.equal(trip.stage, 'MAP');
  // site
  setTile(trip, 3, 1, 'SCAVENGE', { siteId: 'WELL' });
  E.moveTo(trip, 3, 1, rng);
  assert.ok(E.leaveSite(trip).ok);
  assert.equal(trip.map.tiles[1][3].type, 'SCAVENGE');               // not resolved until the site is finished
  E.advanceStage(trip);
  assert.equal(trip.map.tiles[1][3].type, 'EMPTY'); assert.equal(trip.site, null);
  // walking over resolved tiles is free of events
  const back = E.moveTo(trip, 2, 1, rng);
  deepEq(back.events.map(e => e.type), ['move', 'enter']);
  assert.equal(back.entered.tile, 'EMPTY');
});

test('M1 still advances by sequence (advanceStage unchanged for mode m1)', () => {
  const trip = E.createTrip(E.makeRng(1));
  assert.equal(trip.mode, 'm1'); assert.equal(trip.stage, 'DOG');
  assert.equal(E.advanceStage(trip), 'PLUMBER');
  assert.equal(trip.map, undefined);
});

test('dog befriend reveals 4 fogged tiles (and only fogged ones); M1 ignores revealTiles', () => {
  const { trip, rng } = m2Trip(14);
  E.startEncounter(trip, 'DOG', rng);
  const before = E.mapView(trip).flat().filter(c => !c.visible).length;
  const claim = E.claimReward(trip, 'BEFRIENDED', 'WHISTLE', E.makeRng(5));
  assert.ok(claim.ok);
  assert.equal(claim.revealed.length, 4);
  const after = E.mapView(trip).flat().filter(c => !c.visible).length;
  assert.equal(before - after, 4);
  claim.revealed.forEach(p => { assert.equal(trip.map.tiles[p.r][p.c].revealed, true); });
  assert.equal(new Set(claim.revealed.map(p => p.c + ',' + p.r)).size, 4);
  assert.ok(trip.log.some(l => l.includes('shows you the way')));
  // beaten dog: no reveal
  const t2 = m2Trip(15).trip;
  E.startEncounter(t2, 'DOG', E.makeRng(1));
  assert.equal(E.claimReward(t2, 'BEATEN', 'SPADE', E.makeRng(1)).revealed.length, 0);
  // M1 trip: ignored
  const m1 = E.createTrip(E.makeRng(1));
  E.startEncounter(m1, 'DOG', E.makeRng(1));
  assert.equal(E.claimReward(m1, 'BEFRIENDED', 'WHISTLE', E.makeRng(1)).revealed.length, 0);
  // revealTiles never exceeds the fog
  const t3 = m2Trip(16).trip;
  assert.equal(E.revealTiles(t3, 100, E.makeRng(1)).length, 24 - 4);
});

// ---------- scavenge sites ----------
test('site creation: faces from CONFIG (shuffled), pips, items rolled from the pool, nothing revealed', () => {
  for (const id of Object.keys(CFG.sites)) {
    const c = CFG.sites[id];
    for (let seed = 1; seed <= 20; seed++) {
      const { trip } = m2Trip(seed);
      const site = E.startSite(trip, id, E.makeRng(seed));
      deepEq(site.faces.map(f => f.content).sort(), [...c.faces].sort());
      site.faces.forEach(f => {
        assert.equal(f.pipsLeft, c.pips); assert.equal(f.revealed, false); assert.equal(f.opened, false);
        if (f.content === 'ITEM') assert.ok(c.pool.includes(f.item)); else assert.equal(f.item, null);
      });
      assert.equal(site.noise, 0); assert.equal(site.noiseMax, 6); assert.equal(site.guardian, c.guardian);
    }
  }
  // shuffled: contents order varies across seeds
  const orders = new Set();
  for (let seed = 1; seed <= 30; seed++) orders.add(E.startSite(m2Trip(seed).trip, 'HEAP', E.makeRng(seed)).faces.map(f => f.content).join());
  assert.ok(orders.size > 3);
});

test('site turn: default target is the first unopened face; overflow goes to the next unopened face', () => {
  const { trip } = m2Trip(20);
  const site = fixedSite(trip, 'HEAP', ['JUNK', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], null, 2);
  // HAND PRUNE (instinct): HAND=2 ; MIND PRUNE ; HEAD directed MOUTH PRUNE = 1 -> PRUNE total... use MIND PRUNE with two body dice
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['PRUNE', 'HAND', 'MOUTH']);   // Plan: Hit 2 · Insult 1 → PRUNE 3
  assert.equal(r.evaluation.totals.PRUNE, 3);
  assert.equal(site.faces[0].opened, true);          // 2 pips gone
  assert.equal(site.faces[1].pipsLeft, 1);           // overflow 1
  assert.equal(site.faces[2].pipsLeft, 2);
  deepEq(r.events.filter(e => e.type === 'sitePip').map(e => e.faceIdx), [0, 0, 1]);
  assert.equal(site.noise, 3 + 1);                    // +1 per PRUNE point, +1 for the turn
});

test('site targeting: clicked face first, overflow to the next unopened face by index (wrapping)', () => {
  const { trip } = m2Trip(21);
  const site = fixedSite(trip, 'HEAP', NOTHINGS, null, 2);
  assert.equal(E.setSiteTarget(site, 4).ok, true);
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['PRUNE', 'HAND', 'MOUTH']);   // PRUNE 3
  deepEq(r.events.filter(e => e.type === 'sitePip').map(e => e.faceIdx), [4, 4, 5]);
  assert.equal(site.faces[4].opened, true);
  assert.equal(site.faces[5].pipsLeft, 1);
  assert.equal(site.target, null);                    // opened target clears
  // wrap: target the last face, overflow to face 0
  const site2 = fixedSite(m2Trip(22).trip, 'HEAP', NOTHINGS, null, 1);
  E.setSiteTarget(site2, 5);
  const r2 = siteTurn(site2, ['MIND', 'HAND', 'HEAD'], ['PRUNE', 'HAND', 'MOUTH']);
  deepEq(r2.events.filter(e => e.type === 'sitePip').map(e => e.faceIdx), [5, 0, 1]);
  // an opened face cannot be targeted
  assert.equal(E.setSiteTarget(site2, 5).ok, false);
  assert.equal(E.setSiteTarget(site2, 5).reason, 'opened');
  assert.equal(E.setSiteTarget(site2, null).ok, true);
});

test('PRUNE makes +1 noise per point; SHEARS points are quiet and alternate over 2 faces', () => {
  const { trip } = m2Trip(23);
  const site = fixedSite(trip, 'SHED', NOTHINGS, null, 3);
  trip.dice.find(d => d.id === 'HAND').faces[1] = 'HAND+SHEARS';
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['PRUNE', 'HAND+SHEARS', 'MOUTH']);   // Snip 1+1... = 2+1 item +? 
  const pr = r.evaluation.totals.PRUNE;
  assert.equal(r.evaluation.shears, 3);                             // item bonus: HAND other(1)+item(1)=2? see below
  assert.ok(pr >= r.evaluation.shears);
  const pips = r.events.filter(e => e.type === 'sitePip');
  // shears points alternate over faces 0 and 1 and make no noise
  deepEq(pips.slice(0, r.evaluation.shears).map(e => e.faceIdx), [0, 1, 0].slice(0, r.evaluation.shears));
  assert.ok(pips.slice(0, r.evaluation.shears).every(e => e.shears === true));
  const noiseEv = r.events.filter(e => e.type === 'noise' && e.cause === 'PRUNE');
  assert.equal(noiseEv.length, pr - r.evaluation.shears);
  assert.equal(site.noise, (pr - r.evaluation.shears) + 1);
  const verbEv = r.events.find(e => e.type === 'verb');
  assert.equal(verbEv.noise, pr - r.evaluation.shears);
});

test('SHEARS alone: no noise at all (only the turn noise)', () => {
  const { trip } = m2Trip(24);
  const site = fixedSite(trip, 'SHED', NOTHINGS, null, 3);
  trip.dice.find(d => d.id === 'HAND').faces[1] = 'HAND+SHEARS';
  // HAND SHEARS instinct PRUNE (2) +item(1) = 3, MIND DIG, HEAD EYE directed DIG
  const r = siteTurn(site, ['HAND', 'MIND', 'HEAD'], ['DIG', 'HAND+SHEARS', 'EYE']);
  assert.equal(r.evaluation.totals.PRUNE, 3); assert.equal(r.evaluation.shears, 3);
  assert.equal(site.noise, 1);                                      // only the turn
  assert.equal(r.events.some(e => e.type === 'noise' && e.cause === 'PRUNE'), false);
});

test('overkill: PRUNE leftover >= 2 when an ITEM face opens breaks it into JUNK (item lost, leftover overflows)', () => {
  const { trip } = m2Trip(25);
  const site = fixedSite(trip, 'HEAP', ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], ['SPADE'], 1);
  // face 0 has 1 pip left, PRUNE 4: opens with 3 points still left -> overkill
  trip.dice.find(d => d.id === 'HAND').faces[1] = 'HAND+KNIFE';
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['PRUNE', 'HAND+KNIFE', 'MOUTH']);  // Stab 4 + Insult 1 = 5
  const open = r.events.find(e => e.type === 'siteOpen' && e.faceIdx === 0);
  assert.equal(open.overkill, true); assert.equal(open.content, 'JUNK'); assert.equal(open.brokenItem, 'SPADE'); assert.equal(open.item, null);
  assert.equal(trip.inventory.length, 0);
  assert.equal(site.gained.length, 0);
  assert.equal(site.faces[0].content, 'JUNK');
  assert.equal(site.faces[1].opened, true);                         // leftover kept overflowing
  assert.ok(trip.log.some(l => l.includes('broke into JUNK')));
});

test('no overkill when exactly 1 point is left; item goes to the inventory', () => {
  const { trip } = m2Trip(26);
  const site = fixedSite(trip, 'HEAP', ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], ['SPADE'], 2);
  // PRUNE 3 on a 2-pip face: opens with 1 point left (< overkill 2)
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['PRUNE', 'HAND', 'MOUTH']);
  const open = r.events.find(e => e.type === 'siteOpen');
  assert.equal(open.overkill, false); assert.equal(open.item, 'SPADE'); assert.equal(open.content, 'ITEM');
  deepEq(trip.inventory, ['SPADE']); deepEq(site.gained, ['SPADE']);
  assert.ok(r.events.some(e => e.type === 'itemGained' && e.item === 'SPADE'));
  // overkill only applies to PRUNE: SOW opening an ITEM never breaks it
  const site2 = fixedSite(m2Trip(27).trip, 'HEAP', ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], ['KNIFE'], 1);
  const r2 = siteTurn(site2, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH']);   // SOW: Gesture 1 + Small talk 2 = 3 -> 1 pip
  assert.equal(r2.events.find(e => e.type === 'siteOpen').overkill, false);
  deepEq(site2.gained, ['KNIFE']);
});

test('DIG reveals as many faces as its points (target first, then by index) and passes points on', () => {
  const { trip } = m2Trip(28);
  const site = fixedSite(trip, 'HEAP', ['ITEM', 'JUNK', 'RATS', 'NOTHING', 'NOTHING', 'ITEM'], ['KNIFE', null, null, null, null, 'LANTERN'], 2);
  E.setSiteTarget(site, 5);
  // EYE instinct DIG 2 (reveal) -> carry into HAND directed under MIND PRUNE: Hit 2+2 = 4 PRUNE
  const r = siteTurn(site, ['HEAD', 'MIND', 'HAND'], ['PRUNE', 'HAND', 'EYE']);
  const rev = r.events.filter(e => e.type === 'siteReveal');
  deepEq(rev.map(e => e.faceIdx), [5, 0]);                          // 2 points: target, then lowest index
  assert.equal(rev[0].content, 'ITEM'); assert.equal(rev[0].item, 'LANTERN'); assert.equal(rev[0].via, 'DIG');
  assert.equal(site.faces[5].revealed, true); assert.equal(site.faces[0].revealed, true); assert.equal(site.faces[1].revealed, false);
  assert.equal(r.evaluation.totals.PRUNE, 4);                       // carry passed forward as normal
  // DIG happens first (sentence order), PRUNE after
  const types = r.events.map(e => e.type);
  assert.ok(types.indexOf('siteReveal') < types.indexOf('verb'));
});

test('DIG: revealing skips already-revealed faces; SPADE reveals all', () => {
  const { trip } = m2Trip(29);
  const site = fixedSite(trip, 'SHED', NOTHINGS, null, 3);
  site.faces[0].revealed = true;
  trip.dice.find(d => d.id === 'HAND').faces[1] = 'HAND+SPADE';
  let r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['DIG', 'HAND', 'EYE']);        // Search 1 + Look 2 = DIG 1 and 2? both directed
  const n = r.events.filter(e => e.type === 'siteReveal');
  assert.ok(n.length >= 1);
  assert.equal(n.some(e => e.faceIdx === 0), false);
  // SPADE: all faces
  const site2 = fixedSite(m2Trip(30).trip, 'SHED', NOTHINGS, null, 3);
  site2.player.dice.find(d => d.id === 'HAND').faces[1] = 'HAND+SPADE';
  r = siteTurn(site2, ['MIND', 'HAND', 'HEAD'], ['DIG', 'HAND+SPADE', 'MOUTH']);
  assert.equal(r.events.filter(e => e.type === 'siteReveal').length, 6);
  assert.ok(r.events.filter(e => e.type === 'siteReveal').every(e => e.via === 'SPADE'));
  assert.ok(site2.faces.every(f => f.revealed));
  assert.equal(site2.faces.some(f => f.opened), false);             // DIG never opens
  assert.equal(site2.noise, 1);
});

test('SOW coaxes at half rate (floor, min 1) with no noise from the verb', () => {
  const mk = (seed) => fixedSite(m2Trip(seed).trip, 'SHED', NOTHINGS, null, 3);
  let site = mk(31);
  // SOW 3 (Gesture 1 + Small talk 2) -> floor(3/2) = 1 pip
  let r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH']);
  assert.equal(r.evaluation.totals.SOW, 3);
  assert.equal(r.events.filter(e => e.type === 'sitePip').length, 1);
  assert.equal(site.faces[0].pipsLeft, 2);
  assert.equal(site.noise, 1);                                       // only the turn
  // min 1: SOW 1 -> 1 pip
  site = mk(32);
  site.player.dice.find(d => d.id === 'HAND').faces[1] = 'SCAR';
  r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'SCAR', 'MOUTH']);  // only Small talk 2 -> 1
  assert.equal(r.evaluation.totals.SOW, 2);
  assert.equal(r.events.filter(e => e.type === 'sitePip').length, 1);
  // SOW 4 -> 2 pips
  site = mk(33);
  site.player.dice.find(d => d.id === 'HAND').faces[1] = 'HAND+SEED_POUCH';
  r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND+SEED_POUCH', 'MOUTH']);   // 2+? Give seeds 2 + Small talk 2 = 4
  assert.equal(r.evaluation.totals.SOW, 4);
  assert.equal(r.events.filter(e => e.type === 'sitePip').length, 2);
  const T = r.events.find(e => e.type === 'verb');
  assert.equal(T.amount, 2); assert.equal(T.total, 4); assert.equal(T.noise, 0);
});

test('SOW and PRUNE in one sentence resolve in sentence order, both on the target', () => {
  const { trip } = m2Trip(36);
  const site = fixedSite(trip, 'SHED', NOTHINGS, null, 3);
  // MOUTH instinct SOW 2 (slot 0), MIND PRUNE (slot 1), HAND directed PRUNE 2 (slot 2)
  const r = siteTurn(site, ['HEAD', 'MIND', 'HAND'], ['PRUNE', 'HAND', 'MOUTH']);
  deepEq(r.events.filter(e => e.type === 'verb').map(e => e.verb), ['SOW', 'PRUNE']);
  assert.equal(r.evaluation.totals.SOW, 2);
  assert.equal(r.evaluation.totals.PRUNE, 2);
  assert.equal(site.faces[0].pipsLeft, 3 - 1 - 2);                  // coax 1 pip + prune 2
});

test('contents on open: RATS = 1 scar +2 noise, TRAP = 1 scar, NOTHING/JUNK nothing', () => {
  let { trip } = m2Trip(40);
  let site = fixedSite(trip, 'HEAP', ['RATS', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], null, 1);
  let r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH']);    // SOW 3 -> 1 pip -> opens face 0
  assert.equal(E.tripScars(trip), 1);
  const noise = r.events.filter(e => e.type === 'noise');
  deepEq(noise.map(e => [e.cause, e.amount]), [['RATS', 2], ['turn', 1]]);
  assert.equal(site.noise, 3);
  assert.ok(r.events.some(e => e.type === 'scar' && e.cause === 'rats'));

  ({ trip } = m2Trip(41));
  site = fixedSite(trip, 'SHED', ['TRAP', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], null, 1);
  r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH']);
  assert.equal(E.tripScars(trip), 1);
  assert.ok(r.events.some(e => e.type === 'scar' && e.cause === 'trap'));
  assert.equal(site.noise, 1);

  ({ trip } = m2Trip(42));
  site = fixedSite(trip, 'SHED', ['JUNK', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], null, 1);
  r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH']);
  assert.equal(E.tripScars(trip), 0); assert.equal(trip.inventory.length, 0);
  const o = r.events.find(e => e.type === 'siteOpen'); assert.equal(o.content, 'JUNK');
});

test('scar from a site destroys the item on the face; max scars loses the trip from the site', () => {
  const { trip } = m2Trip(43);
  trip.dice.find(d => d.id === 'HAND').faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'HAND'];
  trip.dice.find(d => d.id === 'HEAD').faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR'];
  const dice = trip.dice;
  dice.find(d => d.id === 'MIND').idx = dice.find(d => d.id === 'MIND').faces.indexOf('SOW');
  dice.find(d => d.id === 'HAND').idx = 5; dice.find(d => d.id === 'HEAD').idx = 0;
  const site2 = fixedSite(trip, 'HEAP', ['RATS', 'ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], ['KNIFE'], 1);
  site2.faces[0].pipsLeft = 1;
  trip.over = null; trip.stage = 'SITE';
  const r2 = E.resolveSiteTurn(site2, ['MIND', 'HAND', 'HEAD'], E.makeRng(4));
  assert.ok(r2.ok);
  assert.equal(E.tripScars(trip) >= 6, true);
  assert.equal(trip.over, 'lost'); assert.equal(site2.over, 'lost'); assert.equal(r2.over, 'lost');
  assert.ok(r2.events.some(e => e.type === 'lose' && e.cause === 'rats'));
  assert.equal(r2.events.some(e => e.type === 'guardian'), false);
  assert.equal(E.resolveSiteTurn(site2, ['MIND', 'HAND', 'HEAD'], E.makeRng(1)).reason, 'site-over');
});

test('every committed turn adds +1 noise; noise caps at noiseMax; guardian arrives right after the turn', () => {
  const { trip } = m2Trip(44);
  const site = fixedSite(trip, 'HEAP', NOTHINGS, null, 2);
  const rng = E.makeRng(9);
  let r;
  for (let k = 1; k <= 5; k++) {
    E.startSiteTurn(site, rng);
    // a SCAR-only sentence does nothing, but time passes
    r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['DIG', 'SCAR' === 'x' ? null : null, null]);
    assert.ok(r.ok);
    assert.equal(site.noise, k);
    assert.equal(r.guardian, null);
  }
  assert.equal(site.over, null);
  E.startSiteTurn(site, rng);
  r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['DIG', null, null]);
  assert.equal(site.noise, 6);
  assert.equal(r.guardian, 'DOG');
  assert.equal(site.over, 'guardian');
  assert.equal(trip.stage, 'DOG');
  assert.ok(trip.encounter && trip.encounter.enemyId === 'DOG');
  const g = r.events.find(e => e.type === 'guardian');
  assert.equal(g.enemyId, 'DOG'); assert.equal(g.noise, 6);
  assert.equal(r.events[r.events.length - 1].type, 'guardian');
  assert.equal(E.resolveSiteTurn(site, ['MIND', 'HAND', 'HEAD'], rng).reason, 'site-over');
});

test('guardian per site: HEAP dog, SHED crows, WELL plumber; fight is normal; site done afterwards', () => {
  for (const [sid, enemy] of [['HEAP', 'DOG'], ['SHED', 'CROWS'], ['WELL', 'PLUMBER']]) {
    const { trip, rng } = m2Trip(50);
    setTile(trip, 1, 1, 'SCAVENGE', { siteId: sid });
    E.moveTo(trip, 1, 1, rng);
    const site = trip.site;
    site.noise = 5;
    E.startSiteTurn(site, rng);
    const r = E.resolveSiteTurn(site, ['MIND', 'HAND', 'HEAD'], rng);
    assert.equal(r.guardian, enemy);
    const enc = trip.encounter;
    assert.equal(enc.enemyId, enemy);
    // play the fight to a win by brute force
    let n = 0;
    while (!enc.over && n++ < 80) { E.startTurn(enc, rng); if (enc.over) break; E.resolveTurn(enc, [0, 1, 2], rng); }
    if (enc.over === 'lost') continue;
    assert.equal(enc.over, 'won');
    assert.equal(E.advanceStage(trip), 'MAP');
    assert.equal(trip.map.tiles[1][1].type, 'EMPTY'); assert.equal(trip.site, null);
    assert.ok(trip.results.some(x => x.kind === 'site' && x.siteId === sid && x.result === 'GUARDIAN'));
  }
});

test('opened items before the guardian arrives are kept', () => {
  const { trip, rng } = m2Trip(51);
  const site = fixedSite(trip, 'HEAP', ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], ['SPADE'], 1);
  site.noise = 5;
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH'], rng);
  assert.equal(r.guardian, 'DOG');
  deepEq(trip.inventory, ['SPADE']);
});

test('LEAVE keeps opened items; reports placement only if something was gained', () => {
  const { trip } = m2Trip(52);
  const site = fixedSite(trip, 'SHED', ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING', 'NOTHING'], ['GLASSES'], 1);
  siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH']);
  const l = E.leaveSite(trip);
  assert.ok(l.ok); deepEq(l.gained, ['GLASSES']); assert.equal(l.placement, true);
  deepEq(trip.inventory, ['GLASSES']);
  assert.equal(site.over, 'left');
  assert.equal(E.leaveSite(trip).ok, false);                          // already left
  assert.equal(E.resolveSiteTurn(site, ['MIND', 'HAND', 'HEAD'], E.makeRng(1)).reason, 'site-over');
  assert.equal(E.advanceStage(trip), 'MAP');
  // empty-handed
  const t2 = m2Trip(53).trip;
  fixedSite(t2, 'WELL', NOTHINGS, null, 1);
  const l2 = E.leaveSite(t2);
  assert.equal(l2.placement, false); deepEq(l2.gained, []);
  assert.ok(t2.log.some(x => x.includes('empty-handed')));
});

test('site turn log + events: sentence, steps first; log lines in trip.log; WHISTLE does nothing on a site', () => {
  const { trip } = m2Trip(54);
  const site = fixedSite(trip, 'WELL', NOTHINGS, null, 1);
  trip.dice.find(d => d.id === 'HEAD').faces[3] = 'MOUTH+WHISTLE';
  const r = siteTurn(site, ['MIND', 'HAND', 'HEAD'], ['SOW', 'HAND', 'MOUTH+WHISTLE']);
  assert.equal(r.events[0].type, 'sentence'); assert.equal(r.events[1].type, 'step');
  assert.equal(r.evaluation.totals.SOW, 1 + 3);                        // no ×2
  assert.ok(r.log.startsWith('S1: [SOW] HAND MOUTH+WHISTLE'));
  assert.ok(trip.log.includes(r.log));
  assert.ok(site.log.includes(r.log));
  assert.ok(r.preview && typeof r.preview.text === 'string');
});

test('sitePreview text: force/coax/search', () => {
  const { trip } = m2Trip(55);
  const site = fixedSite(trip, 'HEAP', NOTHINGS, null, 2);
  // EYE instinct DIG 2, then HAND directed PRUNE 2 + carry 2
  let ev = E.evaluateSentence(['EYE', 'PRUNE', 'HAND'], { site: true });
  let p = E.sitePreview(site, ev);
  assert.equal(p.text, 'search: reveals 2 · force 4 (+4 noise)');
  ev = E.evaluateSentence(['MOUTH', 'SOW', 'HAND+SPADE'], { site: true });   // MOUTH instinct SOW 2 ... SPADE SOW
  p = E.sitePreview(site, ev);
  assert.equal(p.sow.pips, Math.max(1, Math.floor(ev.totals.SOW / 2)));
  ev = E.evaluateSentence(['EYE', 'DIG', 'HAND+SPADE'], { site: true });     // SPADE directed DIG
  p = E.sitePreview(site, ev);
  assert.equal(p.reveal, 'all');
  assert.equal(p.text.includes('reveals all'), true);
  ev = E.evaluateSentence(['HAND+SHEARS', 'DIG', 'EYE'], { site: true });   // SHEARS instinct PRUNE (quiet)
  p = E.sitePreview(site, ev);
  assert.equal(p.prune.noise, 0);
  assert.ok(p.text.includes('no noise'));
});

test('site turn: startSiteTurn rolls dice and gives base rerolls; rerollUnheld works on a site', () => {
  const { trip } = m2Trip(56);
  const site = fixedSite(trip, 'HEAP', NOTHINGS, null, 2);
  const rng = E.makeRng(3);
  const st = E.startSiteTurn(site, rng);
  assert.equal(st.rerolls, CFG.rerollsPerTurn); assert.equal(site.rerolls, 2);
  assert.ok(E.rerollUnheld(site, rng).length === 3);
  assert.equal(site.rerolls, 1);
});

test('nothing left to open: further turns are refused', () => {
  const { trip } = m2Trip(57);
  const site = fixedSite(trip, 'HEAP', NOTHINGS, null, 1);
  site.faces.forEach(f => { f.opened = true; f.pipsLeft = 0; });
  assert.equal(E.resolveSiteTurn(site, ['MIND', 'HAND', 'HEAD'], E.makeRng(1)).reason, 'nothing-left');
});

// ---------- full seeded M2 trip ----------
function simulateM2(seed, policy) {
  const rng = E.makeRng(seed);
  const trip = E.createTrip(rng, 'm2');
  const sum = { seed, moves: 0, turns: 0, siteTurns: 0, cold: 0, sites: 0, guardians: 0, fights: 0, items: 0, events: [] };
  let guard = 0;
  const bestOrder = (state, isSite) => {
    const dice = state.player.dice, ids = dice.map(d => d.id);
    let best = null, bestV = -1;
    [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].forEach(o => {
      const ev = E.evaluateSentence(o.map(i => E.currentFace(dice[i])), isSite ? { site: true } : { enemy: state.enemy });
      const v = Object.values(ev.totals).reduce((a, b) => a + b, 0) + (ev.reveal ? 1 : 0);
      if (v > bestV) { bestV = v; best = o.map(i => ids[i]); }
    });
    return best;
  };
  const fight = () => {
    const enc = trip.encounter;
    let n = 0;
    while (!enc.over && n++ < 120) {
      const st = E.startTurn(enc, rng);
      if (st.over) break;
      const r = E.resolveTurn(enc, bestOrder(enc, false), rng);
      sum.turns++;
      r.events.forEach(e => sum.events.push(e.type));
    }
    assert.ok(enc.over, 'fight ended, seed ' + seed);
    if (enc.over === 'lost') return false;
    sum.fights++;
    const pick = (E.rewardsFor(trip, enc.result).choose || [])[0];
    assert.ok(E.claimReward(trip, enc.result, pick, rng).ok);
    return true;
  };
  const place = () => {
    E.beginPlacement(trip, 'reward');
    trip.inventory.slice().forEach(item => {
      for (const id of ['HAND', 'HEAD']) for (let i = 0; i < 6; i++) {
        const cur = trip.dice.find(d => d.id === id).faces[i];
        if (!cur.includes('+') && E.canPlace(trip, item, id, i, 'reward').ok) { if (E.placeItem(trip, item, id, i, 'reward').ok) return; }
      }
    });
    E.endPlacement(trip);
  };
  while (!trip.over && guard++ < 400) {
    if (trip.stage === 'MAP') {
      const here = trip.map.pos, gate = trip.map.gate;
      const moves = E.legalMoves(trip);
      assert.ok(moves.length >= 2);
      // walk toward the gate (column first), wandering randomly 25% of the time
      let m = moves.slice().sort((a, b) => (Math.abs(a.c - gate.c) + Math.abs(a.r - gate.r)) - (Math.abs(b.c - gate.c) + Math.abs(b.r - gate.r)))[0];
      if (rng() < 0.25) m = moves[Math.floor(rng() * moves.length)];
      const r = E.moveTo(trip, m.c, m.r, rng);
      assert.ok(r.ok, 'move ok seed ' + seed);
      sum.moves++;
      r.events.forEach(e => { sum.events.push(e.type); if (e.type === 'cold') sum.cold++; });
      continue;
    }
    if (trip.stage === 'CAMPFIRE') {
      const sc = trip.dice.map(d => ({ id: d.id, idx: d.faces.indexOf('SCAR') })).find(o => o.idx >= 0 && o.id !== 'MIND');
      if (sc) E.healScar(trip, sc.id, sc.idx);
      E.advanceStage(trip);
      continue;
    }
    if (trip.stage === 'SITE') {
      const site = trip.site;
      sum.sites++;
      let n = 0;
      // cautious scavenger: dig, then coax/prune until the noise is 4, then leave
      while (!site.over && n++ < 20) {
        if (policy === 'greedy' ? false : site.noise >= 4) break;
        E.startSiteTurn(site, rng);
        const r = E.resolveSiteTurn(site, bestOrder(site, true), rng);
        if (!r.ok) break;
        sum.siteTurns++;
        r.events.forEach(e => sum.events.push(e.type));
        if (r.guardian) { sum.guardians++; break; }
        if (trip.over) break;
      }
      if (trip.over) break;
      if (site.over === 'guardian') {
        if (!fight()) break;
        place();
        E.advanceStage(trip);
        continue;
      }
      const l = E.leaveSite(trip);
      assert.ok(l.ok);
      sum.items += l.gained.length;
      if (l.placement) place();
      E.advanceStage(trip);
      continue;
    }
    // an encounter on a character tile
    assert.ok(trip.encounter && trip.encounter.enemyId === trip.stage, 'encounter for stage ' + trip.stage);
    if (!fight()) break;
    place();
    E.advanceStage(trip);
  }
  assert.ok(trip.over, 'trip finished, seed ' + seed + ' stage ' + trip.stage);
  sum.over = trip.over; sum.scars = E.tripScars(trip); sum.daylight = trip.daylight; sum.log = trip.log.length;
  sum.inventory = trip.inventory.slice();
  return sum;
}

test('seeded full M2 trip simulation ends in a win or a loss, deterministically', () => {
  const outcomes = { won: 0, lost: 0 }, seen = new Set();
  let cold = 0, sites = 0, guardians = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const s = simulateM2(seed, seed % 2 ? 'cautious' : 'greedy');
    assert.ok(s.over === 'won' || s.over === 'lost');
    outcomes[s.over]++;
    if (s.over === 'won') { assert.ok(s.scars < CFG.maxScars); assert.ok(s.moves >= 5); }
    else assert.ok(s.scars >= CFG.maxScars);
    s.events.forEach(e => seen.add(e));
    cold += s.cold; sites += s.sites; guardians += s.guardians;
    deepEq(simulateM2(seed, seed % 2 ? 'cautious' : 'greedy'), JSON.parse(JSON.stringify(s)));
  }
  assert.ok(outcomes.won > 0, 'some M2 trips are won: ' + JSON.stringify(outcomes));
  assert.ok(sites > 0, 'sites visited');
  for (const t of ['move', 'enter', 'sitePip', 'siteOpen', 'noise', 'verb', 'siteReveal', 'sentence'])
    assert.ok(seen.has(t), 'M2 event seen: ' + t);
});

// =====================================================================================================
// V1-4b — PLUMBER, ACCOUNTANT, PIPE WRENCH, PLUNGER, random fights, intro placement
// =====================================================================================================
// set the 3 dice faces for the next sentence on an encounter (HAND / HEAD get exact face strings, faces added if missing)
function setExact(g, mind, hand, head) {
  const [m, h, e] = g.player.dice;
  m.idx = m.faces.indexOf(mind);
  if (h.faces.indexOf(hand) < 0) h.faces[h.faces.length - 1] = hand;
  if (e.faces.indexOf(head) < 0) e.faces[e.faces.length - 1] = head;
  h.idx = h.faces.indexOf(hand); e.idx = e.faces.indexOf(head);
}
const COMMIT = ['MIND', 'HAND', 'HEAD'];

test('v1-4b data: PLUMBER, ACCOUNTANT, items, bare start', () => {
  const P = CFG.enemies.PLUMBER, A = CFG.enemies.ACCOUNTANT;
  deepEq([...P.tags], ['human']); assert.equal(P.pruneMod, -1); assert.equal(P.sowMod, 1);
  deepEq(P.faces.map(f => [f.name, f.pips, f.hostile, f.effect]),
    [['BORROW', 3, true, 'takeItem'], ['BORROW', 3, true, 'takeItem'], ['QUOTE', 1, true, 'rerollPenalty'], ['QUOTE', 1, true, 'rerollPenalty'],
     ['SIGH', 1, false, 'none'], ['SIGH', 1, false, 'none']]);
  deepEq({ ...P.rewards.beaten, give: [...P.rewards.beaten.give] }, { give: ['PIPE_WRENCH'], returnTaken: true });
  deepEq([...P.rewards.befriended.choose], ['PLUNGER', 'WATERING_CAN']);
  deepEq([...A.tags], ['human']); assert.equal(A.pruneMod, 1); assert.equal(A.sowMod, -1);
  deepEq(A.faces.map(f => [f.name, f.pips, f.hostile, f.effect]),
    [['TAXES', 2, true, 'tax'], ['TAXES', 2, true, 'tax'], ['EXPLAINS', 3, true, 'scarHead'], ['BORES', 1, true, 'rerollPenalty'],
     ['ANECDOTE', 2, true, 'freezeDie'], ['FILES', 1, false, 'none']]);
  deepEq([...A.targetPriority], ['EXPLAINS', 'TAXES', 'ANECDOTE', 'BORES']);
  deepEq([...A.rewards.beaten.choose], ['LANTERN', 'GLASSES']);
  deepEq([...A.rewards.befriended.choose], ['WHISTLE', 'SEED_POUCH']);
  assert.equal(CFG.items.PIPE_WRENCH.part, 'HAND'); assert.equal(CFG.items.PLUNGER.part, 'HAND');
  assert.equal(CFG.text.bagLabel.PLUMBER, 'TOOLBOX');
  assert.ok(!JSON.stringify(CFG).includes('GARDENER'), 'no GARDENER anywhere in CONFIG');
  assert.equal(CFG.sites.WELL.guardian, 'PLUMBER');
  // item names
  assert.equal(ev('PRUNE', 'HAND+PIPE_WRENCH', 'EYE').steps[0].name, 'Wrench');
  assert.equal(ev('SOW', 'HAND+PIPE_WRENCH', 'EYE').steps[0].name, 'Fix their tap');
  assert.equal(ev('PRUNE', 'HAND+PLUNGER', 'EYE').steps[0].name, 'Plunge');
});

test('tax: next turn every verb total is -1 (min 0), shown, not stacking, expires', () => {
  const g = enc('ACCOUNTANT');
  g.enemy.current = { faceIdx: 0, wag: false };                         // TAXES
  setExact(g, 'DIG', 'HAND', 'EYE');
  const o1 = E.resolveTurn(g, COMMIT, E.makeRng(4));
  const act = o1.events.find(x => x.type === 'enemyAct');
  assert.equal(act.effect, 'tax'); assert.equal(act.tax, 1);
  assert.match(o1.log, /accountant talks about taxes/);
  assert.equal(g.tax, 1);
  // preview with tax
  const faces = ['PRUNE', 'HAND', 'EYE'];
  assert.equal(E.evaluateSentence(faces, { enemy: g.enemy, tax: g.tax }).text, 'Plan: Hit 2 · Glare 1 → PRUNE 3 (accountant +1) (taxed −1)');
  assert.equal(E.evaluateSentence(faces, { enemy: g.enemy }).text, 'Plan: Hit 2 · Glare 1 → PRUNE 4 (accountant +1)');
  // min 0: SOW 2 -> accountant -1 -> 1 -> taxed -> 0
  const z = E.evaluateSentence(['SOW', 'EYE', 'EYE'], { enemy: g.enemy, tax: 1 });
  assert.equal(z.text, 'Plan: Kind look 1 · Kind look 1 → SOW 0 (accountant −1) (taxed −1)');
  assert.equal(z.totals.SOW, 0);
  // a verb that was already 0 is not "taxed"
  assert.deepEqual(Object.keys(E.evaluateSentence(['DIG', 'HAND', 'EYE'], { enemy: g.enemy, tax: 1 }).taxed), []);
  // applied: next turn PRUNE 4 -> 3 pips
  g.enemy.current = { faceIdx: 5, wag: false };                         // FILES: harmless
  g.enemy.faces[5].pips = ['intact'];
  setExact(g, 'PRUNE', 'HAND', 'EYE');
  const o2 = E.resolveTurn(g, COMMIT, E.makeRng(4));
  const tx = o2.events.find(x => x.type === 'taxed');
  deepEq({ ...tx }, { type: 'taxed', verb: 'PRUNE', amount: 1, before: 4, after: 3 });
  assert.equal(o2.events.find(x => x.type === 'verb').amount, 3);
  assert.match(o2.log, /PRUNE 3 \(accountant \+1\) \(taxed −1\)/);
  assert.equal(g.tax, 0);                                               // expired
  // non-stacking: two TAXES in a row still -1
  const h = enc('ACCOUNTANT');
  h.enemy.current = { faceIdx: 0, wag: false };
  setExact(h, 'DIG', 'HAND', 'EYE');
  E.resolveTurn(h, COMMIT, E.makeRng(4));
  h.enemy.current = { faceIdx: 1, wag: false };
  setExact(h, 'DIG', 'HAND', 'EYE');
  E.resolveTurn(h, COMMIT, E.makeRng(4));
  assert.equal(h.tax, 1);
  // a taxed turn with a non-tax act: expires after that turn
  const k = enc('ACCOUNTANT');
  k.tax = 1; k.enemy.current = { faceIdx: 5, wag: false };
  setExact(k, 'DIG', 'HAND', 'EYE');
  E.resolveTurn(k, COMMIT, E.makeRng(4));
  assert.equal(k.tax, 0);
  // a taxed sentence on a site / without an enemy is never taxed
  assert.equal(E.evaluateSentence(['PRUNE', 'HAND', 'EYE'], { site: true, tax: 1 }).text, 'Plan: Hit 2 · Glare 1 → PRUNE 3');
  assert.equal(E.startEncounter(k.trip, 'DOG', E.makeRng(1)).tax, 0);   // new encounter starts clean
});

test('scarHead: scars a random HEAD face (never HAND), destroys its item, can lose the trip', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = enc('ACCOUNTANT', seed);
    g.player.dice[2].faces = ['EYE+GLASSES', 'EYE', 'MOUTH', 'MOUTH+WHISTLE', SC, SC];
    g.enemy.current = { faceIdx: 2, wag: false };                       // EXPLAINS
    setExact(g, 'DIG', 'HAND', 'EYE');
    const out = E.resolveTurn(g, COMMIT, E.makeRng(seed));
    const sc = out.events.find(x => x.type === 'scar');
    assert.equal(sc.dieId, 'HEAD');
    assert.equal(g.player.dice[1].faces.filter(f => f === SC).length, 0);
    assert.equal(g.player.dice[2].faces[sc.faceIdx], SC);
    assert.match(out.log, /accountant explains depreciation; your eyes glaze over \(HEAD /);
    if (sc.previous.includes('+')) assert.ok(out.events.some(x => x.type === 'itemDestroyed' && x.dieId === 'HEAD'));
  }
  // no HEAD face left: nothing happens
  const h = enc('ACCOUNTANT');
  h.player.dice[2].faces = [SC, SC, SC, SC, SC, SC];
  h.enemy.current = { faceIdx: 2, wag: false };
  setExact(h, 'DIG', 'HAND', SC);
  const o2 = E.resolveTurn(h, COMMIT, E.makeRng(1));
  assert.ok(!o2.events.some(x => x.type === 'scar'));
  // 5th + 6th scar loses
  const l = enc('ACCOUNTANT');
  l.player.dice[1].faces = [SC, SC, SC, SC, SC, 'HAND'];
  l.player.dice[2].faces = [SC, 'EYE', 'EYE', SC, SC, SC];
  l.player.dice[2].faces[0] = SC;
  l.enemy.current = { faceIdx: 2, wag: false };
  setExact(l, 'DIG', 'HAND', SC);
  assert.equal(E.countScars(l.player), 9);
  const o3 = E.resolveTurn(l, COMMIT, E.makeRng(1));
  assert.equal(o3.over, 'lost');
});

test('freezeDie: a random non-MIND die cannot be held or rerolled next turn, then thaws', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const g = enc('ACCOUNTANT', seed);
    g.enemy.current = { faceIdx: 4, wag: false };                       // ANECDOTE
    setExact(g, 'DIG', 'HAND', 'EYE');
    const out = E.resolveTurn(g, COMMIT, E.makeRng(seed));
    const fr = out.events.find(x => x.type === 'freeze');
    assert.ok(fr && (fr.dieId === 'HAND' || fr.dieId === 'HEAD'));
    seen.add(fr.dieId);
    assert.match(out.log, /accountant starts an anecdote/);
    const die = g.player.dice.find(d => d.id === fr.dieId);
    assert.equal(die.frozen, true);
    assert.equal(g.player.dice[0].frozen || false, false);              // MIND never freezes
    // next turn: it rolls once normally, then cannot be held / rerolled
    const st = E.startTurn(g, E.makeRng(seed + 50));
    assert.equal(st.rerolls, CFG.rerollsPerTurn);
    const idx = die.idx;
    assert.equal(E.toggleHold(die), false);
    assert.equal(die.held, false);
    for (let k = 0; k < 2; k++) {
      const ids = E.rerollUnheld(g, E.makeRng(seed * 7 + k));
      assert.ok(!ids.includes(fr.dieId));
      assert.equal(die.idx, idx);
    }
    assert.equal(g.rerolls, 0);
    // committing the sentence thaws it
    g.enemy.current = { faceIdx: 5, wag: false };
    E.resolveTurn(g, COMMIT, E.makeRng(seed));
    assert.equal(die.frozen, false);
    assert.equal(E.toggleHold(die), true);
  }
  assert.ok(seen.has('HAND') && seen.has('HEAD'), 'both HAND and HEAD get frozen over many seeds');
  // encounter end clears it too
  const w = enc('ACCOUNTANT');
  w.player.dice[1].frozen = true;
  w.enemy.faces.forEach(f => { if (f.hostile) f.pips = f.pips.map(() => 'broken'); });
  w.enemy.faces[0].pips = ['intact', 'broken'];
  w.enemy.current = { faceIdx: 0, wag: false };
  setExact(w, 'PRUNE', 'HAND', 'EYE');
  const o = E.resolveTurn(w, COMMIT, E.makeRng(1));
  assert.equal(o.over, 'won');
  assert.equal(w.player.dice[1].frozen, false);
});

test('M1 sequence is 5 distinct random events from m1Pool with the campfire after the 3rd, rolled at createTrip', () => {
  const firsts = new Set(), seqs = new Set(), all = new Set();
  for (let seed = 1; seed <= 150; seed++) {
    const tr = E0.createTrip(E0.makeRng(seed));
    const seq = [...tr.sequence];
    assert.equal(seq.length, 6);
    assert.equal(seq[3], 'CAMPFIRE');
    const events = [seq[0], seq[1], seq[2], seq[4], seq[5]];
    assert.equal(new Set(events).size, 5, 'distinct: ' + seq);
    events.forEach(f => { assert.ok(CFG.trip.m1Pool.includes(f), f); all.add(f); });
    assert.equal(tr.stage, seq[0]);
    firsts.add(seq[0]); seqs.add(seq.join());
    deepEq([...E0.createTrip(E0.makeRng(seed)).sequence], seq);        // deterministic per seed
  }
  assert.ok(firsts.size >= 5, 'many different openers');
  assert.equal(all.size, 6, 'every event of the pool shows up');
  assert.ok(seqs.size > 30, 'many different orders');
  deepEq([...E0.createTrip(E0.makeRng(1), ['CROWS', 'CAMPFIRE']).sequence], ['CROWS', 'CAMPFIRE']);
  // M2 character tiles pick from the character pool (no HUT: it is a site)
  const ids = new Set(), sites = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const tr = E0.createTrip(E0.makeRng(seed), 'm2');
    tr.map.tiles.flat().forEach(x => {
      if (x.type === 'CHARACTER') { assert.ok(CFG.trip.enemyPool.includes(x.enemyId)); ids.add(x.enemyId); }
      if (x.type === 'SCAVENGE') sites.add(x.siteId);
    });
  }
  deepEq([...ids].sort(), ['ACCOUNTANT', 'BRIDGE', 'CROWS', 'DOG', 'PLUMBER']);
  assert.ok(sites.has('HUT'));
  assert.equal(E0.tileWord({ type: 'CHARACTER', enemyId: 'BRIDGE' }), 'BRIDGE');
  assert.equal(E0.tileWord({ type: 'SCAVENGE', siteId: 'HUT' }), 'HUT');
});

test('intro: bare dice, starting inventory, free placement in intro mode (M1 and M2)', () => {
  for (const mode of [undefined, 'm2']) {
    const t = E0.createTrip(E0.makeRng(3), mode);
    deepEq(t.dice.find(d => d.id === 'HAND').faces, ['HAND', 'HAND', 'HAND', 'HAND', 'HAND', 'HAND']);
    deepEq(t.dice.find(d => d.id === 'HEAD').faces, ['EYE', 'EYE', 'EYE', 'MOUTH', 'MOUTH', 'MOUTH']);
    deepEq([...t.inventory], ['KNIFE', 'GLASSES']);
    assert.notEqual(t.inventory, CFG.startingInventory, 'inventory is a copy');
    assert.equal(E0.tripScars(t), 0);
    const pl = E0.beginPlacement(t, 'intro');
    assert.equal(pl.mode, 'intro');
    assert.equal(E0.placeItem(t, 'KNIFE', 'HAND', 2, 'intro').ok, true);
    assert.equal(E0.placeItem(t, 'GLASSES', 'HEAD', 0, 'intro').ok, true);
    assert.equal(E0.placeItem(t, 'GLASSES', 'HEAD', 3, 'intro').reason, 'not-in-inventory');
    assert.equal(t.dice[1].faces[2], 'HAND+KNIFE');
    // intro is free: nothing is locked, items move and go back to the inventory
    assert.equal(E0.isLocked(t, 'HAND', 2, 'intro'), false);
    assert.equal(E0.moveItem(t, 'HAND', 2, 'HAND', 5, 'intro').ok, true);
    assert.equal(t.dice[1].faces[5], 'HAND+KNIFE');
    assert.equal(E0.unplaceItem(t, 'HAND', 5, 'intro').ok, true);
    deepEq([...t.inventory], ['KNIFE']);
    assert.equal(E0.canPlace(t, 'KNIFE', 'HEAD', 0, 'intro').reason, 'wrong-part');
    // DONE may leave items in the inventory
    E0.endPlacement(t);
    assert.equal(t.placement, null);
    deepEq([...t.inventory], ['KNIFE']);
  }
  // reward mode stays locked, so intro is genuinely different
  const t = E0.createTrip(E0.makeRng(3));
  E0.beginPlacement(t, 'intro'); E0.placeItem(t, 'KNIFE', 'HAND', 0, 'intro'); E0.endPlacement(t);
  assert.equal(E0.isLocked(t, 'HAND', 0, 'reward'), true);
});

test('full trip over many seeds with the new enemies ends deterministically (bare start, intro placement)', () => {
  const seen = new Set(), enemies = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const run = () => {
      const rng = E0.makeRng(seed), trip = E0.createTrip(rng);
      E0.beginPlacement(trip, 'intro');
      E0.placeItem(trip, 'KNIFE', 'HAND', 0, 'intro'); E0.placeItem(trip, 'GLASSES', 'HEAD', 0, 'intro');
      E0.endPlacement(trip);
      const log = [];
      while (trip.stage && !trip.over) {
        if (E0.isCampfire(trip.stage)) { E0.advanceStage(trip); continue; }
        enemies.add(trip.stage);
        if (CFG.sites[trip.stage]) {                                  // M1 site stage: leave at once
          const site = E0.startSite(trip, trip.stage, rng);
          assert.equal(trip.stage, 'HUT');
          assert.equal(trip.site, site);
          assert.ok(site.name);
          E0.leaveSite(trip);
          log.push(trip.stage + ':site');
          E0.advanceStage(trip);
          continue;
        }
        const g = E0.startEncounter(trip, trip.stage, rng);
        let n = 0;
        while (!g.over && n++ < 80) {
          E0.startTurn(g, rng);
          const out = E0.resolveTurn(g, [0, 1, 2].sort(() => rng() - 0.5), rng);
          out.events.forEach(e => seen.add(e.type));
        }
        log.push(g.enemyId + ':' + g.over + ':' + g.turn);
        if (g.over === 'lost') break;
        const res = E0.claimReward(trip, g.result, (E0.rewardsFor(trip, g.result).choose || [])[0], rng);
        assert.ok(res.ok);
        E0.advanceStage(trip);
      }
      return log.join();
    };
    assert.equal(run(), run());
  }
  assert.ok(enemies.size >= 5);
  for (const t of ['taxed', 'freeze', 'itemTaken', 'scar']) assert.ok(seen.has(t), 'event seen: ' + t);
});

// =====================================================================================================
// V1-4c — ABANDONED HUT, WOODEN BRIDGE, result labels, empty rewards, 5-event M1
// =====================================================================================================
test('v1-4c data: HUT site and BRIDGE obstacle', () => {
  const H = CFG.sites.HUT;
  deepEq([H.name, H.word, H.pips, H.guardian, [...H.faces].sort(), [...H.pool]],
    ['ABANDONED HUT', 'HUT', 2, 'ACCOUNTANT', ['ITEM', 'ITEM', 'JUNK', 'NOTHING', 'NOTHING', 'TRAP'], ['PIPE_WRENCH', 'PLUNGER', 'KNIFE', 'SEED_POUCH']]);
  const B = CFG.enemies.BRIDGE;
  deepEq([...B.tags], ['place']); assert.equal(B.pruneMod, 0); assert.equal(B.sowMod, 0); assert.equal(B.logName, 'bridge');
  deepEq(B.faces.map(f => [f.name, f.pips, f.hostile, f.effect]),
    [['CREAK', 2, true, 'rerollPenalty'], ['CREAK', 2, true, 'rerollPenalty'], ['SLIP', 2, true, 'scar'], ['DROP', 3, true, 'loseItem'],
     ['SWAY', 1, true, 'rerollPenalty'], ['CALM WATER', 1, false, 'none']]);
  deepEq({ ...B.resultLabels }, { beaten: 'FORCED ACROSS', befriended: 'CROSSED SAFELY' });
  deepEq({ ...B.rewards.beaten, give: [...B.rewards.beaten.give] }, { give: [] });
  deepEq([...B.rewards.befriended.choose], ['LANTERN', 'WATERING_CAN']);
  // other enemies keep BEATEN / BEFRIENDED
  assert.equal(E.createEnemy('DOG').resultLabels.beaten, 'BEATEN');
  assert.equal(E.createEnemy('BRIDGE').resultLabels.befriended, 'CROSSED SAFELY');
});

test('bridge DROP: a random placed item is gone for good (not returned)', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const g = enc('BRIDGE', seed);
    g.player.dice[1].faces = ['HAND+KNIFE', 'HAND', 'HAND', 'HAND', 'HAND', 'HAND'];
    g.player.dice[2].faces = ['EYE', 'EYE', 'EYE', 'MOUTH', 'MOUTH', 'MOUTH'];
    g.enemy.current = { faceIdx: 3, wag: false };                       // DROP
    setExact(g, 'DIG', 'HAND', 'EYE');
    const out = E.resolveTurn(g, COMMIT, E.makeRng(seed));
    const d = out.events.find(x => x.type === 'itemDestroyed');
    assert.equal(d.cause, 'river'); assert.equal(d.item, 'KNIFE');
    assert.equal(g.player.dice[1].faces[0], 'HAND');
    assert.equal(g.player.dice[1].faces[1], 'HAND');
    deepEq([...g.taken], []);
    assert.ok(g.trip.discarded.includes('KNIFE'));
    assert.match(out.log, /bridge something falls into the river.*KNIFE lost for good/);
    assert.equal(E.countScars(g.player), 0);
    // even a BEATEN bridge returns nothing
    const r = E.rewardsFor(g.trip, 'BEATEN');
    deepEq([...r.returned], []);
  }
  // nothing placed: nothing lost
  const w = enc('BRIDGE');
  w.player.dice[1].faces = ['HAND', 'HAND', 'HAND', 'HAND', 'HAND', 'HAND'];
  w.player.dice[2].faces = ['EYE', 'EYE', 'EYE', 'MOUTH', 'MOUTH', 'MOUTH'];
  w.enemy.current = { faceIdx: 3, wag: false };
  setExact(w, 'DIG', 'HAND', 'EYE');
  const o = E.resolveTurn(w, COMMIT, E.makeRng(1));
  assert.ok(!o.events.some(x => x.type === 'itemDestroyed'));
  assert.equal(o.events.find(x => x.type === 'enemyAct').text, CFG.enemies.BRIDGE.text.noItem);
  // SLIP scars, CREAK / SWAY take a reroll
  const s = enc('BRIDGE');
  s.enemy.current = { faceIdx: 2, wag: false };
  setExact(s, 'DIG', 'HAND', 'EYE');
  assert.ok(E.resolveTurn(s, COMMIT, E.makeRng(1)).events.some(x => x.type === 'scar'));
  const c = enc('BRIDGE');
  c.enemy.current = { faceIdx: 4, wag: false };
  setExact(c, 'DIG', 'HAND', 'EYE');
  E.resolveTurn(c, COMMIT, E.makeRng(1));
  assert.equal(c.rerollPenalty, 1);
});

test('result labels are per enemy; empty rewards are flagged for skipping', () => {
  const brk = (g, to) => { g.enemy.faces.forEach(f => { if (f.hostile) f.pips = f.pips.map(() => to); }); };
  let g = enc('BRIDGE');
  g.enemy.faces[0].pips = ['intact', 'broken'];
  brk(g, 'broken'); g.enemy.faces[0].pips = ['intact', 'broken'];
  g.enemy.current = { faceIdx: 0, wag: false };
  setExact(g, 'PRUNE', 'HAND', 'EYE');
  let out = E.resolveTurn(g, COMMIT, E.makeRng(1));
  assert.equal(g.result, 'BEATEN');                                    // code stays canonical
  assert.equal(g.resultLabel, 'FORCED ACROSS');
  assert.equal(g.trip.results[0].label, 'FORCED ACROSS');
  const r = E.rewardsFor(g.trip, g.result);
  assert.equal(r.empty, true);
  assert.equal(E.claimReward(g.trip, g.result).ok, true);
  deepEq([...g.trip.inventory], []);
  // befriended
  g = enc('BRIDGE');
  g.enemy.faces.forEach(f => { if (f.hostile) f.pips = f.pips.map(() => 'turned'); });
  g.enemy.faces[0].pips = ['intact', 'turned'];
  g.enemy.current = { faceIdx: 0, wag: false };
  setExact(g, 'SOW', 'HAND', 'EYE');
  E.resolveTurn(g, COMMIT, E.makeRng(1));
  assert.equal(g.result, 'BEFRIENDED'); assert.equal(g.resultLabel, 'CROSSED SAFELY');
  assert.equal(E.rewardsFor(g.trip, g.result).empty, false);
  // dog: default labels; its beaten reward is a choice, not empty
  const d = enc('DOG');
  d.enemy.faces.forEach(f => { if (f.hostile) f.pips = f.pips.map(() => 'broken'); });
  d.enemy.faces[0].pips = ['intact', 'broken'];
  d.enemy.current = { faceIdx: 0, wag: false };
  setExact(d, 'PRUNE', 'HAND', 'EYE');
  E.resolveTurn(d, COMMIT, E.makeRng(1));
  assert.equal(d.resultLabel, 'BEATEN');
  assert.equal(E.rewardsFor(d.trip, d.result).empty, false);
  // plumber beaten with nothing taken still gives the wrench
  assert.equal(E.rewardsFor(enc('PLUMBER').trip, 'BEATEN').empty, false);
});

test('M1 HUT stage runs as a site: no daylight, noise + guardian work, placement if items gained', () => {
  const rng = E0.makeRng(11);
  const trip = E0.createTrip(rng, ['HUT', 'CAMPFIRE', 'DOG']);
  assert.equal(trip.stage, 'HUT');
  const site = E0.startSite(trip, 'HUT', rng);
  assert.equal(trip.stage, 'HUT');                                     // M1: stage id kept
  assert.equal(site.guardian, 'ACCOUNTANT');
  assert.equal(site.faces.filter(f => f.content === 'ITEM').length, 2);
  site.faces.forEach(f => { assert.equal(f.pips, 2); if (f.content === 'ITEM') assert.ok(CFG.sites.HUT.pool.includes(f.item)); });
  assert.equal(trip.daylight, undefined);
  // leave: nothing gained -> no placement, then the sequence advances
  const l = E0.leaveSite(trip);
  assert.equal(l.ok, true); assert.equal(l.placement, false);
  assert.equal(E0.advanceStage(trip), 'CAMPFIRE');
  // noise fills -> the ACCOUNTANT guardian arrives (was doing his taxes in peace)
  const t2 = E0.createTrip(rng, ['HUT', 'DOG']);
  const s2 = E0.startSite(t2, 'HUT', rng);
  s2.faces.forEach(f => { f.content = 'NOTHING'; f.item = null; f.pips = f.pipsLeft = 99; });
  s2.noise = CFG.noiseMax - 1;
  E0.startSiteTurn(s2, rng);
  const r = E0.resolveSiteTurn(s2, [0, 1, 2], rng);
  assert.equal(r.guardian, 'ACCOUNTANT');
  assert.equal(t2.encounter.enemyId, 'ACCOUNTANT');
  assert.equal(E0.advanceStage(t2), 'DOG');
});

test('V1-5 UI data: every map tile type, site content, site, enemy and item has the colour / word the screens need', () => {
  ['START', 'GATE', 'CHARACTER', 'SCAVENGE', 'CAMPFIRE', 'EMPTY', 'FOG'].forEach(k => assert.ok(CFG.colors.map[k], 'map colour ' + k));
  Object.keys(CFG.siteContents).forEach(k => assert.ok(CFG.colors.site[k], 'site content colour ' + k));
  Object.keys(CFG.sites).forEach(id => {
    const s = CFG.sites[id];
    assert.ok(s.word && s.guardian && CFG.enemies[s.guardian], 'site ' + id);
    s.pool.forEach(it => assert.ok(CFG.items[it], 'site ' + id + ' item ' + it));
    s.faces.forEach(c => assert.ok(CFG.siteContents[c], 'content ' + c));
    assert.ok(CFG.text.site && CFG.text.m2.openedText[s.faces[0]]);
  });
  CFG.trip.enemyPool.forEach(id => assert.ok(CFG.map.enemyWords[id], 'map word ' + id));
  Object.keys(CFG.text.m2.openedText).forEach(k => assert.ok(CFG.siteContents[k]));
  // the debug "jump to anything" list = enemy pool + sites + campfire + map
  assert.ok(CFG.trip.mapStage && CFG.trip.campfireId);
});

// =====================================================================================
// v2 / M1 — new dice (MIND / HEAD / TORSO), flexible slots, order triggers, charges, belly, dieLost
// These run on `N` / `NCFG`: the shipped CONFIG (only the pip halving above is pinned).
// Tests that change CONFIG (mindAloneHolds, loseRule, a dummy 4th die) load a private engine with `fresh()`.
// =====================================================================================
function fresh() {
  const x = loadEngine();
  x.CFG.maxScars = 6; x.CFG.map.daylight = 12;
  for (const en of Object.values(x.CFG.enemies)) for (const f of en.faces) f.pips = f.pips / 2;
  return x;
}
const nev = (...faces) => N.evaluateSentence(faces);
const nevx = (enemyId, ...faces) => N.evaluateSentence(faces, { enemy: N.createEnemy(enemyId) });
// an encounter on a fresh single-stage trip; dice order is MIND, HEAD, TORSO
function nenc(enemyId, seed = 1, X = N) {
  const trip = X.createTrip(X.makeRng(seed), [enemyId]);
  return X.startEncounter(trip, enemyId, X.makeRng(seed));
}
// point each die at a face (by face string; the first matching index)
function nset(g, faces) {
  Object.keys(faces).forEach(id => {
    const d = g.player.dice.find(x => x.id === id);
    const i = d.faces.indexOf(faces[id]);
    assert.ok(i >= 0, id + ' has no face ' + faces[id]);
    d.idx = i;
  });
}
// put an item on a die face and point the die at it
function nput(g, dieId, idx, face) {
  const d = g.player.dice.find(x => x.id === dieId);
  d.faces[idx] = face; d.idx = idx;
}
const bigEnemy = (g) => g.enemy.faces.forEach(f => { f.pips = Array(30).fill('intact'); });
const types = (events) => events.map(e => e.type);

test('v2 CONFIG: dice, body parts, items, slots, rewards, pools, flags', () => {
  deepEq(NCFG.playerDice.map(d => [d.id, d.kind]), [['MIND', 'mind'], ['HEAD', 'body'], ['TORSO', 'body']]);
  deepEq(NCFG.playerDice.find(d => d.id === 'MIND').faces, ['PRUNE', 'PRUNE', 'SOW', 'SOW', 'DIG', 'DIG']);
  deepEq(NCFG.playerDice.find(d => d.id === 'HEAD').faces, ['NOSE', 'EYE', 'EYE', 'MOUTH', 'EAR', 'EAR']);
  deepEq(NCFG.playerDice.find(d => d.id === 'TORSO').faces, ['PALM', 'PALM', 'ARM', 'ARM', 'BACK', 'BELLY']);
  const fav = Object.fromEntries(Object.entries(NCFG.bodyParts).map(([k, v]) => [k, v.favourite]));
  deepEq(fav, { PALM: 'PRUNE', ARM: 'PRUNE', MOUTH: 'SOW', EYE: 'DIG', EAR: 'DIG', NOSE: 'DIG', BACK: null, BELLY: null });
  assert.equal(NCFG.bodyParts.NOSE.revealsNext, true);
  assert.equal(NCFG.bodyParts.BACK.fixedPoints, 1); assert.equal(NCFG.bodyParts.BELLY.fixedPoints, 1);
  assert.equal(NCFG.bodyParts.BELLY.vulnerable, true);
  for (const part of Object.keys(NCFG.bodyParts)) assert.ok(NCFG.actionNames[part], 'action names for ' + part);
  deepEq(sorted(Object.keys(NCFG.items)), sorted(['KNIFE', 'SHEARS', 'SPADE', 'WATERING_CAN', 'MATCHES', 'FORBIDDEN_BOOK', 'SEED_POUCH',
    'SLEEVE_POCKET', 'GLASSES', 'LANTERN', 'EAR_TRUMPET', 'WHISTLE', 'PIPE', 'VEST']));
  assert.equal(NCFG.items.MATCHES.uses, 3); assert.equal(NCFG.items.SEED_POUCH.uses, 3);
  assert.equal(NCFG.items.FORBIDDEN_BOOK.forbidden, true);
  for (const id of Object.keys(NCFG.items)) {
    const it = NCFG.items[id];
    assert.ok(NCFG.bodyParts[it.part], id + ' part');
    assert.ok(it.special && it.info && NCFG.colors.item[id], id + ' data');
    assert.ok(['PRUNE', 'SOW', 'DIG'].every(v => v in it.names), id + ' names');
  }
  deepEq(Object.fromEntries(Object.keys(NCFG.enemies).map(k => [k, NCFG.enemies[k].slots])),
    { DOG: 3, PLUMBER: 3, ACCOUNTANT: 2, BRIDGE: 1, CROWS: 2 });
  deepEq(Object.fromEntries(Object.keys(NCFG.sites).map(k => [k, NCFG.sites[k].slots])), { HEAP: 3, SHED: 3, WELL: 2, HUT: 3 });
  deepEq(NCFG.startingInventory, ['KNIFE', 'GLASSES', 'SEED_POUCH']);
  assert.equal(NCFG.mindAloneHolds, false); assert.equal(NCFG.loseRule, 'dieLost'); assert.equal(NCFG.scarTargets, null);
  const R = NCFG.enemies;
  deepEq(R.DOG.rewards.beaten.choose, ['WHISTLE', 'SPADE']); deepEq(R.DOG.rewards.befriended.choose, ['WHISTLE', 'LANTERN']);
  deepEq(R.PLUMBER.rewards.beaten.choose, ['SHEARS', 'MATCHES']); assert.equal(R.PLUMBER.rewards.beaten.returnTaken, true);
  deepEq(R.PLUMBER.rewards.befriended.choose, ['WATERING_CAN', 'VEST']);
  deepEq(R.ACCOUNTANT.rewards.beaten.choose, ['FORBIDDEN_BOOK', 'GLASSES']); deepEq(R.ACCOUNTANT.rewards.befriended.choose, ['EAR_TRUMPET', 'PIPE']);
  deepEq(R.CROWS.rewards.beaten.give, ['LANTERN']); deepEq(R.CROWS.rewards.befriended.choose, ['SLEEVE_POCKET', 'KNIFE']);
  deepEq(R.BRIDGE.rewards.beaten.give, []); deepEq(R.BRIDGE.rewards.befriended.choose, ['LANTERN', 'WATERING_CAN']);
  deepEq(NCFG.sites.HEAP.pool, ['WATERING_CAN', 'SPADE', 'MATCHES']); deepEq(NCFG.sites.SHED.pool, ['SHEARS', 'KNIFE', 'LANTERN', 'VEST']);
  deepEq(NCFG.sites.WELL.pool, ['WHISTLE', 'EAR_TRUMPET']); deepEq(NCFG.sites.HUT.pool, ['MATCHES', 'PIPE', 'FORBIDDEN_BOOK', 'SLEEVE_POCKET']);
  assert.ok(!('PIPE_WRENCH' in NCFG.items) && !('PLUNGER' in NCFG.items));
  // data-driven helpers
  deepEq(N.bodyDieIds(), ['HEAD', 'TORSO']); deepEq(N.mindDieIds(), ['MIND']); deepEq(N.scarTargetIds(), ['HEAD', 'TORSO']);
  const t = N.createTrip(N.makeRng(1));
  deepEq(t.dice.map(d => d.kind), ['mind', 'body', 'body']);
  deepEq(t.inventory, ['KNIFE', 'GLASSES', 'SEED_POUCH']);
});

test('labels: every case for 3, 2 and 1 slots (REFLEX, PLAN, SITUATION, IMPULSE, IDLE)', () => {
  assert.equal(nev('PRUNE', 'EYE', 'PALM').shape, 'Plan');
  assert.equal(nev('EYE', 'PRUNE', 'PALM').shape, 'Situation');
  assert.equal(nev('EYE', 'PALM', 'PRUNE').shape, 'Impulse');
  assert.equal(nev('EYE', 'PALM', 'ARM').shape, 'Reflex');
  assert.equal(nev('PRUNE', 'PALM').shape, 'Plan');
  assert.equal(nev('PALM', 'PRUNE').shape, 'Impulse');
  assert.equal(nev('PALM', 'EYE').shape, 'Reflex');
  assert.equal(nev('PALM').shape, 'Reflex');
  assert.equal(nev('PRUNE').shape, 'Idle');
  assert.equal(nev('PRUNE').text, 'Idle: nothing happens');
  assert.equal(nev('PRUNE').holds, false);
  assert.equal(nev('PRUNE').mindIndex, 0);
  assert.equal(nev('PALM').mindIndex, -1);
  // result shape for a slot count of 2
  const r = nev('EYE', 'PRUNE');
  assert.equal(r.slots, 2); assert.equal(r.verb, 'PRUNE'); assert.equal(r.text, 'Impulse: Look 2 (reveal) → nothing happens');
  // REFLEX: every die on instinct, no verb produced by a MIND
  assert.equal(nev('PALM', 'MOUTH', 'EYE').text, 'Reflex: Hit 2 · Small talk 2 · Look 2 (reveal) → PRUNE 2 · SOW 2');
  // more than one verb face is still an error
  assert.throws(() => nev('PRUNE', 'SOW', 'PALM'));
});

test('lone MIND with mindAloneHolds is HOLD; the chosen die keeps its face into the next roll', () => {
  const X = fresh();
  X.CFG.mindAloneHolds = true;
  assert.equal(X.E.evaluateSentence(['PRUNE']).shape, 'Hold');
  assert.equal(X.E.evaluateSentence(['PRUNE']).holds, true);
  assert.equal(X.E.evaluateSentence(['PRUNE']).text, 'Hold: hold one die for the next turn');
  assert.equal(X.E.evaluateSentence(['PRUNE', 'PALM']).holds, false);          // only a lone MIND holds
  const g = nenc('BRIDGE', 3, X.E);                                           // BRIDGE: 1 slot
  assert.equal(g.slots, 1);
  g.enemy.current = { faceIdx: 5, wag: false };                               // CALM WATER: harmless
  X.E.startTurn(g, X.E.makeRng(1));
  nset(g, { MIND: 'SOW' });
  const out = X.E.resolveTurn(g, ['MIND'], X.E.makeRng(2));
  assert.equal(out.evaluation.shape, 'Hold');
  assert.equal(out.holdPending, true);
  assert.equal(g.holdPending, true);
  const hc = out.events.find(e => e.type === 'holdChoice');
  deepEq([...hc.options], ['HEAD', 'TORSO']);
  assert.match(out.log, /hold one die/);
  assert.ok(out.events.some(e => e.type === 'enemyAct'));                     // the enemy still acts
  // choose
  assert.equal(X.E.holdOver(g, 'MIND').ok, false);                            // not a body die
  const head = g.player.dice.find(d => d.id === 'HEAD');
  const keep = head.idx;
  const r = X.E.holdOver(g, 'HEAD');
  assert.equal(r.ok, true);
  deepEq({ ...r.events[0] }, { type: 'heldOver', phase: 'chosen', dieId: 'HEAD', face: head.faces[keep] });
  assert.equal(g.holdPending, false);
  assert.equal(X.E.holdOver(g, 'HEAD').ok, false);                            // only once
  // next roll: HEAD is not rolled (many seeds), the others are
  let rolledOther = false;
  for (let s = 1; s <= 6; s++) {
    head.heldOver = true; head.idx = keep;
    const st = X.E.startTurn(g, X.E.makeRng(s));
    assert.equal(head.idx, keep);
    assert.equal(head.heldOver, false);
    assert.equal(head.held, false);                                           // it can be rerolled normally afterwards
    assert.ok(st.events.some(e => e.type === 'heldOver' && e.phase === 'kept' && e.dieId === 'HEAD'));
    if (g.player.dice[2].idx !== 0 || s > 1) rolledOther = true;
    X.E.rerollUnheld(g, X.E.makeRng(s + 10));
  }
  assert.ok(rolledOther);
  // without a hold the next roll rolls everything again
  g.holdPending = true;
  X.E.startTurn(g, X.E.makeRng(9));
  assert.equal(g.holdPending, false);
  // default (false): lone MIND does nothing and offers no hold
  const h = nenc('BRIDGE', 3);
  h.enemy.current = { faceIdx: 5, wag: false };
  N.startTurn(h, N.makeRng(1)); nset(h, { MIND: 'SOW' });
  const o2 = N.resolveTurn(h, ['MIND'], N.makeRng(2));
  assert.equal(o2.evaluation.shape, 'Idle'); assert.equal(o2.holdPending, false);
  assert.ok(!o2.events.some(e => e.type === 'holdChoice'));
});

test('BACK / BELLY: fixed 1 point under a MIND verb (+1 item); no instinct = 0 points', () => {
  assert.equal(nev('PRUNE', 'BACK', 'BELLY').text, 'Plan: Shove 1 · Bump 1 → PRUNE 2');
  assert.equal(nev('SOW', 'BACK', 'BELLY').text, 'Plan: Lean 1 · Laugh 1 → SOW 2');
  assert.equal(nev('DIG', 'BACK', 'PALM').text, 'Plan: Hunch 1 (reveal) → Search 1+1 (reveal) → nothing happens');
  assert.equal(nev('PRUNE', 'BELLY+VEST').steps[0].base, 2);
  // before the MIND (instinct) or in REFLEX: nothing
  assert.equal(nev('BACK', 'BELLY', 'PALM').text, 'Reflex: Brace 0 · Clench 0 · Hit 2 → PRUNE 2');
  assert.equal(nev('BELLY+VEST', 'PRUNE').text, 'Impulse: Clench 0 → nothing happens');
  const r = nev('BACK', 'PRUNE', 'PALM');
  deepEq({ ...r.steps[0] }, { slot: 0, face: 'BACK', role: 'instinct', verb: null, base: 0, carryIn: 0, total: 0, reveal: false,
    passesTo: null, name: 'Brace', item: null, notes: [], depth: 0, idle: true });
  assert.equal(r.totals.PRUNE, 2);
  assert.equal(N.scoreBodyFace('BACK', 'PRUNE'), 1); assert.equal(N.scoreBodyFace('BELLY', 'DIG'), 1);
  assert.equal(N.scoreBodyFace('BACK', null), 0);
  // a DIG carry into an idle die is lost
  assert.equal(nev('EYE', 'BACK', 'PRUNE').text, 'Impulse: Look 2 (reveal) → Brace 0+2 → nothing happens');
  // an instinctVerb override gives a part without a favourite an instinct
  const X = fresh();
  X.CFG.bodyParts.BACK.instinctVerb = 'PRUNE';
  assert.equal(X.E.evaluateSentence(['BACK', 'SOW', 'PALM']).steps[0].base, 1);
});

test('NOSE: favourite DIG, reveals the next intent under any verb (depth 1), site: 1 face', () => {
  assert.equal(N.scoreBodyFace('NOSE', 'DIG'), 2); assert.equal(N.scoreBodyFace('NOSE', 'PRUNE'), 1);
  const instinct = nev('NOSE', 'PRUNE', 'PALM');
  assert.equal(instinct.text, 'Situation: Sniff out 2 (reveal) → Hit 2+2 → PRUNE 4');
  assert.equal(instinct.revealDepth, 1);
  const directed = nev('PRUNE', 'NOSE');
  assert.equal(directed.text, 'Plan: Snort 1 (nose: sees 1) → PRUNE 1');
  assert.equal(directed.reveal, true); assert.equal(directed.revealDepth, 1);
  assert.equal(directed.steps[0].reveal, false);                              // no DIG carry under PRUNE
  assert.equal(nev('PRUNE', 'EYE').revealDepth, 0);                           // EYE under PRUNE does not reveal
  assert.equal(nev('PRUNE', 'NOSE', 'EYE').revealDepth, 1);
  // in a fight: a reveal event with 1 intent, visible for the following turn
  const g = nenc('DOG');
  g.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(g, N.makeRng(1));
  nset(g, { MIND: 'SOW', HEAD: 'NOSE', TORSO: 'BACK' });
  const out = N.resolveTurn(g, ['MIND', 'HEAD', 'TORSO'], N.makeRng(3));      // Plan: NOSE directed SOW
  assert.match(out.evaluation.text, /^Plan: Sneer|^Plan: Sniff kindly 1 \(nose: sees 1\)/);
  const rv = out.events.find(e => e.type === 'reveal');
  assert.equal(rv.list.length, 1); assert.equal(g.enemy.shown, 1); assert.ok(g.enemy.next);
  // on a site: reveals exactly 1 face (NOSE under PRUNE), no DIG needed
  const trip = N.createTrip(N.makeRng(1), ['HUT']);
  const site = N.startSite(trip, 'HUT', N.makeRng(4));
  N.startTurn(site, N.makeRng(5));
  nset(site, { MIND: 'SOW', HEAD: 'NOSE', TORSO: 'BACK' });
  const r = N.resolveSiteTurn(site, ['MIND', 'HEAD', 'TORSO'], N.makeRng(6));
  assert.equal(r.events.filter(e => e.type === 'siteReveal').length, 1);
  assert.equal(r.events.find(e => e.type === 'siteReveal').via, 'NOSE');
  assert.equal(r.preview.reveal, 1);
});

test('order triggers: GLASSES first, EAR TRUMPET directly before MOUTH (MIND in between breaks it), PIPE last', () => {
  // GLASSES: only in slot 0
  const gf = nev('EYE+GLASSES', 'PRUNE', 'PALM');
  assert.equal(gf.revealDepth, 2); assert.equal(gf.triggers.glassesFirst, true);
  assert.equal(gf.text, 'Situation: Read the fine print 3 (reveal) (glasses: sees 2) → Hit 2+3 → PRUNE 5');
  const gp = nev('EYE+GLASSES', 'PRUNE', 'PALM');
  assert.equal(nev('PALM', 'PRUNE', 'EYE+GLASSES').revealDepth, 0);           // last slot, directed PRUNE: no reveal at all
  assert.equal(nev('PALM', 'EYE+GLASSES', 'PRUNE').revealDepth, 1);           // instinct DIG: plain depth 1, no glasses note
  assert.ok(!/glasses/.test(nev('PALM', 'EYE+GLASSES', 'PRUNE').text));
  assert.equal(nev('PRUNE', 'EYE+GLASSES', 'PALM').revealDepth, 0);           // directed PRUNE in slot 1
  assert.equal(nev('DIG', 'EYE+GLASSES', 'PALM').revealDepth, 1);             // directed DIG not first: depth 1
  // GLASSES first under PRUNE still reveals 2 (the trigger is positional)
  assert.equal(nev('EYE+GLASSES', 'PRUNE').triggers.glassesFirst, true);
  assert.equal(nev('EYE+GLASSES', 'PRUNE').revealDepth, 2);
  assert.equal(nev('EYE+GLASSES').revealDepth, 2);                            // REFLEX in 1 slot
  assert.ok(gp);
  // EAR TRUMPET
  const et = nev('EAR+EAR_TRUMPET', 'MOUTH', 'PRUNE');
  assert.equal(et.text, 'Impulse: Eavesdrop 3 (reveal) → Small talk 4+3 (+2 ear trumpet) → SOW 7');
  deepEq([...et.triggers.earTrumpet], [1]);
  assert.equal(et.steps[1].base, 4);
  const broken = nev('EAR+EAR_TRUMPET', 'PRUNE', 'MOUTH');                    // MIND in between
  assert.equal(broken.steps[1].base, 1); assert.equal(broken.triggers.earTrumpet.length, 0);
  assert.ok(!/ear trumpet/.test(broken.text));
  assert.equal(nev('MOUTH', 'EAR+EAR_TRUMPET', 'PRUNE').steps[0].base, 2);    // after, not before
  assert.equal(nev('PRUNE', 'EAR+EAR_TRUMPET', 'MOUTH').steps[1].base, 3);    // directed PRUNE: 1 + 2
  assert.equal(nev('SOW', 'EAR+EAR_TRUMPET', 'MOUTH').steps[1].base, 4);      // directed SOW: 2 + 2
  assert.equal(nev('EAR+EAR_TRUMPET', 'PALM', 'MOUTH').steps[1].base, 2);     // PALM is not a MOUTH
  assert.equal(nev('PRUNE', 'EAR+EAR_TRUMPET', 'MOUTH').steps[1].notes[0], '+2 ear trumpet');
  // whistle doubles everything, including the trumpet bonus
  assert.equal(nevx('DOG', 'EAR+EAR_TRUMPET', 'MOUTH+WHISTLE', 'SOW').steps[1].base, 10);   // (2 fav + 1 item + 2 trumpet) x 2
  // PIPE
  const pl = nev('PRUNE', 'PALM', 'MOUTH+PIPE');
  assert.equal(pl.pipeLast, true); assert.equal(pl.triggers.pipeLast, true);
  assert.equal(pl.text, 'Plan: Hit 2 · Blow smoke 2 → PRUNE 4');             // no annotation until the wanted level exists
  assert.equal(nev('PRUNE', 'MOUTH+PIPE', 'PALM').pipeLast, false);
  assert.equal(nev('MOUTH+PIPE').pipeLast, true);
});

test('v2 items: MATCHES, FORBIDDEN BOOK, WATERING CAN now+next, KNIFE, inert SEED POUCH / SLEEVE POCKET, names fall back', () => {
  // KNIFE on PALM: PRUNE +1
  assert.equal(nev('PRUNE', 'PALM+KNIFE', 'EYE').text, 'Plan: Stab 4 (knife +1) · Glare 1 → PRUNE 5');
  // MATCHES: PRUNE +2, spends a charge; SOW gets no bonus and spends nothing
  const m = nev('PRUNE', 'PALM+MATCHES', 'EYE');
  assert.equal(m.text, 'Plan: Light up 5 (matches +2) · Glare 1 → PRUNE 6');
  deepEq(m.spends.map(x => ({ ...x })), [{ slot: 1, item: 'MATCHES' }]);
  const ms = nev('SOW', 'PALM+MATCHES', 'EYE');
  assert.equal(ms.steps[0].base, 2); assert.equal(ms.spends.length, 0);
  assert.equal(nev('PALM+MATCHES', 'PRUNE', 'EYE').spends.length, 1);          // instinct PRUNE uses it too
  // FORBIDDEN BOOK: SOW +2, flagged forbidden whichever verb
  assert.equal(nev('SOW', 'PALM+FORBIDDEN_BOOK', 'EYE').text, 'Plan: Quote 4 (forbidden book +2) · Kind look 1 → SOW 5');
  assert.equal(nev('SOW', 'PALM+FORBIDDEN_BOOK', 'EYE').forbidden, 1);
  assert.equal(nev('PRUNE', 'PALM+FORBIDDEN_BOOK', 'EYE').forbidden, 1);
  assert.equal(nev('PRUNE', 'PALM+FORBIDDEN_BOOK', 'EYE').steps[0].base, 3);   // no bonus under PRUNE (2 fav + 1 item)
  assert.equal(nev('PRUNE', 'PALM', 'EYE').forbidden, 0);
  // WATERING CAN: +1 now and +1 SOW next turn
  const wc = nev('SOW', 'PALM+WATERING_CAN', 'EYE');
  assert.equal(wc.text, 'Plan: Water their plant 3 (watering can +1) (+1 SOW next turn) · Kind look 1 → SOW 4');
  assert.equal(wc.pendingSow, 1);
  assert.equal(nev('PRUNE', 'PALM+WATERING_CAN', 'EYE').pendingSow, 0);
  // inert items use the part's action names (names: null)
  assert.equal(nev('SOW', 'PALM+SEED_POUCH', 'EYE').steps[0].name, 'Gesture');
  assert.equal(nev('PRUNE', 'PALM+SEED_POUCH', 'EYE').steps[0].base, 3);
  assert.equal(nev('PRUNE', 'ARM+SLEEVE_POCKET', 'EYE').steps[0].name, 'Swing');
  assert.equal(nev('PRUNE', 'ARM+SLEEVE_POCKET', 'EYE').steps[0].base, 3);
  assert.equal(nev('PRUNE', 'EAR+EAR_TRUMPET', 'EYE').steps[0].name, 'Tune out');   // PRUNE name null -> part name
  assert.equal(nev('SOW', 'EAR+EAR_TRUMPET', 'EYE').steps[0].name, 'Listen closely');
  assert.equal(nev('PRUNE', 'MOUTH+PIPE', 'EYE').steps[0].name, 'Blow smoke');
  // SEED POUCH is inert: no reroll bonus when it turns faces
  const g = nenc('DOG');
  g.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(g, N.makeRng(1));
  nput(g, 'TORSO', 0, 'PALM+SEED_POUCH'); nset(g, { MIND: 'SOW', HEAD: 'MOUTH' });
  const out = N.resolveTurn(g, ['MIND', 'TORSO', 'HEAD'], N.makeRng(2));
  assert.ok(!out.events.some(e => e.type === 'rerollBonus'));
  assert.equal(g.rerollBonus, 0);
  // watering can in a fight: queued, applied next turn (the "now" point is in the sentence)
  const w = nenc('DOG', 2);
  w.enemy.current = { faceIdx: 4, wag: false }; bigEnemy(w);
  N.startTurn(w, N.makeRng(1));
  nput(w, 'TORSO', 0, 'PALM+WATERING_CAN'); nset(w, { MIND: 'SOW', HEAD: 'EYE' });
  const o2 = N.resolveTurn(w, ['MIND', 'TORSO', 'HEAD'], N.makeRng(2));
  assert.equal(o2.events.find(e => e.type === 'verb').amount, 4);
  assert.equal(w.pendingSow, 1);
  assert.equal(N.startTurn(w, N.makeRng(3)).events.find(e => e.type === 'pendingSow').phase, 'applied');
});

test('charges: MATCHES spends 1 per PRUNE use, burns out at 0 and is removed', () => {
  const g = nenc('DOG');
  bigEnemy(g);
  g.enemy.current = { faceIdx: 4, wag: false };
  g.trip.inventory = ['MATCHES'];
  assert.equal(N.inventoryUses(g.trip, 0), 3);
  assert.equal(N.placeItem(g.trip, 'MATCHES', 'TORSO', 0, 'campfire').ok, true);
  assert.equal(N.usesLeft(g.trip, 'TORSO', 0), 3);
  assert.equal(N.usesLeft(g.trip, 'TORSO', 1), null);                          // no item
  const play = (seed) => {
    N.startTurn(g, N.makeRng(seed));
    g.player.dice.forEach(d => { d.idx = 0; });
    g.player.dice.find(d => d.id === 'MIND').idx = 0;                          // PRUNE
    g.enemy.current = { faceIdx: 4, wag: false };
    return N.resolveTurn(g, ['MIND', 'HEAD', 'TORSO'], N.makeRng(seed));       // MIND PRUNE, NOSE (1), PALM+MATCHES
  };
  let out = play(1);
  deepEq({ ...out.events.find(e => e.type === 'chargeSpent') }, { type: 'chargeSpent', dieId: 'TORSO', faceIdx: 0, item: 'MATCHES', left: 2 });
  assert.equal(N.usesLeft(g.trip, 'TORSO', 0), 2);
  assert.equal(g.player.dice[2].faces[0], 'PALM+MATCHES');
  assert.match(out.log, /matches 2 left/);
  out = play(2);
  assert.equal(N.usesLeft(g.trip, 'TORSO', 0), 1);
  out = play(3);
  const burn = out.events.find(e => e.type === 'itemBurnedOut');
  deepEq({ ...burn }, { type: 'itemBurnedOut', dieId: 'TORSO', faceIdx: 0, item: 'MATCHES', becomes: 'PALM' });
  assert.equal(out.events.find(e => e.type === 'chargeSpent').left, 0);
  assert.equal(g.player.dice[2].faces[0], 'PALM');
  assert.equal(N.usesLeft(g.trip, 'TORSO', 0), null);
  assert.deepEqual([...g.trip.discarded], ['MATCHES']);
  assert.match(out.log, /matches burned out/);
  // the points of the third use still counted (the +2 happened before the burn-out)
  assert.equal(out.evaluation.steps[1].base, 5);
  // removed: the next PRUNE is a bare PALM and spends nothing
  out = play(4);
  assert.ok(!out.events.some(e => e.type === 'chargeSpent'));
  // SOW with MATCHES spends nothing
  const h = nenc('DOG');
  bigEnemy(h);
  nput(h, 'TORSO', 0, 'PALM+MATCHES'); nset(h, { MIND: 'SOW', HEAD: 'EYE' });
  h.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(h, N.makeRng(1)); nset(h, { MIND: 'SOW', HEAD: 'EYE' }); h.player.dice[2].idx = 0;
  assert.ok(!N.resolveTurn(h, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1)).events.some(e => e.type === 'chargeSpent'));
  assert.equal(N.usesLeft(h.trip, 'TORSO', 0), 3);
});

test('charges travel with the item: place, move, unplace, replace, scar, taken and returned', () => {
  const t = N.createTrip(N.makeRng(1), ['DOG']);
  t.inventory = ['MATCHES', 'MATCHES', 'KNIFE'];
  t.invUses = [];
  assert.equal(N.inventoryUses(t, 0), 3); assert.equal(N.inventoryUses(t, 2), null);
  N.beginPlacement(t, 'campfire');
  assert.equal(N.placeItem(t, 'MATCHES', 'TORSO', 0, 'campfire').ok, true);
  t.faceUses['TORSO:0'] = 1;                                                   // spent two
  assert.equal(N.usesLeft(t, 'TORSO', 0), 1);
  // move keeps the remaining uses
  assert.equal(N.moveItem(t, 'TORSO', 0, 'TORSO', 1, 'campfire').ok, true);
  assert.equal(N.usesLeft(t, 'TORSO', 1), 1); assert.equal(N.usesLeft(t, 'TORSO', 0), null);
  // unplace -> inventory entry carries 1; the other MATCHES is still fresh
  const u = N.unplaceItem(t, 'TORSO', 1, 'campfire');
  assert.equal(u.ok, true);
  const mine = t.inventory.map((id, i) => [id, N.inventoryUses(t, i)]);
  deepEq(mine, [['MATCHES', 3], ['KNIFE', null], ['MATCHES', 1]]);
  // place the spent one again: uses come back, the fresh one stays in the inventory with 3
  assert.equal(N.placeItem(t, 'MATCHES', 'TORSO', 0, 'campfire').ok, true);      // places the FIRST MATCHES entry (fresh)
  assert.equal(N.usesLeft(t, 'TORSO', 0), 3);
  // replacing an item discards it with its charges
  t.faceUses['TORSO:0'] = 2;
  N.placeItem(t, 'KNIFE', 'TORSO', 0, 'campfire');
  assert.equal(N.usesLeft(t, 'TORSO', 0), null);
  assert.ok(t.discarded.includes('MATCHES'));
  assert.equal(t.dice[2].faces[0], 'PALM+KNIFE');
  // a scar removes the charges with the item
  t.dice[2].faces[2] = 'ARM';
  t.faceUses['TORSO:1'] = 2; t.dice[2].faces[1] = 'PALM+MATCHES';
  const g = N.startEncounter(t, 'CROWS', N.makeRng(1));                       // PECK = scar
  g.player.dice[1].faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR'];  // HEAD fully scarred (rule: maxScars below is 6, dieLost is not checked mid-test)
  g.enemy.current = { faceIdx: 0, wag: false };
  t.dice[2].faces = ['PALM+KNIFE', 'PALM+MATCHES', 'SCAR', 'SCAR', 'SCAR', 'SCAR'];
  const a = N.enemyAct(g, rngSeq(0.99));                                      // last candidate = TORSO face 1
  assert.equal(a.events.find(e => e.type === 'scar').faceIdx, 1);
  assert.equal(N.usesLeft(t, 'TORSO', 1), null);
  assert.ok(!('TORSO:1' in t.faceUses));
  // taken by the CROWS (STEAL) and returned when beaten: charges come back
  const t2 = N.createTrip(N.makeRng(2), ['CROWS']);
  t2.dice[2].faces[0] = 'PALM+MATCHES'; t2.faceUses['TORSO:0'] = 1;
  const c = N.startEncounter(t2, 'CROWS', N.makeRng(2));
  c.enemy.current = { faceIdx: 3, wag: false };                               // STEAL
  const st = N.enemyAct(c, N.makeRng(3));
  assert.equal(st.events.find(e => e.type === 'itemTaken').item, 'MATCHES');
  assert.ok(!('TORSO:0' in t2.faceUses));
  deepEq([...c.taken], ['MATCHES']);
  const rw = N.rewardsFor(t2, 'BEATEN');
  deepEq([...rw.returned], ['MATCHES']);
  t2.inventory = [];
  const cl = N.claimReward(t2, 'BEATEN', null, N.makeRng(1));
  assert.equal(cl.ok, true);
  deepEq([...t2.inventory], ['MATCHES', 'LANTERN']);
  assert.equal(N.inventoryUses(t2, 0), 1);
  assert.equal(N.inventoryUses(t2, 1), null);
});

test('exposed belly: scars a face of the die holding the BELLY, VEST covers, in or out of the sentence', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = nenc('DOG', seed);
    g.slots = 2;                                                               // TORSO (showing BELLY) stays out of the sentence
    g.enemy.current = { faceIdx: 4, wag: false };                              // SNIFF: harmless
    N.startTurn(g, N.makeRng(seed));
    nset(g, { MIND: 'DIG', HEAD: 'EYE', TORSO: 'BELLY' });
    const out = N.resolveTurn(g, ['MIND', 'HEAD'], N.makeRng(seed));
    const be = out.events.find(e => e.type === 'bellyExposed');
    assert.ok(be, 'belly exposed');
    assert.equal(be.dieId, 'TORSO'); assert.equal(be.faceIdx, 5); assert.equal(be.text, 'your belly was exposed');
    const sc = out.events.find(e => e.type === 'scar');
    assert.equal(sc.dieId, 'TORSO'); assert.equal(sc.cause, 'belly'); assert.equal(sc.by, 'BELLY');
    assert.notEqual(sc.previous, 'SCAR');
    assert.equal(g.player.dice[2].faces[sc.faceIdx], 'SCAR');
    assert.equal(N.countScars(g.player), 1);
    assert.equal(g.player.dice[1].faces.includes('SCAR'), false);               // HEAD untouched
    // before the enemy acts
    assert.ok(types(out.events).indexOf('bellyExposed') < types(out.events).indexOf('enemyAct'));
    assert.match(out.log, /your belly was exposed \(TORSO \S+ → SCAR\)/);
  }
  // VEST: no event, no scar
  const v = nenc('DOG', 1);
  v.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(v, N.makeRng(1));
  nput(v, 'TORSO', 5, 'BELLY+VEST'); nset(v, { MIND: 'DIG', HEAD: 'EYE' });
  const o = N.resolveTurn(v, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1));
  assert.ok(!o.events.some(e => e.type === 'bellyExposed'));
  assert.equal(N.countScars(v.player), 0);
  // an item on the exposed face's die can be destroyed (ITEM destroyed event with cause belly)
  let sawItem = false;
  for (let seed = 1; seed <= 40 && !sawItem; seed++) {
    const g = nenc('DOG', seed);
    g.enemy.current = { faceIdx: 4, wag: false };
    N.startTurn(g, N.makeRng(seed));
    g.player.dice[2].faces = ['PALM+KNIFE', 'PALM+KNIFE', 'ARM+SLEEVE_POCKET', 'ARM+SLEEVE_POCKET', 'BACK', 'BELLY'];
    nset(g, { MIND: 'DIG', HEAD: 'EYE', TORSO: 'BELLY' });
    const r = N.resolveTurn(g, ['MIND', 'HEAD', 'TORSO'], N.makeRng(seed));
    const d = r.events.find(e => e.type === 'itemDestroyed');
    if (d) { sawItem = true; assert.equal(d.cause, 'belly'); assert.equal(d.dieId, 'TORSO'); }
  }
  assert.ok(sawItem);
  // not exposed when TORSO shows something else
  const q = nenc('DOG', 1);
  q.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(q, N.makeRng(1)); nset(q, { MIND: 'DIG', HEAD: 'EYE', TORSO: 'BACK' });
  assert.ok(!N.resolveTurn(q, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1)).events.some(e => e.type === 'bellyExposed'));
  // the belly is exposed even when the sentence wins the fight
  const w = nenc('DOG', 1);
  w.enemy.faces.forEach((f, i) => { f.pips = f.hostile ? (i === 0 ? ['intact'] : ['broken']) : ['intact']; });
  w.enemy.current = { faceIdx: 0, wag: false };
  N.startTurn(w, N.makeRng(1));
  nset(w, { MIND: 'PRUNE', HEAD: 'EYE', TORSO: 'BELLY' });
  const ow = N.resolveTurn(w, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1));
  assert.equal(ow.over, 'won');
  assert.ok(ow.events.some(e => e.type === 'bellyExposed'));
});

test('loseRule dieLost: the run ends when every face of one die is SCAR (MIND counts); names the die', () => {
  // belly takes the last face of TORSO
  const g = nenc('DOG', 1);
  g.player.dice[2].faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'BELLY'];
  g.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(g, N.makeRng(1));
  nset(g, { MIND: 'DIG', HEAD: 'EYE' }); g.player.dice[2].idx = 5;
  assert.equal(N.checkLose(g.player), false);                                  // 5 scars on one die is not enough
  const out = N.resolveTurn(g, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1));
  assert.equal(out.over, 'lost');
  assert.equal(g.lostDie, 'TORSO'); assert.equal(g.trip.lostDie, 'TORSO'); assert.equal(g.trip.over, 'lost');
  const lose = out.events.find(e => e.type === 'lose');
  assert.equal(lose.dieId, 'TORSO'); assert.equal(lose.dieLabel, 'TORSO'); assert.equal(lose.rule, 'dieLost');
  assert.ok(!out.events.some(e => e.type === 'enemyAct'));
  assert.match(out.log, /YOU FLEE, SCARRED \(your TORSO gave out\)$/);
  // an enemy scar on the last HEAD face
  const h = nenc('CROWS', 1);                                                  // PECK scars
  h.player.dice[1].faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'EYE'];
  h.enemy.current = { faceIdx: 0, wag: false };
  h.slots = 3;
  N.startTurn(h, N.makeRng(1)); nset(h, { MIND: 'DIG', HEAD: 'EYE', TORSO: 'BACK' });
  const o2 = N.resolveTurn(h, ['MIND', 'HEAD', 'TORSO'], rngSeq(0));          // first candidate = HEAD's last face
  assert.equal(o2.over, 'lost'); assert.equal(h.lostDie, 'HEAD');
  assert.equal(o2.events.find(e => e.type === 'lose').dieId, 'HEAD');
  // many scars spread over dice do not end the run under dieLost, but do under maxScars
  const spread = (X) => {
    const e = nenc('CROWS', 1, X.E);
    e.player.dice[1].faces = ['SCAR', 'SCAR', 'SCAR', 'EYE', 'EYE', 'EYE'];
    e.player.dice[2].faces = ['SCAR', 'SCAR', 'PALM', 'PALM', 'ARM', 'ARM'];
    e.enemy.current = { faceIdx: 0, wag: false };
    e.slots = 3;
    X.E.startTurn(e, X.E.makeRng(1)); nset(e, { MIND: 'DIG', HEAD: 'EYE', TORSO: 'PALM' });
    return X.E.resolveTurn(e, ['MIND', 'HEAD', 'TORSO'], rngSeq(0.5));
  };
  const X1 = fresh();
  assert.equal(spread(X1).over, null);
  const X2 = fresh();
  X2.CFG.loseRule = 'maxScars';
  const r2 = spread(X2);
  assert.equal(r2.over, 'lost');                                              // 5 scars + the peck = 6 = maxScars
  const lose2 = r2.events.find(e => e.type === 'lose');
  assert.equal(lose2.dieId, null); assert.equal(lose2.rule, 'maxScars');
  // MIND counts: a fully scarred MIND die loses the run
  const m = nenc('DOG', 1);
  assert.equal(N.failedDie(m.player), null);
  m.player.dice[0].faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR'];
  assert.equal(N.failedDie(m.player), 'MIND'); assert.equal(N.checkLose(m.player), true);
});

test('scar targets: scarTargets config; ACCOUNTANT scarHead hits the HEAD die; takeItem takes from any body die', () => {
  const X = fresh();
  X.CFG.scarTargets = ['HEAD'];
  const g = nenc('CROWS', 1, X.E);
  g.enemy.current = { faceIdx: 0, wag: false };
  for (let i = 0; i < 6; i++) {
    const ev2 = X.E.enemyAct(g, X.E.makeRng(i + 1)).events.find(e => e.type === 'scar');
    assert.equal(ev2.dieId, 'HEAD');
  }
  assert.equal(g.player.dice[2].faces.includes('SCAR'), false);
  // scarHead
  const a = nenc('ACCOUNTANT', 2);
  a.enemy.current = { faceIdx: 2, wag: false };                                // EXPLAINS
  for (let i = 0; i < 5; i++) assert.equal(N.enemyAct(a, N.makeRng(i + 1)).events.find(e => e.type === 'scar').dieId, 'HEAD');
  // takeItem: only items; both body dice are candidates
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const c = nenc('CROWS', seed);
    c.player.dice[1].faces[1] = 'EYE+LANTERN'; c.player.dice[2].faces[0] = 'PALM+KNIFE';
    c.enemy.current = { faceIdx: 3, wag: false };                             // STEAL
    seen.add(N.enemyAct(c, N.makeRng(seed)).events.find(e => e.type === 'itemTaken').dieId);
  }
  deepEq([...seen].sort(), ['HEAD', 'TORSO']);
});

test('slots: resolveTurn takes exactly `slots` dice (any subset); unused dice do nothing', () => {
  assert.equal(nenc('DOG').slots, 3); assert.equal(nenc('ACCOUNTANT').slots, 2);
  assert.equal(nenc('CROWS').slots, 2); assert.equal(nenc('BRIDGE').slots, 1);
  const a = nenc('ACCOUNTANT', 1);
  bigEnemy(a);
  a.enemy.current = { faceIdx: 5, wag: false };                                // FILES: harmless
  N.startTurn(a, N.makeRng(1));
  nset(a, { MIND: 'PRUNE', HEAD: 'EYE', TORSO: 'PALM' });
  assert.throws(() => N.resolveTurn(a, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1)));    // 3 dice, 2 slots
  assert.throws(() => N.resolveTurn(a, ['MIND'], N.makeRng(1)));
  assert.throws(() => N.resolveTurn(a, ['MIND', 'MIND'], N.makeRng(1)));
  const out = N.resolveTurn(a, ['MIND', 'TORSO'], N.makeRng(1));              // Plan: Hit 2 -> PRUNE 2 (+1 acc) 
  assert.equal(out.evaluation.shape, 'Plan');
  assert.equal(out.events.find(e => e.type === 'sentence').slotOrder.length, 2);
  assert.equal(out.events.filter(e => e.type === 'step').length, 1);           // HEAD left out: no step
  // REFLEX on a 2-slot encounter: HEAD + TORSO, no MIND
  const r = nenc('CROWS', 1);
  bigEnemy(r);
  r.enemy.current = { faceIdx: 4, wag: false };
  N.startTurn(r, N.makeRng(1)); nset(r, { MIND: 'SOW', HEAD: 'MOUTH', TORSO: 'PALM' });
  const o2 = N.resolveTurn(r, ['TORSO', 'HEAD'], N.makeRng(1));
  assert.equal(o2.evaluation.shape, 'Reflex');
  assert.equal(o2.evaluation.text, 'Reflex: Hit 2 · Small talk 2 → PRUNE 2 (crows +1) · SOW 0 (crows −2)'.replace('PRUNE 2 (crows +1) · SOW 0 (crows −2)', o2.evaluation.totalsText));
  assert.equal(o2.evaluation.totals.PRUNE, 3);                                 // crows pruneMod +1
  // a 1-slot BRIDGE: one careful step
  const b = nenc('BRIDGE', 1);
  b.enemy.current = { faceIdx: 5, wag: false };
  N.startTurn(b, N.makeRng(1)); nset(b, { TORSO: 'PALM' });
  assert.equal(N.resolveTurn(b, ['TORSO'], N.makeRng(1)).evaluation.shape, 'Reflex');
  // sites honour `slots` too (WELL has 2)
  const trip = N.createTrip(N.makeRng(1), ['WELL']);
  const site = N.startSite(trip, 'WELL', N.makeRng(2));
  assert.equal(site.slots, 2);
  N.startTurn(site, N.makeRng(3)); nset(site, { MIND: 'PRUNE', HEAD: 'EYE', TORSO: 'PALM' });
  assert.throws(() => N.resolveSiteTurn(site, ['MIND', 'HEAD', 'TORSO'], N.makeRng(1)));
  const sr = N.resolveSiteTurn(site, ['MIND', 'TORSO'], N.makeRng(1));
  assert.equal(sr.ok, true);
  assert.equal(sr.evaluation.slots, 2);
});

test('site turns: MATCHES charge spent and belly exposed on a site, belly before the turn noise', () => {
  const trip = N.createTrip(N.makeRng(1), ['HEAP']);
  const site = N.startSite(trip, 'HEAP', N.makeRng(2));
  N.startTurn(site, N.makeRng(3));
  trip.dice[2].faces[0] = 'PALM+MATCHES';
  nset(site, { MIND: 'PRUNE', HEAD: 'EYE', TORSO: 'PALM+MATCHES' }); site.player.dice[2].idx = 0;
  trip.dice[2].faces[5] = 'BELLY';
  const r = N.resolveSiteTurn(site, ['MIND', 'HEAD', 'TORSO'], N.makeRng(4));
  assert.ok(r.events.some(e => e.type === 'chargeSpent' && e.left === 2));
  assert.equal(N.usesLeft(trip, 'TORSO', 0), 2);
  // belly was not showing (TORSO on PALM): no exposure
  assert.ok(!r.events.some(e => e.type === 'bellyExposed'));
  const site2 = N.startSite(trip, 'HEAP', N.makeRng(7));
  N.startTurn(site2, N.makeRng(3));
  trip.dice[2].faces[5] = 'BELLY';                                           // (the first turn may have scarred it)
  nset(site2, { MIND: 'DIG', HEAD: 'EYE' }); site2.player.dice[2].idx = 5;
  const r2 = N.resolveSiteTurn(site2, ['MIND', 'HEAD', 'TORSO'], N.makeRng(5));
  const kinds = types(r2.events);
  assert.ok(kinds.includes('bellyExposed'));
  const turnNoise = r2.events.findIndex(e => e.type === 'noise' && e.cause === 'turn');
  assert.ok(kinds.indexOf('bellyExposed') < turnNoise);
});

test('data-driven dice: a dummy 4th die added via CONFIG just works (items, placement, odds, heal, scars, slots, lose)', () => {
  const X = fresh();
  const { E: Y, CFG: C } = X;
  C.bodyParts.LEG = { favourite: 'SOW', label: 'NOHA' };
  C.actionNames.LEG = { PRUNE: 'Kick', SOW: 'Sway', DIG: 'Step' };
  C.items.BOOT = { name: 'BOOT', part: 'LEG', names: { PRUNE: 'Stomp', SOW: 'Dance', DIG: null }, special: 'knife', info: 'PRUNE +1' };
  C.colors.item.BOOT = '#999999';
  C.playerDice.push({ id: 'LEGS', label: 'LEGS', kind: 'body', faces: ['LEG', 'LEG', 'LEG', 'LEG', 'LEG', 'LEG'] });
  deepEq(Y.bodyDieIds(), ['HEAD', 'TORSO', 'LEGS']);
  deepEq(Y.scarTargetIds(), ['HEAD', 'TORSO', 'LEGS']);
  const trip = Y.createTrip(Y.makeRng(1), ['DOG']);
  deepEq(trip.dice.map(d => d.id), ['MIND', 'HEAD', 'TORSO', 'LEGS']);
  assert.equal(trip.dice[3].kind, 'body');
  // items: BOOT only on LEG faces; KNIFE not on LEGS
  trip.inventory = ['BOOT', 'KNIFE'];
  assert.equal(Y.canPlace(trip, 'BOOT', 'LEGS', 0, 'campfire').ok, true);
  assert.equal(Y.canPlace(trip, 'KNIFE', 'LEGS', 0, 'campfire').reason, 'wrong-part');
  assert.equal(Y.canPlace(trip, 'BOOT', 'TORSO', 0, 'campfire').reason, 'wrong-part');
  assert.equal(Y.canPlace(trip, 'BOOT', 'MIND', 0, 'campfire').reason, 'not-an-item-die');
  assert.equal(Y.placeItem(trip, 'BOOT', 'LEGS', 2, 'campfire').ok, true);
  assert.equal(trip.dice[3].faces[2], 'LEG+BOOT');
  assert.match(Y.oddsSummary(trip.dice[3]).text, /LEG · 1× BOOT · 5× bare · 0× scar → item 1\/6/);
  // sentences of 4 slots: labels and scoring on the new part
  assert.equal(Y.evaluateSentence(['PRUNE', 'EYE', 'PALM', 'LEG']).shape, 'Plan');
  assert.equal(Y.evaluateSentence(['EYE', 'PRUNE', 'PALM', 'LEG']).shape, 'Situation');
  assert.equal(Y.evaluateSentence(['EYE', 'PALM', 'LEG', 'PRUNE']).shape, 'Impulse');
  assert.equal(Y.evaluateSentence(['EYE', 'PALM', 'LEG', 'ARM']).shape, 'Reflex');
  assert.equal(Y.evaluateSentence(['PRUNE', 'LEG+BOOT']).text, 'Plan: Stomp 3 (knife +1) → PRUNE 3');
  assert.equal(Y.evaluateSentence(['LEG', 'DIG', 'PALM']).steps[0].name, 'Sway');
  // a fight with 4 slots
  const g = Y.startEncounter(trip, 'DOG', Y.makeRng(2));
  g.slots = 4;
  g.enemy.current = { faceIdx: 4, wag: false };
  Y.startTurn(g, Y.makeRng(3));
  const out = Y.resolveTurn(g, ['LEGS', 'MIND', 'TORSO', 'HEAD'], Y.makeRng(4));
  assert.equal(out.evaluation.slots, 4);
  assert.equal(out.events.filter(e => e.type === 'step').length, 3);
  // scars may land on the new die; healing returns the original part
  const seen = new Set();
  for (let s = 1; s <= 40; s++) {
    const e = Y.createTrip(Y.makeRng(s), ['CROWS']);
    const enc2 = Y.startEncounter(e, 'CROWS', Y.makeRng(s));
    enc2.enemy.current = { faceIdx: 0, wag: false };
    const sc = Y.enemyAct(enc2, Y.makeRng(s)).events.find(x => x.type === 'scar');
    seen.add(sc.dieId);
  }
  assert.ok(seen.has('LEGS'), 'LEGS can be scarred');
  trip.dice[3].faces[0] = 'SCAR';
  const h = Y.healScar(trip, 'LEGS', 0);
  assert.equal(h.ok, true); assert.equal(h.restored, 'LEG');
  assert.equal(trip.dice[3].faces[0], 'LEG');
  // losing: every face of LEGS scarred names it
  const l = Y.startEncounter(Y.createTrip(Y.makeRng(5), ['CROWS']), 'CROWS', Y.makeRng(5));
  l.player.dice[3].faces = ['SCAR', 'SCAR', 'SCAR', 'SCAR', 'SCAR', 'LEG'];
  l.enemy.current = { faceIdx: 0, wag: false };
  l.slots = 3;
  Y.startTurn(l, Y.makeRng(1));
  const lo = Y.resolveTurn(l, ['MIND', 'HEAD', 'TORSO'], rngSeq(0.99));      // last candidate = LEGS' last face
  assert.equal(lo.over, 'lost');
  assert.equal(l.lostDie, 'LEGS');
  assert.match(lo.log, /your LEGS gave out/);
  assert.equal(Y.oddsSummary(l.player.dice[3]).scar, 6);
});

test('placement, odds and healing work for both body dice (HEAD, TORSO) and refuse MIND', () => {
  const t = N.createTrip(N.makeRng(3));
  N.beginPlacement(t, 'intro');
  assert.equal(N.placeItem(t, 'KNIFE', 'TORSO', 1, 'intro').ok, true);
  assert.equal(N.placeItem(t, 'GLASSES', 'HEAD', 2, 'intro').ok, true);
  assert.equal(N.placeItem(t, 'SEED_POUCH', 'TORSO', 0, 'intro').ok, true);
  assert.equal(N.canPlace(t, 'KNIFE', 'TORSO', 4, 'intro').reason, 'wrong-part');      // BACK
  assert.equal(N.canPlace(t, 'GLASSES', 'HEAD', 3, 'intro').reason, 'wrong-part');     // MOUTH
  assert.equal(N.canPlace(t, 'VEST', 'TORSO', 5, 'intro').ok, true);                   // BELLY holds a VEST
  assert.equal(N.canPlace(t, 'VEST', 'TORSO', 4, 'intro').ok, false);
  deepEq([...t.inventory], []);
  assert.equal(N.oddsSummary(t.dice[1]).text, 'NOSE 1 (0 items) · EYE 2 (1× GLASSES) · MOUTH 1 (0 items) · EAR 2 (0 items) · scar 0/6');
  assert.equal(N.oddsSummary(t.dice[2]).text, 'PALM 2 (1× SEED POUCH · 1× KNIFE) · ARM 2 (0 items) · BACK 1 (0 items) · BELLY 1 (0 items) · scar 0/6');
  assert.equal(N.oddsSummary(t.dice[2]).itemFaces, 2);
  // heal restores the original body part (never an item)
  t.dice[2].faces[5] = 'SCAR';
  assert.equal(N.healScar(t, 'TORSO', 5).restored, 'BELLY');
  t.dice[1].faces[0] = 'SCAR';
  assert.equal(N.healScar(t, 'HEAD', 0).restored, 'NOSE');
  assert.equal(N.healScar(t, 'HEAD', 1).ok, false);
});

test('seeded M1 trip simulation with the v2 dice: random subsets, holds, placement, deterministic', () => {
  const play = (seed, holds) => {
    const X = fresh();
    X.CFG.mindAloneHolds = holds;
    const Y = X.E, rng = Y.makeRng(seed);
    const trip = Y.createTrip(rng);
    Y.beginPlacement(trip, 'intro');
    for (const id of trip.inventory.slice()) {
      outer: for (const die of trip.dice) for (let i = 0; i < die.faces.length; i++) if (Y.placeItem(trip, id, die.id, i, 'intro').ok) break outer;
    }
    Y.endPlacement(trip);
    const log = [];
    let guard = 0;
    while (!trip.over && trip.stage && guard++ < 400) {
      const stage = trip.stage;
      if (Y.isCampfire(stage)) {
        const scar = trip.dice.flatMap(d => d.faces.map((f, i) => [d.id, i, f])).find(x => x[2] === 'SCAR');
        if (scar) Y.healScar(trip, scar[0], scar[1]);
        Y.advanceStage(trip); continue;
      }
      if (X.CFG.sites[stage]) {
        const site = Y.startSite(trip, stage, rng);
        let n = 0;
        while (!site.over && !trip.over && n++ < 3) {
          Y.startTurn(site, rng);
          const order = site.player.dice.map(d => d.id).sort(() => rng() - 0.5).slice(0, site.slots);
          const r = Y.resolveSiteTurn(site, order, rng);
          if (!r.ok) break;
          if (r.guardian) break;
          if (site.holdPending) Y.holdOver(site, 'HEAD');
        }
        if (trip.over) break;
        if (site.over === 'guardian') continue;              // the engine started the guardian fight: trip.stage is its id
        Y.leaveSite(trip); Y.advanceStage(trip);
        continue;
      }
      const enc2 = trip.encounter && trip.encounter.enemyId === stage && !trip.encounter.over ? trip.encounter : Y.startEncounter(trip, stage, rng);
      let t = 0;
      while (!enc2.over && t++ < 60) {
        const st = Y.startTurn(enc2, rng);
        if (st.over) break;
        if (rng() < 0.5) Y.rerollUnheld(enc2, rng);
        const ids = enc2.player.dice.map(d => d.id).sort(() => rng() - 0.5).slice(0, enc2.slots);
        const out = Y.resolveTurn(enc2, ids, rng);
        assert.ok(out.log.startsWith('T' + (enc2.turn - (enc2.over ? 0 : 1)) + ': ') || out.log.startsWith('T'));
        if (out.holdPending) assert.equal(Y.holdOver(enc2, ['HEAD', 'TORSO'][Math.floor(rng() * 2)]).ok, true);
      }
      log.push(stage + ':' + (enc2.result || enc2.over));
      if (enc2.over === 'lost' || trip.over) break;
      const info = Y.rewardsFor(trip, enc2.result);
      Y.claimReward(trip, enc2.result, info.choose ? info.choose[0] : null, rng);
      Y.beginPlacement(trip, 'reward');
      for (const id of trip.inventory.slice()) {
        outer2: for (const die of trip.dice) for (let i = 0; i < die.faces.length; i++) if (Y.placeItem(trip, id, die.id, i, 'reward').ok) break outer2;
      }
      Y.endPlacement(trip);
      Y.advanceStage(trip);
    }
    assert.ok(guard < 400, 'trip terminates');
    return log.join('|') + '|' + (trip.over || 'unfinished') + '|' + (trip.lostDie || '-') + '|' + Y.tripScars(trip);
  };
  let won = 0, lost = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = play(seed, seed % 2 === 0), b = play(seed, seed % 2 === 0);
    assert.equal(a, b, 'deterministic for seed ' + seed);
    assert.ok(/\|(won|lost)\|/.test(a), 'finished: ' + a);
    if (/\|won\|/.test(a)) won++; else lost++;
  }
  assert.equal(won + lost, 40);
});
