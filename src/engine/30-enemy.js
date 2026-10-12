// ENGINE: Enemy creation, pips, intents, enemy turn.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- enemy ----------
// intent: { faceIdx, wag } ; face: { name, pips: ['intact'|'broken'|'turned', ...], hostile, effect }
function createEnemy(id, rng) {
  if (typeof id === 'function') { rng = id; id = CONFIG.trip.singleFight; }
  id = id || CONFIG.trip.singleFight;
  const c = CONFIG.enemies[id];
  if (!c) throw new Error('unknown enemy ' + id);
  const e = {
    id, name: c.name, logName: c.logName || c.name, tags: c.tags.slice(), pruneMod: c.pruneMod || 0, sowMod: c.sowMod || 0,
    shortName: c.shortName || (c.logName || c.name).toLowerCase(), act: c.act || null, pron: c.pron || null,
    slots: Math.max(CONFIG.minSlots || 1, c.slots || CONFIG.defaultSlots),
    targetPriority: c.targetPriority.slice(), text: c.text, winText: c.winText,
    resultLabels: Object.assign({ beaten: CONFIG.text.beaten, befriended: CONFIG.text.befriended }, c.resultLabels || {}),
    faces: c.faces.map(f => ({ name: f.name, pips: Array(f.pips).fill('intact'), hostile: !!f.hostile, effect: f.effect || 'none' })),
    current: null,
    upcoming: [],       // pre-rolled future intents (index 0 = the next turn's intent)
    shown: 0,           // how many `upcoming` entries the player can see right now
    foresight: 0,       // reveal depth earned this turn; consumed at the turn transition
    next: null,         // derived: upcoming[0] while visible (kept for the single-fight UI)
  };
  if (rng) e.current = rollIntent(e, rng);
  return e;
}
function faceStatus(face) {
  let intact = 0, broken = 0, turned = 0;
  face.pips.forEach(p => { if (p === 'intact') intact++; else if (p === 'broken') broken++; else turned++; });
  if (intact === face.pips.length) return 'intact';
  if (intact > 0) return 'damaged';
  return broken > turned ? 'broken' : 'turned';
}
function isResolved(face) { const s = faceStatus(face); return s === 'broken' || s === 'turned'; }
function isHostile(face) { return !!face.hostile; }

// Unresolved hostile faces in targeting order: current intent first, then targetPriority, ties by index.
function targetOrder(enemy) {
  const out = [];
  const cur = enemy.current;
  if (cur && !cur.wag) {
    const f = enemy.faces[cur.faceIdx];
    if (isHostile(f) && !isResolved(f)) out.push(cur.faceIdx);
  }
  const prio = enemy.targetPriority;
  enemy.faces
    .map((f, i) => ({ f, i }))
    .filter(o => isHostile(o.f) && !isResolved(o.f) && out.indexOf(o.i) < 0)
    .sort((a, b) => (prio.indexOf(a.f.name) - prio.indexOf(b.f.name)) || (a.i - b.i))
    .forEach(o => out.push(o.i));
  return out;
}
// Spend `amount` points of `verb` (PRUNE/SOW) on intact pips. Returns ordered events.
// opts.alternate = n: the first n points alternate between the first two eligible faces (SHEARS); pip events get shears:true.
function applyVerb(enemy, verb, amount, opts) {
  const to = CONFIG.pipResult[verb];
  const events = [];
  if (!to || amount <= 0) return events;
  let left = amount;
  const spend = (fi, shears) => {
    const face = enemy.faces[fi];
    const pi = face.pips.indexOf('intact');
    face.pips[pi] = to;
    left--;
    const ev = { type: 'pip', faceIdx: fi, pipIdx: pi, to, verb };
    if (shears) ev.shears = true;
    events.push(ev);
    if (isResolved(face)) events.push({ type: 'faceResolved', faceIdx: fi, resolved: faceStatus(face) });
  };
  let alt = Math.min((opts && opts.alternate) || 0, amount), last = -1;
  while (alt > 0 && left > 0) {
    const pair = targetOrder(enemy).slice(0, 2);
    if (!pair.length) break;
    const fi = pair.length === 2 && pair[0] === last ? pair[1] : pair[0];
    spend(fi, true); last = fi; alt--;
  }
  for (const fi of targetOrder(enemy)) {
    while (left > 0 && enemy.faces[fi].pips.indexOf('intact') >= 0) spend(fi, false);
    if (left <= 0) break;
  }
  return events;
}

// Pick a random non-broken face. Turned face => wag intent.
function rollIntent(enemy, rng) {
  let idxs = [];
  enemy.faces.forEach((f, i) => { if (faceStatus(f) !== 'broken') idxs.push(i); });
  if (!idxs.length) return { faceIdx: 0, wag: true };
  const faceIdx = idxs[randInt(rng, idxs.length)];
  return { faceIdx, wag: faceStatus(enemy.faces[faceIdx]) === 'turned' };
}
const copyIntent = (i) => (i ? { faceIdx: i.faceIdx, wag: i.wag } : null);
const shownList = (enemy) => enemy.upcoming.slice(0, enemy.shown).map(i => ({ intent: copyIntent(i), face: enemy.faces[i.faceIdx].name }));
function syncNext(enemy) { enemy.next = enemy.shown > 0 && enemy.upcoming.length ? copyIntent(enemy.upcoming[0]) : null; }
// Reroll upcoming intents sitting on broken faces; refresh wag flags. -> true if any intent was rerolled
function refreshUpcoming(enemy, rng) {
  let changed = false;
  enemy.upcoming = enemy.upcoming.map(it => {
    const st = faceStatus(enemy.faces[it.faceIdx]);
    if (st === 'broken') { changed = true; return rollIntent(enemy, rng); }
    return { faceIdx: it.faceIdx, wag: st === 'turned' };
  });
  return changed;
}
function ensureUpcoming(enemy, n, rng) { while (enemy.upcoming.length < n) enemy.upcoming.push(rollIntent(enemy, rng)); }

