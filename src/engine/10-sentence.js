// ENGINE: Faces, scoring, dice & body-part accessors, sentence evaluation.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- faces & scoring ----------
// -> { face, kind: 'verb'|'body'|'scar', verb, body, item }
function parseFace(face) {
  if (face === SCAR) return { face, kind: 'scar', verb: null, body: null, item: null };
  if (CONFIG.verbs.indexOf(face) >= 0) return { face, kind: 'verb', verb: face, body: null, item: null };
  const i = face.indexOf('+');
  return { face, kind: 'body', verb: null, body: i < 0 ? face : face.slice(0, i), item: i < 0 ? null : face.slice(i + 1) };
}
const hasTag = (enemy, tag) => !!(enemy && enemy.tags && enemy.tags.indexOf(tag) >= 0);

// ---------- dice & parts (all data-driven: no die id or part name is hard-coded) ----------
const partInfo = (part) => (part && CONFIG.bodyParts[part]) || {};
const favouriteOf = (part) => partInfo(part).favourite || null;
const dieDef = (id) => CONFIG.playerDice.find(d => d.id === id) || null;
const isMind = (die) => (die.kind || (dieDef(die.id) || {}).kind) === 'mind';
const bodyDiceOf = (player) => player.dice.filter(d => !isMind(d));
const bodyDieIds = () => CONFIG.playerDice.filter(d => d.kind !== 'mind').map(d => d.id);   // dice that hold items / scars
const mindDieIds = () => CONFIG.playerDice.filter(d => d.kind === 'mind').map(d => d.id);
const dieLabel = (id) => { const d = dieDef(id); return (d && d.label) || id; };
const scarTargetDice = (player) => player.dice.filter(d => (CONFIG.scarTargets ? CONFIG.scarTargets.indexOf(d.id) >= 0 : !isMind(d)));
const scarTargetIds = () => CONFIG.playerDice.filter(d => (CONFIG.scarTargets ? CONFIG.scarTargets.indexOf(d.id) >= 0 : d.kind !== 'mind')).map(d => d.id);

// Full scoring of one body face performing `verb` (null = acting on instinct with no verb: 0 points):
// own points (before carry) + the item special that triggered.
// ctx = { enemy?, site?, extra? (order-trigger bonus, e.g. EAR TRUMPET) }.
// -> { own, notes:[string], flags:{knife,matches,forbidden,lantern,whistle,shears,wateringCan,spade,earTrumpet} }
function scoreDetail(p, verb, ctx) {
  ctx = ctx || {};
  const out = { own: 0, notes: [], flags: {} };
  if (p.kind !== 'body' || !verb) return out;
  const part = partInfo(p.body);
  const sp = specialOf(p.item);
  let pts;
  if (part.fixedPoints != null && sp !== 'lantern') pts = part.fixedPoints;
  else pts = (part.favourite === verb || sp === 'lantern') ? CONFIG.points.favourite : CONFIG.points.other;   // a lantern counts as matching under any verb
  if (p.item) pts += CONFIG.points.itemBonus;
  const note = (key, n) => out.notes.push(fmt(CONFIG.notes[key], { n }));
  if (sp === 'knife' && verb === 'PRUNE') { pts += RULES.knifePruneBonus; out.flags.knife = true; note('knife', RULES.knifePruneBonus); }
  if (sp === 'matches' && verb === 'PRUNE') { pts += RULES.matchesPruneBonus; out.flags.matches = true; note('matches', RULES.matchesPruneBonus); }
  if (sp === 'forbiddenBook' && verb === 'SOW') { pts += RULES.forbiddenBookSowBonus; out.flags.forbidden = true; note('forbiddenBook', RULES.forbiddenBookSowBonus); }
  if (sp === 'wateringCan' && verb === 'SOW') {
    pts += RULES.wateringCanNow; out.flags.wateringCan = true;
    if (RULES.wateringCanNow) note('wateringCanNow', RULES.wateringCanNow);
    note('wateringCan', RULES.wateringCanSow);
  }
  if (sp === 'lantern' && verb !== CONFIG.revealVerb) { out.flags.lantern = true; note('lantern', 0); }
  if (ctx.extra) { pts += ctx.extra; out.flags.earTrumpet = true; note('earTrumpet', ctx.extra); }
  if (sp === 'whistle' && verb === 'SOW' && !ctx.site && hasTag(ctx.enemy, RULES.whistleTag)) {
    pts *= RULES.whistleMultiplier; out.flags.whistle = true; note('whistle', RULES.whistleMultiplier);
  }
  out.own = pts;
  if (sp === 'shears' && verb === 'PRUNE') { out.flags.shears = true; note('shears', 0); }
  if (sp === 'spade' && verb === CONFIG.revealVerb && ctx.site) { out.flags.spade = true; note('spade', 0); }
  return out;
}
// Points a body face earns when performing `verb` (0 for scar / verb faces). Optional ctx = { enemy, site }.
function scoreBodyFace(face, verb, ctx) {
  const p = typeof face === 'string' ? parseFace(face) : face;
  if (p.kind === 'scar') return CONFIG.points.scar;
  return scoreDetail(p, verb, ctx).own;
}
// Name of the action a body face performs under `verb` (null verb = idle). `tags` = the encounter's tags ('site' for scavenge sites);
// lookup order: item name for the first tag that has one -> item name -> bare-part name for a tag -> bare-part name.
function actionName(p, verb, tags) {
  const d = itemDef(p.item);
  const key = verb || 'IDLE';
  tags = tags || [];
  const pick = (byTag, base) => {
    for (let i = 0; i < tags.length; i++) { const t = byTag && byTag[tags[i]]; if (t && t[key]) return t[key]; }
    return base && base[key] ? base[key] : null;
  };
  let r = verb && d ? pick(d.namesByTag, d.names) : null;
  if (!r) {
    const bt = CONFIG.actionNamesByTag, byTag = {};
    tags.forEach(t => { if (bt && bt[t] && bt[t][p.body]) byTag[t] = bt[t][p.body]; });
    r = pick(byTag, CONFIG.actionNames[p.body]);
  }
  return r || p.face + ' ' + key;
}
const contextTags = (ctx) => (ctx.site ? ['site'] : ((ctx.enemy && ctx.enemy.tags) || []));

