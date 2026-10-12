// ENGINE: M2 scavenge sites: creation, preview, turn resolution, leaving.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- M2: scavenge sites ----------
// site = { siteId, name, word, at:{c,r}|null, faces:[{content, item, pips, pipsLeft, revealed, opened, brokenItem}], noise, noiseMax,
//          turn, rerolls, rerollPenalty, rerollBonus, pendingSow, player, target:idx|null, gained:[itemId], guardian:enemyId,
//          over:null|'left'|'guardian'|'lost', log:[] }  (+ hidden non-enumerable `trip`; works with startTurn / rerollUnheld)
function createSite(trip, siteId, rng, at) {
  const c = CONFIG.sites[siteId];
  if (!c) throw new Error('unknown site ' + siteId);
  const contents = c.faces.slice();
  if (SR.shuffleFaces) for (let i = contents.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = contents[i]; contents[i] = contents[j]; contents[j] = tmp;
  }
  const faces = contents.map(content => ({ content, item: content === 'ITEM' ? c.pool[randInt(rng, c.pool.length)] : null,
    pips: c.pips, pipsLeft: c.pips, revealed: false, opened: false, brokenItem: null }));
  const site = { siteId, name: c.name, word: c.word, at: at || null, faces, noise: 0, noiseMax: CONFIG.noiseMax,
    turn: 1, rerolls: 0, rerollPenalty: 0, rerollBonus: 0, pendingSow: 0, player: trip.player, target: null,
    slots: Math.max(CONFIG.minSlots || 1, c.slots || CONFIG.defaultSlots), holdPending: false, gained: [], guardian: c.guardian, over: null, log: [] };
  Object.defineProperty(site, 'trip', { value: trip, enumerable: false, writable: true });
  return site;
}
// Enter a site (from the map, or debug jump). Sets trip.site and trip.stage.
function startSite(trip, siteId, rng, at) {
  const site = createSite(trip, siteId, rng, at);
  trip.site = site;
  if (trip.mode === 'm2') trip.stage = CONFIG.trip.siteStage;   // M1: the stage stays the site id (the sequence entry)
  const l = 'arrived at ' + site.name;
  site.log.push(l); trip.log.push(l);
  return site;
}
const unopenedIdx = (site) => site.faces.map((f, i) => (f.opened ? -1 : i)).filter(i => i >= 0);
// First unopened face at or after `from` (wrapping). -1 if none.
function nextUnopened(site, from) {
  const n = site.faces.length;
  for (let k = 0; k < n; k++) { const i = (from + k) % n; if (!site.faces[i].opened) return i; }
  return -1;
}
// Click a face to target it (null clears). -> { ok, target, reason }
function setSiteTarget(site, idx) {
  if (idx === null || idx === undefined) { site.target = null; return { ok: true, target: null }; }
  const f = site.faces[idx];
  if (!f) return { ok: false, target: site.target, reason: 'no-face' };
  if (f.opened) return { ok: false, target: site.target, reason: 'opened' };
  site.target = idx;
  return { ok: true, target: idx };
}
const effectiveTarget = (site) => (site.target !== null && site.faces[site.target] && !site.faces[site.target].opened
  ? site.target : nextUnopened(site, 0));