// Resolves the enemy's current intent against the encounter state. Returns { events, rerollPenalty }.
function enemyAct(state, rng) {
  const enemy = state.enemy, intent = enemy.current;
  const face = enemy.faces[intent.faceIdx];
  const status = faceStatus(face);
  const T = enemy.text;
  const base = { type: 'enemyAct', intent: { faceIdx: intent.faceIdx, wag: intent.wag }, face: face.name };
  const out = { events: [], rerollPenalty: 0 };
  if (intent.wag || status === 'turned') {
    out.events.push(Object.assign(base, { skipped: true, reason: 'wag', effect: null, anim: 'wag', text: T.wag }));
    return out;
  }
  if (status === 'broken') {
    out.events.push(Object.assign(base, { skipped: true, reason: 'broken', effect: null, anim: 'broken', text: T.broken }));
    return out;
  }
  const ev = Object.assign(base, { skipped: false, reason: null, effect: face.effect, anim: face.name.toLowerCase(), text: T[face.name] || '' });
  out.events.push(ev);
  // candidate faces: scar effects use the scar targets, item effects (take / lose) any body die; a face must not be a SCAR
  const holders = (needItem, onlyDie, scarOnly) => {
    const c = [];
    (scarOnly ? scarTargetDice(state.player) : bodyDiceOf(state.player)).forEach(d => {
      if (onlyDie && d.id !== onlyDie) return;
      d.faces.forEach((f, fi) => {
        if (f === SCAR) return;
        if (needItem && !parseFace(f).item) return;
        c.push({ d, fi });
      });
    });
    return c;
  };
  if (face.effect === 'scar' || face.effect === 'scarHead') {
    const cands = holders(false, face.effect === 'scarHead' ? CONFIG.effectRules.scarHeadDie : null, true);
    if (cands.length) {
      const c = cands[randInt(rng, cands.length)];
      const previous = c.d.faces[c.fi];
      c.d.faces[c.fi] = SCAR;
      dropUses(state.trip, c.d.id, c.fi);
      out.events.push({ type: 'scar', dieId: c.d.id, faceIdx: c.fi, previous, wasCurrent: c.d.idx === c.fi, by: face.name });
      const item = parseFace(previous).item;
      if (item) out.events.push({ type: 'itemDestroyed', dieId: c.d.id, faceIdx: c.fi, item, cause: 'scar',
        by: face.name, wasCurrent: c.d.idx === c.fi });
    }
  } else if (face.effect === 'rerollPenalty') {
    ev.rerollPenalty = 1;
    state.rerollPenalty = 1;
    out.rerollPenalty = 1;
  } else if (face.effect === 'tax') {
    ev.tax = CONFIG.effectRules.tax;
    state.tax = CONFIG.effectRules.tax;                 // next turn only, not stacking
  } else if (face.effect === 'freezeDie') {
    const dice = state.player.dice.filter(d => !isMind(d));
    if (dice.length) {
      const d = dice[randInt(rng, dice.length)];
      d.frozen = true;                                  // cleared when the next sentence is committed / the encounter ends
      ev.frozenDie = d.id;
      out.events.push({ type: 'freeze', dieId: d.id, by: face.name });
    }
  } else if (face.effect === 'loseItem') {
    const cands = holders(true);
    if (cands.length) {
      const c = cands[randInt(rng, cands.length)];
      const previous = c.d.faces[c.fi];
      const item = parseFace(previous).item;
      c.d.faces[c.fi] = parseFace(previous).body;
      dropUses(state.trip, c.d.id, c.fi);
      if (state.trip) state.trip.discarded.push(item);           // gone for good: not in `taken`, never returned
      ev.item = item;
      ev.text = fmt(ev.text, { item: CONFIG.items[item].name.toLowerCase() });
      out.events.push({ type: 'itemDestroyed', dieId: c.d.id, faceIdx: c.fi, item, cause: 'river', by: face.name,
        becomes: c.d.faces[c.fi], previous, wasCurrent: c.d.idx === c.fi });
    } else {
      ev.text = T.noItem || ev.text;
      ev.nothing = true;
    }
  } else if (face.effect === 'takeItem') {
    const cands = holders(true);
    if (cands.length) {
      const c = cands[randInt(rng, cands.length)];
      const previous = c.d.faces[c.fi];
      const item = parseFace(previous).item;
      c.d.faces[c.fi] = parseFace(previous).body;
      state.taken.push(item);
      (state.takenUses = state.takenUses || [])[state.taken.length - 1] = takeUses(state.trip, c.d.id, c.fi);
      ev.item = item;
      ev.text = fmt(ev.text, { item: CONFIG.items[item].name.toLowerCase() });
      out.events.push({ type: 'itemTaken', dieId: c.d.id, faceIdx: c.fi, item, previous, becomes: c.d.faces[c.fi],
        by: face.name, enemy: enemy.name, wasCurrent: c.d.idx === c.fi });
    } else {
      ev.text = T.noItem || ev.text;
      ev.nothing = true;
    }
  }
  return out;
}