// ---------- sentence ----------
// faces = 1..N face strings in slot order (N = the encounter's slots), 0 or 1 verb face (the MIND die), ctx = { enemy?, site?, tax? }:
// enemy supplies tags (WHISTLE) and pruneMod / sowMod; omit it for a context-free preview.
// Label (`shape`): no MIND = Reflex; MIND first / middle / last = Plan / Situation / Impulse; a lone MIND (1 slot) = Idle, or Hold when
// CONFIG.mindAloneHolds. Instinct = dice before the MIND (or all dice without a MIND) use their part's favourite verb
// (instinctVerb for parts without one; null = does nothing, 0 points).
// Order triggers (final slot order): GLASSES in slot 0 = reveal depth 2; EAR TRUMPET directly before a MOUTH face = that face +2;
// PIPE in the last slot = wanted level change (evaluation.pipeLast, no effect yet).
function evaluateSentence(faces, ctx) {
  if (faces.some(f => f == null)) throw new Error('evaluateSentence needs every slot filled (use evaluatePartial)');
  return evaluateCore(faces, ctx, false);
}
// Same evaluation for a sentence that is still being built: slots = one entry per slot, a face string or null (empty).
// Empty slots are skipped; a die is directed only if the MIND sits before it; DIG's carry goes to the next placed body die
// (step.carryProvisional if an empty slot lies between, step.carryPending if no die is placed after it yet); the label is null
// (shape '…') until a MIND is placed or every slot is full. Result adds complete / placed / shapeKnown; with every slot full it is
// identical to evaluateSentence. A partial result has no steps for empty slots and `totalsText` '' when nothing is known yet.
function evaluatePartial(slots, ctx) { return evaluateCore(slots, ctx, true); }
function evaluateCore(faces, ctx, partial) {
  ctx = ctx || {};
  const enemy = ctx.site ? null : (ctx.enemy || null);
  const tags = contextTags(ctx);
  const parsed = faces.map(f => (f == null ? { face: null, kind: 'empty', verb: null, body: null, item: null } : parseFace(f)));
  const n = parsed.length;
  if (n < 1) throw new Error('sentence needs at least one face');
  const emptyCount = parsed.filter(p => p.kind === 'empty').length;
  const complete = emptyCount === 0;
  const verbSlots = [];
  parsed.forEach((p, i) => { if (p.kind === 'verb') verbSlots.push(i); });
  if (verbSlots.length > 1) throw new Error('sentence needs at most one verb face, got ' + verbSlots.length);
  const mindIndex = verbSlots.length ? verbSlots[0] : -1;
  const verb = mindIndex >= 0 ? parsed[mindIndex].verb : null;
  const SN = CONFIG.shapeNames;
  const holds = mindIndex >= 0 && n === 1 && !!CONFIG.mindAloneHolds;
  let shape;
  if (mindIndex < 0) shape = complete ? SN.reflex : CONFIG.text.rail.shapePending;
  else if (n === 1) shape = holds ? SN.hold : SN.idle;
  else shape = mindIndex === 0 ? SN.first : (mindIndex === n - 1 ? SN.last : SN.middle);

  const steps = [];
  const totals = {};
  Object.keys(CONFIG.pipResult).forEach(v => { totals[v] = 0; });
  const order = [];            // damage verbs by first appearance
  const carryAfter = [];       // is a carry in flight after this step?
  const spends = [];           // charges to spend: [{slot, item}]
  let carry = 0, reveal = false, revealDepth = 0, shearsTotal = 0, pendingSow = 0, forbidden = 0;
  const triggers = { glassesFirst: false, earTrumpet: [], pipeLast: false };
  const trumpetFor = {};       // slot -> bonus (slot holds a MOUTH face right after an EAR TRUMPET face)
  parsed.forEach((p, i) => {
    if (p.kind !== 'body') return;
    if (specialOf(p.item) === 'earTrumpet' && i + 1 < n && parsed[i + 1].kind === 'body' && parsed[i + 1].body === RULES.earTrumpetPart) {
      trumpetFor[i + 1] = RULES.earTrumpetBonus;
      triggers.earTrumpet.push(i + 1);
    }
  });
  const last = parsed[n - 1];
  if (last.kind === 'body' && specialOf(last.item) === 'pipe') triggers.pipeLast = true;

  parsed.forEach((p, i) => {
    if (i === mindIndex || p.kind === 'empty') return;
    if (p.kind === 'scar') {
      steps.push({ slot: i, face: p.face, role: 'scar', verb: null, base: CONFIG.points.scar, carryIn: 0,
        total: 0, reveal: false, passesTo: null, name: CONFIG.text.scar, item: null, notes: [], depth: 0, idle: false });
      carryAfter.push(carry > 0);
      return;
    }
    const role = mindIndex >= 0 && i > mindIndex ? 'directed' : 'instinct';
    const part = partInfo(p.body);
    let v = role === 'instinct' ? (part.favourite || part.instinctVerb || null) : verb;
    const idle = !v;
    // the role of a die left of a gap can still change if the MIND lands to its left
    const roleProvisional = role === 'instinct' && mindIndex < 0 && parsed.slice(0, i).some(q => q.kind === 'empty');
    const sp = specialOf(p.item);
    const det = scoreDetail(p, v, { enemy, site: !!ctx.site, extra: trumpetFor[i] || 0 });
    const base = det.own;
    const carryIn = carry;
    const total = base + carryIn;
    carry = 0;
    const notes = det.notes.slice();
    let stepReveal = false, passesTo = null, depth = 0, carryProvisional = false, carryPending = false;
    if (!idle) {
      if (v === CONFIG.revealVerb) depth = RULES.defaultRevealDepth;
      if (part.revealsNext) {
        depth = Math.max(depth, RULES.noseRevealDepth);
        if (v !== CONFIG.revealVerb) notes.push(fmt(CONFIG.notes.nose, { n: RULES.noseRevealDepth }));
      }
      if (i === 0 && sp === 'glasses') {
        depth = Math.max(depth, RULES.glassesRevealDepth);
        triggers.glassesFirst = true;
        notes.push(fmt(CONFIG.notes.glasses, { n: RULES.glassesRevealDepth }));
      }
      if (depth > 0) { reveal = true; revealDepth = Math.max(revealDepth, depth); }
      if (v === CONFIG.revealVerb) {
        stepReveal = true;
        let gap = false;
        for (let j = i + 1; j < parsed.length; j++) {
          if (parsed[j].kind === 'empty') { gap = true; continue; }
          if (j !== mindIndex && parsed[j].kind === 'body') { passesTo = j; carry = total; carryProvisional = gap; break; }
        }
        carryPending = passesTo === null && gap;
      } else if (totals[v] !== undefined) {
        totals[v] += total;
        if (order.indexOf(v) < 0) order.push(v);
        if (det.flags.shears) shearsTotal += total;
      }
      if (det.flags.wateringCan) pendingSow += RULES.wateringCanSow;
      if (det.flags.matches) spends.push({ slot: i, item: p.item });
    }
    steps.push({ slot: i, face: p.face, role, verb: v, base, carryIn, total, reveal: stepReveal, passesTo,
      name: actionName(p, v, tags), item: p.item, notes, depth, idle, roleProvisional, carryProvisional, carryPending });
    carryAfter.push(carry > 0);
  });
  // forbidden items in the sentence (any verb), for the future checks
  parsed.forEach(p => { if (p.kind === 'body' && p.item && itemDef(p.item) && itemDef(p.item).forbidden) forbidden += 1; });

  // pruneMod / sowMod: once per verb, only if the sentence produced that verb, clamped at >= 0
  const mods = {};
  order.forEach(v => {
    const key = CONFIG.modKey[v];
    const m = enemy && key ? (enemy[key] || 0) : 0;
    if (!m) return;
    const before = totals[v];
    totals[v] = Math.max(0, before + m);
    mods[v] = { mod: m, before, after: totals[v], source: enemy.logName || enemy.name };
  });
  // tax (ACCOUNTANT): every verb total the sentence produced is reduced, min 0 (fights only)
  const taxed = {};
  const tax = !ctx.site && enemy ? (ctx.tax || 0) : 0;
  if (tax) order.forEach(v => {
    const before = totals[v];
    if (before <= 0) return;
    totals[v] = Math.max(0, before - tax);
    taxed[v] = { amount: tax, before, after: totals[v] };
  });
  const shears = Math.min(shearsTotal, totals.PRUNE || 0);

  let stepsText = '';
  steps.forEach((s, k) => {
    let str = s.name + ' ' + s.base + (s.carryIn > 0 ? '+' + s.carryIn : '');
    if (s.reveal) str += ' ' + CONFIG.text.reveal;
    s.notes.forEach(nt => { str += ' (' + nt + ')'; });
    stepsText += str;
    if (k < steps.length - 1) stepsText += carryAfter[k] ? ' → ' : ' · ';
  });
  const parts = order.map(v => v + ' ' + totals[v] + (mods[v] ? ' (' + mods[v].source + ' ' + signed(mods[v].mod) + ')' : '') +
    (taxed[v] ? ' (' + fmt(CONFIG.notes.taxed, { n: taxed[v].amount }) + ')' : ''));
  // reveal effect: fights reveal the next `revealDepth` intents; sites reveal faces (DIG total / NOSE / GLASSES depth, SPADE = all)
  let revealText = '', revealFaces = 0;
  if (ctx.site) {
    steps.forEach(s => {
      const k = siteRevealCount(s);
      if (!k) return;
      if (s.reveal && s.item && specialOf(s.item) === 'spade') revealFaces = 'all';
      else if (revealFaces !== 'all') revealFaces = Math.max(revealFaces, k);
    });
    if (revealFaces) revealText = revealFaces === 'all' ? CONFIG.text.revealTotals.facesAll : fmt(CONFIG.text.revealTotals.faces, { n: revealFaces });
  } else if (revealDepth > 0) {
    revealText = revealDepth === 1 ? CONFIG.text.revealTotals.intent : fmt(CONFIG.text.revealTotals.intents, { n: revealDepth });
  }
  if (revealText) parts.push(revealText);
  const totalsText = parts.length ? parts.join(' · ') : (complete ? CONFIG.text.noEffect : '');
  const text = steps.length ? shape + ': ' + stepsText + ' → ' + totalsText
    : shape + ': ' + (holds ? CONFIG.text.holdText : CONFIG.text.idleText);
  return { shape, shapeKnown: shape !== CONFIG.text.rail.shapePending, complete, placed: n - emptyCount, tags, slots: n, mindIndex, verb, holds, steps, totals, order, reveal, revealDepth, mods, taxed, shears, pendingSow,
    spends, forbidden, triggers, pipeLast: triggers.pipeLast, revealText, revealFaces, totalsText, text };
}