// Faces a step reveals on a site: a DIG step reveals `total` (SPADE: all, handled by the caller); NOSE / GLASSES reveal their depth.
const siteRevealCount = (step) => (step.idle ? 0 : (step.reveal ? Math.max(step.total, step.depth) : step.depth));
// Reveal points no face is left to take (everything already revealed / opened): each becomes SR.revealOverflowPips pips of quiet searching.
function siteSearchPips(site, evaluation) {
  let left = site.faces.filter(f => !f.opened && !f.revealed).length, over = 0;
  evaluation.steps.forEach(s => {
    const n = siteRevealCount(s);
    if (n <= 0) return;
    const shown = (s.reveal && s.item && specialOf(s.item) === 'spade') ? left : Math.min(left, n);
    left -= shown; over += n - shown;
  });
  return over * (SR.revealOverflowPips || 0);
}
// Planned effect of a sentence on a site (pure). -> { reveal: n|'all'|0, search: pips, prune:{points,quiet,noise}|null, sow:{points,pips}|null, text }
function sitePreview(site, evaluation) {
  let reveal = 0;
  evaluation.steps.forEach(s => {
    const n = siteRevealCount(s);
    if (!n) return;
    if (s.reveal && s.item && specialOf(s.item) === 'spade') reveal = 'all';
    else if (reveal !== 'all') reveal = Math.max(reveal, n);
  });
  const unrevealed = site.faces.filter(f => !f.opened && !f.revealed).length;
  if (reveal === 'all' ? unrevealed === 0 : reveal > unrevealed) reveal = unrevealed;
  const search = siteSearchPips(site, evaluation);
  const T = CONFIG.text.site, parts = [];
  let prune = null, sow = null;
  if (evaluation.totals.PRUNE > 0) {
    const quiet = Math.min(evaluation.shears, evaluation.totals.PRUNE);
    prune = { points: evaluation.totals.PRUNE, quiet, noise: (evaluation.totals.PRUNE - quiet) * SR.pruneNoisePerPoint };
  }
  if (evaluation.totals.SOW > 0) {
    sow = { points: evaluation.totals.SOW, pips: Math.max(SR.sowMin, Math.floor(evaluation.totals.SOW / SR.sowDivisor)) };
  }
  const mk = {
    DIG: () => {
      if (reveal) parts.push(reveal === 'all' ? CONFIG.text.revealTotals.facesAll : fmt(CONFIG.text.revealTotals.faces, { n: reveal }));
      if (search) parts.push(fmt(search === 1 ? T.searchPip : T.searchPips, { n: search }));
    },
    PRUNE: () => prune && parts.push(prune.noise === 0 ? fmt(T.forceQuiet, { n: prune.points }) : fmt(T.force, { n: prune.points, noise: prune.noise })),
    SOW: () => sow && parts.push(fmt(T.coax, { n: sow.pips })),
  };
  const seen = {};
  evaluation.steps.forEach(s => {
    const ks = [];
    if (siteRevealCount(s)) ks.push('DIG');
    if (!s.reveal && s.verb) ks.push(s.verb);
    ks.forEach(k => { if (mk[k] && !seen[k]) { seen[k] = true; mk[k](); } });
  });
  // the sentence totals line with the reveal part made site-aware: only faces still hidden count, leftover points become search pips
  const revParts = [];
  if (reveal) revParts.push(reveal === 'all' ? CONFIG.text.revealTotals.facesAll : fmt(CONFIG.text.revealTotals.faces, { n: reveal }));
  if (search) revParts.push(fmt(search === 1 ? T.searchPip : T.searchPips, { n: search }));
  let totalsText = evaluation.totalsText;
  if (evaluation.revealText) {
    const kept = totalsText.split(' · ').filter(t => t !== evaluation.revealText);
    totalsText = kept.concat(revParts).join(' · ') || (evaluation.complete ? CONFIG.text.noEffect : '');
  }
  return { reveal, search, totalsText, prune, sow, text: parts.length ? parts.join(' · ') : CONFIG.text.noEffect };
}
// Begin a site turn (rolls the dice, base rerolls). -> startTurn result
function startSiteTurn(site, rng) { return startTurn(site, rng); }

// Commit a sentence on the site. Events in order:
//   sentence, step*, then effects in sentence order:
//   siteReveal {faceIdx, content, item, via:'DIG'|'SPADE'}            (DIG step)
//   verb {verb, total, amount, shears, noise}                          (PRUNE / SOW totals; amount = points / pips spent)
//   sitePip {faceIdx, pipIdx, verb, shears, pipsLeft}                  (one pip removed)
//   noise {amount, total, cause:'PRUNE'|'RATS'|'turn'}
//   siteOpen {faceIdx, content, item, by, overkill, brokenItem}        (face opened; content may have become JUNK)
//   itemGained {item, faceIdx}  scar {...cause} itemDestroyed {...}    (ITEM / RATS / TRAP)
//   lose {scars, cause} (terminal) | guardian {enemyId, name, noise} (noise full; trip.encounter set, site.over='guardian')
// -> { ok, events, log, over:null|'lost', guardian:enemyId|null, evaluation, preview, opened:[faceIdx], reason? }
function resolveSiteTurn(site, slotOrder, rng) {
  const trip = site.trip;
  const res = { ok: false, events: [], log: null, over: trip.over, guardian: null, evaluation: null, preview: null, opened: [] };
  if (site.over) { res.reason = 'site-over'; return res; }
  if (!unopenedIdx(site).length) { res.reason = 'nothing-left'; return res; }
  const dice = slotDiceOf(site, slotOrder);
  res.ok = true;
  const events = res.events;
  const faces = dice.map(currentFace);
  const evaluation = evaluateSentence(faces, { site: true });
  const preview = sitePreview(site, evaluation);
  res.evaluation = evaluation; res.preview = preview;
  const sentenceStr = faces.map((f, i) => i === evaluation.mindIndex ? '[' + f + ']' : f).join(' ');
  events.push({ type: 'sentence', slotOrder: dice.map(d => d.id), faces, evaluation, text: evaluation.text, preview });
  evaluation.steps.forEach((step, index) => events.push({ type: 'step', index, step }));
  noteHold(site, evaluation, events);
  const bits = [];
  let lost = false;

  const addNoise = (amount, cause) => {
    if (amount <= 0) return;
    site.noise = Math.min(site.noiseMax, site.noise + amount);
    events.push({ type: 'noise', amount, total: site.noise, cause });
  };
  const scarEffect = (n, cause, by) => {
    for (let k = 0; k < n && !lost; k++) {
      const se = inflictScar(trip, rng, cause, by);
      se.forEach(e => events.push(e));
      bits.push('scar' + scarLogText(se, by));
      if (tripLoseCheck(trip, events, cause)) { lost = true; }
    }
  };
  const openFace = (fi, verb, pointsLeft) => {
    const f = site.faces[fi];
    f.opened = true; f.revealed = true;
    let overkill = false, brokenItem = null;
    if (f.content === 'ITEM' && verb === 'PRUNE' && pointsLeft >= SR.overkill) {
      overkill = true; brokenItem = f.item; f.brokenItem = f.item; f.item = null; f.content = 'JUNK';
    }
    res.opened.push(fi);
    events.push({ type: 'siteOpen', faceIdx: fi, content: f.content, item: f.item, by: verb, overkill, brokenItem });
    if (f.content === 'ITEM') {
      addToInventory(trip, f.item); site.gained.push(f.item);
      events.push({ type: 'itemGained', item: f.item, faceIdx: fi });
      bits.push('opened face ' + (fi + 1) + ': ' + CONFIG.items[f.item].name);
    } else if (overkill) {
      bits.push('opened face ' + (fi + 1) + ': ' + CONFIG.items[brokenItem].name + ' broke into JUNK');
    } else bits.push('opened face ' + (fi + 1) + ': ' + f.content);
    if (f.content === 'RATS') { addNoise(SR.ratsNoise, 'RATS'); scarEffect(SR.ratsScars, 'rats', 'the rats'); }
    else if (f.content === 'TRAP') scarEffect(SR.trapScars, 'trap', 'the trap');
  };
  const hit = (fi, verb, shearsPt, pointsLeftAfter) => {
    const f = site.faces[fi];
    const pipIdx = f.pips - f.pipsLeft;
    f.pipsLeft -= 1;
    events.push({ type: 'sitePip', faceIdx: fi, pipIdx, verb, shears: shearsPt, pipsLeft: f.pipsLeft });
    if (verb === 'PRUNE' && !shearsPt) addNoise(SR.pruneNoisePerPoint, 'PRUNE');
    if (f.pipsLeft <= 0) openFace(fi, verb, pointsLeftAfter);
  };
  // spend `points` of a verb (PRUNE: noise/overkill/shears; SOW: pips already halved)
  const spend = (verb, points, shears, cursor) => {
    let left = points, last = -1, sh = Math.min(shears, points);
    while (sh > 0 && left > 0 && !lost) {                 // SHEARS: alternate across 2 different faces, quiet
      const a = nextUnopened(site, cursor);
      if (a < 0) break;
      const b = nextUnopened(site, a + 1);
      const pair = b >= 0 && b !== a ? [a, b] : [a];
      const fi = pair.length === 2 && pair[0] === last ? pair[1] : pair[0];
      left--; sh--; last = fi;
      hit(fi, verb, true, left);
    }
    while (left > 0 && !lost) {
      const fi = nextUnopened(site, cursor);
      if (fi < 0) break;
      cursor = fi;
      left--;
      hit(fi, verb, false, left);
    }
    return points - left;
  };

  const done = {};
  let searchAt = -1;                                       // where the reveal-overflow search currently is (continues across steps)
  const target = effectiveTarget(site);
  for (const step of evaluation.steps) {
    if (lost) break;
    const revealN = siteRevealCount(step);
    if (revealN > 0) {
      const all = !!(step.reveal && step.item && specialOf(step.item) === 'spade');
      const order = [];
      if (target >= 0 && !site.faces[target].opened && !site.faces[target].revealed) order.push(target);
      site.faces.forEach((f, i) => { if (!f.opened && !f.revealed && order.indexOf(i) < 0) order.push(i); });
      const n = all ? order.length : Math.min(order.length, revealN);
      const shown = [];
      for (let k = 0; k < n; k++) {
        const f = site.faces[order[k]];
        f.revealed = true;
        events.push({ type: 'siteReveal', faceIdx: order[k], content: f.content, item: f.item, via: all ? 'SPADE' : (step.reveal ? 'DIG' : 'NOSE') });
        shown.push((order[k] + 1) + ':' + (f.item ? CONFIG.items[f.item].name : f.content));
      }
      if (shown.length) bits.push('revealed ' + shown.join(', '));
      const over = (revealN - n) * (SR.revealOverflowPips || 0);   // nothing left to reveal: careful searching, pips come off quietly
      if (over > 0 && !lost) {
        const start = searchAt >= 0 && !site.faces[searchAt].opened ? searchAt : (searchAt >= 0 ? nextUnopened(site, searchAt) : effectiveTarget(site));
        if (start >= 0) {
          searchAt = start;
          events.push({ type: 'verb', verb: 'SEARCH', total: revealN - n, amount: over, shears: 0, noise: 0 });
          const used = spend('SEARCH', over, 0, start);
          bits.push('searched ' + used + ' pip' + (used === 1 ? '' : 's'));
          const lastPip = events.filter(e => e.type === 'sitePip').pop();
          if (lastPip) searchAt = lastPip.faceIdx;
        }
      }
    }
    if (step.verb && CONFIG.pipResult[step.verb] && !done[step.verb]) {
      done[step.verb] = true;
      const total = evaluation.totals[step.verb];
      if (total <= 0) continue;
      const start = effectiveTarget(site);
      if (start < 0) break;
      if (step.verb === 'PRUNE') {
        const quiet = Math.min(evaluation.shears, total);
        const before = site.noise;
        events.push({ type: 'verb', verb: 'PRUNE', total, amount: total, shears: quiet, noise: (total - quiet) * SR.pruneNoisePerPoint });
        const used = spend('PRUNE', total, quiet, start);
        bits.push('PRUNE ' + used + (site.noise > before ? ', noise +' + (site.noise - before) : ''));
      } else {
        const amount = Math.max(SR.sowMin, Math.floor(total / SR.sowDivisor));
        events.push({ type: 'verb', verb: step.verb, total, amount, shears: 0, noise: 0 });
        const used = spend(step.verb, amount, 0, start);
        bits.push(step.verb + ' ' + total + ' → ' + used + ' pip' + (used === 1 ? '' : 's'));
      }
    }
  }

  if (!lost) spendCharges(site, dice, evaluation, events).forEach(b => bits.push(b));
  if (!lost) {                                            // exposed belly: before the turn's noise
    const bb = exposeBelly(site, rng, events);
    bb.forEach(b => bits.push(b));
    if (bb.length && tripLoseCheck(trip, events, 'belly')) lost = true;
  }
  const turnNo = site.turn;
  let head = 'S' + turnNo + ': ' + sentenceStr + ' → ' + preview.text;
  if (lost) {
    site.over = 'lost';
    site.lostDie = trip.lostDie || null;
    trip.stage = null;
    head += (bits.length ? '; ' + bits.join('; ') : '') + '; ' + CONFIG.text.lost;
    res.over = trip.over; res.log = head;
    site.log.push(head); trip.log.push(head);
    return res;
  }
  addNoise(SR.turnNoise, 'turn');
  site.turn += 1;
  if (site.target !== null && site.faces[site.target].opened) site.target = null;
  bits.push('noise ' + site.noise + '/' + site.noiseMax);
  if (site.noise >= site.noiseMax) {
    site.over = 'guardian';
    const g = CONFIG.enemies[site.guardian];
    events.push({ type: 'guardian', enemyId: site.guardian, name: g.name, noise: site.noise });
    bits.push(g.name + ' arrives');
    trip.results.push({ kind: 'site', siteId: site.siteId, result: CONFIG.text.site.guardian, turns: turnNo, gained: site.gained.slice() });
    trip.stage = site.guardian;
    startEncounter(trip, site.guardian, rng);
    res.guardian = site.guardian;
  }
  head += '; ' + bits.join('; ');
  res.log = head;
  site.log.push(head); trip.log.push(head);
  return res;
}
// LEAVE the site, keeping what was opened. -> { ok, gained:[itemIds], placement:boolean, reason? }
// (Then: if placement, beginPlacement(trip,'reward') ... endPlacement; finally advanceStage(trip).)
function leaveSite(trip) {
  const site = trip.site;
  if (!site || site.over) return { ok: false, gained: [], placement: false, reason: 'no-site' };
  site.over = 'left';
  const l = 'left the ' + site.name + (site.gained.length ? ' with ' + site.gained.map(i => CONFIG.items[i].name).join(', ') : ' empty-handed');
  site.log.push(l); trip.log.push(l);
  trip.results.push({ kind: 'site', siteId: site.siteId, result: CONFIG.text.site.left, turns: site.turn - 1, gained: site.gained.slice() });
  return { ok: true, gained: site.gained.slice(), placement: site.gained.length > 0 };
}
