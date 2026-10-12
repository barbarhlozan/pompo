// UI: Static DOM, enemy panel, render functions, popovers.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- static DOM ----------
const dom = { slotEls: [], stepEls: [], capEls: [], actEls: [], cellEls: {}, dieEls: {}, efc: [] };
function buildDOM() {
  // the sentence rail: one strip of interlocking chevron steps (label, MIND band / instinct tag, slot, carry link, caption) + totals + playhead
  const slots = $('slots');
  $('railTitle').textContent = C.text.rail.title;
  for (let i = 0; i < C.playerDice.length; i++) {
    const st = document.createElement('div');
    st.className = 'rstep'; st.style.setProperty('--i', i);
    st.innerHTML = '<div class="rlabel"></div><div class="rband"></div>' +
      '<div class="slot" data-slot="' + i + '"><div class="chev"></div><span class="num">' + (i + 1) + '</span><span class="empty">' + esc(C.text.rail.empty) + '</span><div class="sact"></div></div>' +
      '<div class="rlink"></div><div class="rcap"></div>';
    slots.appendChild(st);
    dom.stepEls.push(st); dom.slotEls.push(st.querySelector('.slot')); dom.capEls.push(st.querySelector('.rcap')); dom.actEls.push(st.querySelector('.sact'));
  }
  slots.insertAdjacentHTML('beforeend', '<div id="playhead"></div>');
  // tray cells + dice
  ui.slots = emptySlots();
  C.playerDice.forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.dataset.die = d.id;
    $('tray').appendChild(cell); dom.cellEls[d.id] = cell;
    const die = document.createElement('div');
    die.className = 'die'; die.dataset.id = d.id;
    die.innerHTML = '<div class="faceRow"></div><div class="meta"><div class="cap">' + (d.label || d.id) + '</div>' +
      '<div class="ctl"><button class="up" title="Place in leftmost empty slot">▲</button>' +
      '<button class="down" title="Return to tray">▼</button></div></div>' +
      '<span class="held">' + C.text.held + '</span><span class="frz" title="' + esc(C.text.s.frozenTip) + '">' + C.text.s.frozen + '</span>';
    die.querySelector('.up').addEventListener('click', (e) => { e.stopPropagation(); onUp(d.id); });
    die.querySelector('.down').addEventListener('click', (e) => { e.stopPropagation(); onDown(d.id); });
    die.addEventListener('pointerdown', (e) => onPointerDown(e, d.id));
    die.addEventListener('pointerenter', () => { ui.hover = d.id; showPopover(d.id); });
    die.addEventListener('pointerleave', () => { if (ui.hover === d.id) ui.hover = null; hidePopover(); });
    dom.dieEls[d.id] = die;
  });
  const sc = $('scars');
  sc.innerHTML = '<span>' + C.text.scarsLabel + '</span>';
  for (let i = 0; i < C.maxScars; i++) { const b = document.createElement('span'); b.className = 'scarbox'; sc.appendChild(b); }
  const n = document.createElement('span'); n.id = 'scarN'; sc.appendChild(n);
  $('help').textContent = C.text.help;
  // CONFIG.colors / labels -> page
  const root = document.documentElement.style, K = C.colors;
  [['bg', K.bg], ['panel', K.panel], ['line', K.line], ['text', K.text], ['dim', K.textDim], ['lit', K.lit], ['status', K.status],
   ['danger', K.scarText], ['glow', K.glow], ['pip', K.pipIntact], ['broken', K.broken], ['turned', K.turned], ['tiletext', K.tileText],
   ['lift', C.fx.liftScale], ['ph-ms', C.timing.railPlayheadMs + 'ms']].forEach(kv => { if (kv[1] != null) root.setProperty('--' + kv[0], kv[1]); });
  $('titleLabel').textContent = C.text.title;
  $('btnRoll').textContent = C.text.buttons.roll;
  $('btnCommit').textContent = C.text.buttons.commit;
  $('btnRestart').textContent = C.text.buttons.restart;
  $('ovRestart').textContent = C.text.buttons.continue;
  $('btnRoll').addEventListener('click', onRoll);
  $('btnReroll').addEventListener('click', onReroll);
  $('btnCommit').addEventListener('click', onCommit);
  $('btnRestart').addEventListener('click', onRestart);
  $('btnLeave').addEventListener('click', leaveSiteUI);
  $('btnLeave').textContent = C.text.s.leave;
  $('btnLeave').title = C.text.m2.leaveTip;
  $('faceStrip').addEventListener('click', onSiteCardClick);
  $('ovRestart').addEventListener('click', onContinue);
  $('screen').addEventListener('click', onScreenClick);
  $('screen').addEventListener('pointerdown', onPlacePointerDown);
  $('screen').addEventListener('pointerover', onScreenOver);
  $('screen').addEventListener('pointerout', onScreenOut);
  window.addEventListener('keydown', onKey);
}

// Rebuilds the per-encounter enemy panel: label, tags / mods, bag, 6 face cards with a variable pip count.
function buildEnemyPanel() {
  const en = ui.game.enemy, cfg = C.enemies[ui.game.enemyId];
  $('enemyLbl').textContent = en.name + ' · ' + C.text.intentLabel;
  const chips = en.tags.map(t => '<span class="chip">' + esc(t) + '</span>');
  const mods = [['PRUNE', en.pruneMod], ['SOW', en.sowMod]].filter(m => m[1] !== 0)
    .map(m => '<span class="vb" style="color:' + C.colors.verb[m[0]] + '" title="' + esc(C.verbInfo[m[0]] + ' This enemy: ' + signed(m[1]) + ' to your ' + m[0] + ' total.') + '">' + m[0] + ' ' + signed(m[1]) + '</span>');
  $('enemyMeta').innerHTML = chips.join('') + (mods.length ? mods.join(' · ') : '<span>' + C.text.noMods + '</span>');
  const takes = cfg.faces.some(f => f.effect === 'takeItem');
  $('bag').classList.toggle('hidden', !takes);
  ui.bagLabel = (C.text.bagLabel && C.text.bagLabel[ui.game.enemyId]) || 'BAG';
  const strip = $('faceStrip');
  strip.innerHTML = '';
  dom.efc.length = 0;
  cfg.faces.forEach((cf) => {
    const el = document.createElement('div');
    el.className = 'efc';
    el.innerHTML = '<div class="tag"></div><span class="tile"></span><div class="pips"></div>';
    const pips = el.querySelector('.pips');
    for (let p = 0; p < cf.pips; p++) { const sp = document.createElement('span'); sp.className = 'pip'; pips.appendChild(sp); }
    strip.appendChild(el); dom.efc.push(el);
  });
}

// ---------- render functions (hook points for Phase 3) ----------
function renderAll() {
  renderTopBar();
  renderScreen();
  $('stage').classList.toggle('site', ui.screen === 'encounter' && isSite());
  if (ui.screen === 'encounter') { renderEnemy(); renderDice(); renderSlots(); renderPreview(); renderControls(); }
  renderOverlay();
}

function enemyTileClass(name, status) {
  const col = (C.colors.enemy && C.colors.enemy[name]) || C.colors.hostile;
  if (status === 'broken') return { bg: C.colors.broken, fg: C.colors.tileText, cls: 'broken' };
  if (status === 'turned') return { bg: C.colors.turned, fg: C.colors.tileText, cls: '' };
  return { bg: col, fg: C.colors.tileText, cls: '' };
}
function paintEnemyTile(el, name, status, small) {
  const c = enemyTileClass(name, status);
  el.className = 'tile ' + c.cls + (small ? ' small' : '');
  el.style.background = c.bg; el.style.color = c.fg;
  el.textContent = name;
}
function intentLine(intent) {
  const f = view.enemy.faces[intent.faceIdx];
  const T = ui.game.enemy.text;
  if (intent.wag) return T.wag;
  if (E.isResolved(f)) return T.broken;
  return (T[f.name] || '').replace('{item}', C.text.itemWord);
}
function renderEnemy() {
  if (isSite()) { renderSite(); return; }
  const en = view.enemy;
  en.faces.forEach((f, i) => {
    const el = dom.efc[i], st = E.faceStatus(f);
    paintEnemyTile(el.querySelector('.tile'), f.name, !ui.hidePips && (st === 'broken' || st === 'turned') ? st : 'intact', false);
    el.querySelectorAll('.pip').forEach((p, k) => { p.className = ui.hidePips ? 'pip unknown' : 'pip ' + f.pips[k]; });
    el.classList.toggle('is-current', !!en.current && en.current.faceIdx === i);
    const qi = en.queue.findIndex(q => q.faceIdx === i);
    const isCur = !!en.current && en.current.faceIdx === i;
    el.classList.toggle('is-next', !isCur && qi === 0);
    el.classList.toggle('is-then', !isCur && qi >= 1);
    el.dataset.status = st;
    el.querySelector('.tag').textContent = isCur ? C.text.now : (qi === 0 ? C.text.next : (qi >= 1 ? C.text.then : ''));
  });
  // intent
  const cur = en.current;
  const curFace = en.faces[cur.faceIdx];
  const st = E.faceStatus(curFace);
  paintEnemyTile($('intentTile'), curFace.name, cur.wag ? 'turned' : (st === 'broken' || st === 'turned' ? st : 'intact'), false);
  const intentStr = ui.game.enemy.name + ' ' + intentLine(cur);
  $('intentText').textContent = intentStr;
  // the enemy's act line often repeats the intent line (broken / wagging): show it once
  // once the turn has played out, label the line as last turn's action so it isn't read as the new intent
  const eLine = ui.phase === 'await-roll' && ui.enemyText ? C.text.lastAction + ' ' + ui.enemyText : ui.enemyText;
  $('enemyText').textContent = !ui.enemyText || ui.enemyText === intentStr ?' ' : eLine;
  // foresight queue: up to 2 greyed upcoming intents, in order
  const nw = $('nextWrap');
  if (en.queue.length) {
    const labels = [C.text.next, C.text.then];
    nw.innerHTML = en.queue.map((q, k) => {
      const f = en.faces[q.faceIdx], fs = E.faceStatus(f);
      const col = enemyTileClass(f.name, q.wag ? 'turned' : (fs === 'broken' || fs === 'turned' ? fs : 'intact'));
      return '<span class="q"><span class="lbl">' + labels[k] + '</span><span class="tile small ' + col.cls + '" style="background:' + col.bg + ';color:' + col.fg + '">' +
        esc(f.name) + '</span>' + (en.queue.length === 1 ? '<span>' + esc(intentLine(q)) + '</span>' : '') + '</span>';
    }).join('');
    nw.classList.remove('hidden');
  } else { nw.classList.add('hidden'); nw.innerHTML = ''; }
  // bag / nest: items this enemy has taken
  const bag = $('bag');
  if (!bag.classList.contains('hidden')) {
    const key = (ui.bagLabel || '') + ':' + en.bag.join(',');
    if (bag.dataset.key !== key) {
      bag.dataset.key = key;
      bag.innerHTML = '<span class="lbl">' + esc(ui.bagLabel || 'BAG') + '</span>' + (en.bag.length ? en.bag.map(id => itemTileHTML(id, 'bagpop')).join('') : '<span class="lbl">—</span>');
    }
  }
  $('verbFlash').textContent = ui.verbFlash || '';
}

function renderDice() {
  for (let i = slotCount(); i < ui.slots.length; i++) ui.slots[i] = null;
  ui.game.player.dice.forEach(d => {
    const el = dom.dieEls[d.id], vd = view.dice[d.id], si = slotOf(d.id);
    const parent = si >= 0 ? dom.slotEls[si] : dom.cellEls[d.id];
    if (el.parentNode !== parent) parent.appendChild(el);
    const hidden = (ui.phase === 'await-roll' && !ui.holdPick) || ui.phase === 'start';
    const face = hidden ? '?' : vd.faces[vd.idx];
    if (el.dataset.face !== face) {
      el.dataset.face = face;
      el.querySelector('.faceRow').innerHTML = hidden ? '<span class="tile" style="background:' + C.colors.unknownBg + ';color:' + C.colors.unknownFg + '">' + C.text.unknownFace + '</span>' : faceHTML(face);
    }
    el.style.setProperty('--tilt', (ui.tilt[d.id] || 0) + 'deg');
    el.classList.toggle('in-slot', si >= 0);
    el.classList.toggle('held', (d.held || !!d.heldOver) && !hidden);
    el.classList.toggle('frozen', !!vd.frozen);
    el.title = vd.frozen ? C.text.s.frozenTip : '';
    el.classList.toggle('dim', hidden);
    el.querySelector('.ctl').style.visibility = canInteract() ? 'visible' : 'hidden';
  });
}
// ---- the sentence rail ----
const stepLabelsFor = (n) => C.text.rail.steps[n] || Array.from({ length: n }, (_, i) => (i === 0 ? 'FIRST' : 'THEN'));
const verbSpan = (v) => '<span class="vb" style="color:' + C.colors.verb[v] + '" title="' + esc(C.verbInfo[v]) + '">' + v + '</span>';
// what the slot itself shows once a die sits on it: the action it performs, big, in the verb's colour, with its points
function slotAction(s, ev) {
  const RT = C.text.rail;
  if (s === 'mind') {
    const txt = ev.holds ? RT.mindHoldAction : RT.mindSets.replace('{verb}', ev.verb);
    return { html: '<span class="an" style="color:' + C.colors.verb[ev.verb] + '">' + esc(txt) + '</span>', title: txt + '. ' + RT.mindTip };
  }
  if (s.role === 'scar') return { html: '<span class="an scar" style="color:' + C.colors.scarText + '">' + esc(RT.scarRed) + ' <span class="ap">' + s.base + '</span></span>', title: RT.scarTip };
  const col = s.verb ? C.colors.verb[s.verb] : C.colors.textDim;
  const pts = s.base + (s.carryIn > 0 ? '<span class="cin" title="' + esc(RT.carryTip) + '">+' + s.carryIn + '</span>' : '');
  return { html: '<span class="an' + (s.name.length > 13 ? ' long' : '') + '" style="color:' + col + '">' + esc(s.name) + ' <span class="ap">' + pts + '</span></span>',
    title: s.name + ' ' + s.base + (s.carryIn > 0 ? '+' + s.carryIn : '') + (s.verb ? ' (' + s.verb + ')' : '') };
}
// caption below a step: only the annotations ('(knife +1) (reveal)'); the action and points live in the slot
function stepCaption(s) {
  const notes = s.notes.slice(); if (s.reveal) notes.unshift(C.text.reveal.replace(/[()]/g, ''));
  const plain = s.name + ' ' + s.base + (s.carryIn > 0 ? '+' + s.carryIn : '') + notes.map(n => ' (' + n + ')').join('');
  return { html: '<div class="cl1">' + (notes.length ? esc(notes.map(n => '(' + n + ')').join(' ')) : '&nbsp;') + '</div>', title: plain };
}
function renderSlots() {
  const n = slotCount(), RT = C.text.rail;
  for (let i = n; i < ui.slots.length; i++) ui.slots[i] = null;           // a debug change of the slot count empties the hidden slots
  const p = currentPreview(), tg = p.triggers || {}, last = n - 1;
  const live = ui.phase === 'arranging' || ui.phase === 'resolving' || ui.phase === 'enemy';
  const ev = live && p.ev && p.ev.slots === n ? p.ev : null;
  const play = ui.phase === 'resolving' || ui.phase === 'enemy' ? ui.railPlay : null;
  // partial sentence: evaluate the placed dice (empty slots padded with a scar, which does nothing) so each slot already shows its action
  let pev = null;
  if (!ev && ui.phase === 'arranging' && placedCount() > 0) {
    const faces = []; for (let i = 0; i < n; i++) faces.push(ui.slots[i] ? viewFace(ui.slots[i]) : C.text.scar);
    try { pev = E.evaluateSentence(faces, isSite() ? { site: true } : { enemy: ui.game.enemy, tax: ui.game.tax || 0 }); } catch (e) { pev = null; }
  }
  // fit the chevrons to the page width (CSS --sw is the 3-slot size; more slots shrink it)
  const sentEl = $('sentence'), maxSw = parseFloat(getComputedStyle(sentEl).getPropertyValue('--sw-max')) || 425, ovPx = 26;
  sentEl.style.setProperty('--sw', Math.min(maxSw, Math.floor((1232 + (n - 1) * ovPx) / n)) + 'px');
  const labels = stepLabelsFor(n), mi = ev ? ev.mindIndex : -1, mcol = ev && ev.verb ? C.colors.verb[ev.verb] : null;
  dom.stepEls.forEach((st, i) => {
    st.style.display = i < n ? '' : 'none';
    if (i >= n) return;
    st.classList.toggle('first', i === 0);
    st.classList.toggle('last', i === last);
    st.querySelector('.rlabel').textContent = labels[i];
    const sl = dom.slotEls[i], band = st.querySelector('.rband'), cap = dom.capEls[i], link = st.querySelector('.rlink');
    sl.classList.toggle('full', !!ui.slots[i]);
    sl.classList.toggle('acting', ui.actingSlot === i);
    sl.classList.toggle('trig', !!((tg.glassesFirst && i === 0) || (tg.earTrumpet && tg.earTrumpet.indexOf(i) >= 0) || (tg.pipeLast && i === last)));
    const step = ev ? ev.steps.find(x => x.slot === i) : null;
    const reached = !play || i <= play.idx;
    // MIND band (this slot and everything after it) / instinct tag (before the MIND, or every slot without one)
    band.className = 'rband'; band.innerHTML = ''; band.removeAttribute('title'); band.style.cssText = '';
    if (ev && mcol && i >= mi && mi >= 0) {
      band.classList.add('on'); band.style.background = mcol; band.title = RT.directedTip.replace('{verb}', ev.verb);
      band.innerHTML = '<span>' + ev.verb + '</span>';
    } else if (step && step.role === 'instinct') {
      const v = step.verb;
      band.classList.add('tag');
      if (v) { band.style.color = C.colors.verb[v]; band.style.borderColor = C.colors.verb[v]; band.title = RT.instinctTip.replace('{verb}', v); band.textContent = RT.instinct + ' · ' + v; }
      else { band.classList.add('none'); band.title = RT.noInstinctTip; band.textContent = RT.noInstinct; }
    }
    // the action in the slot (live, also while the sentence is still being filled) + caption (annotations only)
    const act = dom.actEls[i], sev = ev || pev, sstep = sev && ui.slots[i] ? sev.steps.find(x => x.slot === i) : null;
    let sa = null;
    if (sev && ui.slots[i]) sa = (sev.mindIndex === i) ? slotAction('mind', sev) : (sstep ? slotAction(sstep, sev) : null);
    if (sa) { act.innerHTML = sa.html; act.title = sa.title; } else { act.innerHTML = ''; act.removeAttribute('title'); }
    sl.classList.toggle('acts', !!sa);
    cap.style.visibility = ev && reached ? '' : 'hidden';
    cap.classList.toggle('mind', !!ev && i === mi);
    if (ev && i === mi) {
      cap.innerHTML = '<div class="cl1">' + (ev.holds ? esc(RT.mindHold) : (n === 1 ? esc(RT.mindIdle) : '&nbsp;')) + '</div>';
      cap.title = RT.mindTip;
    } else if (step) { const c = stepCaption(step); cap.innerHTML = c.html; cap.title = c.title; }
    else { cap.innerHTML = ''; cap.removeAttribute('title'); }
    // DIG carry: an arrow from the giving caption to the receiving one
    link.innerHTML = '';
    if (step && step.passesTo != null && reached) {
      const d = step.passesTo - i, col = C.colors.verb[C.revealVerb];
      link.innerHTML = '<span class="carry" style="width:calc(var(--pitch) * ' + d + ' - 30px);border-color:' + col + ';color:' + col + '" title="' + esc(RT.carryTip) + '"><b>+' + step.total + '</b></span>';
    }
  });
  // totals at the right end of the rail
  const tot = $('rtotals');
  tot.innerHTML = ev ? '<span class="eq">' + esc(RT.totalsPrefix) + '</span> ' + verbify(ev.totalsText) : '<span class="eq">' + esc(RT.totalsPrefix) + ' ' + esc(RT.totalsPending) + '</span>';
  tot.style.visibility = ev && play && !play.totals ? 'hidden' : '';
  tot.classList.toggle('pending', !ev);
  // playhead: slides left -> right along the band row while a commit plays
  const ph = $('playhead');
  ph.classList.toggle('on', !!(play && play.idx >= 0 && ui.phase === 'resolving'));
  if (play && play.idx >= 0) ph.style.setProperty('--ph', play.idx);
  $('slots').classList.toggle('complete', placedCount() === slotCount() && (ui.phase === 'arranging' || ui.phase === 'resolving' || ui.phase === 'enemy'));
}
// -> { hint?, shape, triggers?, ev? (evaluation, when the sentence is complete), text } ; `text` is the compact line under the rail
function currentPreview() {
  if (ui.previewOverride && ui.phase !== 'await-roll') return ui.previewOverride;
  if (ui.phase === 'arranging') {
    if (placedCount() < slotCount()) return { hint: true, shape: '', text: C.text.placeHint.replace(/\{slots\}/g, slotCount()).replace('{n}', placedCount()) };
    const faces = ui.slots.slice(0, slotCount()).map(id => viewFace(id));
    if (isSite()) {
      const ev = E.evaluateSentence(faces, { site: true });
      const sp = E.sitePreview(ui.game, ev);
      const tg = ui.game.target !== null ? ' (' + MT().target.toLowerCase() + ': ' + (ui.game.target + 1) + ')' : '';
      // totals already name PRUNE / SOW / REVEAL; the hint line only adds what they don't: the noise and the coax pips
      const ST = C.text.site, bits = [];
      if (sp.prune) bits.push(sp.prune.noise ? fmt(ST.noiseOnly, { n: sp.prune.noise }) : ST.noNoise);
      if (sp.sow) bits.push(fmt(ST.coax, { n: sp.sow.pips }));
      return { shape: ev.shape, triggers: ev.triggers, ev, text: bits.join(' · ') + tg };
    }
    const ev = E.evaluateSentence(faces, { enemy: ui.game.enemy, tax: ui.game.tax || 0 });
    return { shape: ev.shape, triggers: ev.triggers, ev, text: '' };
  }
  if (ui.phase === 'await-roll') {
    const log = ui.game.log;
    const fresh = isSite() ? ui.game.turn <= 1 : !log.length;
    return { hint: true, shape: '', text: !fresh && log.length ? C.text.lastTurn + ' ' + log[log.length - 1] : C.text.pressRoll };
  }
  return { hint: true, shape: '', text: '' };
}
// ---- plain-language narration (CONFIG.text.narration): what you do to them, then what it did ----
const capFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const themName = () => {
  const g = ui.game;
  if (g && g.enemy) return g.enemy.shortName || g.enemy.logName || g.enemy.name.toLowerCase();
  const st = g && C.sites[g.siteId];
  return (st && st.shortName) || (g && g.name ? g.name.toLowerCase() : 'it');
};
const pronouns = () => Object.assign({}, C.text.narration.pron, ui.game && ui.game.enemy && ui.game.enemy.pron || {});
function narrateSentence(ev) {
  const N = C.text.narration, them = themName();
  if (!ev || !ev.steps.length) return N.youIdle;
  const pr = pronouns();
  let named = false;
  const parts = ev.steps.map(s => {
    const t = s.role === 'scar' ? N.scar : (N.actions[s.name] || (s.idle ? N.idle : s.name.toLowerCase()));
    if (t.indexOf('{them}') < 0) return t;
    const r = t.replace(/\{them\}/g, named ? pr.them : them);   // the name once, then the pronoun
    named = true;
    return r;
  });
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) out += (i === parts.length - 1 && parts.length > 2 ? N.joinLast : N.joinThen) + parts[i];
  let txt = N.you.replace('{steps}', out);
  if (ev.revealText) {
    const R = N.reveal, d = ev.revealDepth, f = ev.revealFaces;
    const t = ev.slots && f ? (f === 'all' ? R.facesAll : R.faces.replace('{n}', f)) : (d === 1 ? R.intent : R.intents.replace('{n}', d));
    txt += ' ' + t.replace('{its}', pr.its);
  }
  return txt;
}
// what the committed sentence did to the enemy's faces so far (from the pip events the player has seen)
function narrateResult(hits) {
  const N = C.text.narration, order = [], byFace = {};
  hits.forEach(h => {
    if (!byFace[h.faceIdx]) { byFace[h.faceIdx] = { broken: 0, turned: 0 }; order.push(h.faceIdx); }
    byFace[h.faceIdx][h.to === 'turned' ? 'turned' : 'broken']++;
  });
  const out = order.map(fi => {
    const f = view.enemy.faces[fi], h = byFace[fi], kind = h.turned > h.broken ? 'turned' : 'broken';
    const all = f.pips.every(p => p !== 'intact');
    const tpl = all ? (kind === 'turned' ? N.faceTurned : N.faceBroken) : (kind === 'turned' ? N.facePartTurned : N.facePartBroken);
    return capFirst(tpl.replace('{its}', pronouns().its).replace('{face}', f.name).replace('{n}', h[kind] || (h.broken + h.turned)));
  });
  return out.join(' ');
}
function narrationText() {
  const live = ui.phase === 'arranging' || ui.phase === 'resolving' || ui.phase === 'enemy' || ui.phase === 'await-roll';
  if (!live || !ui.game) return '';
  if (ui.phase === 'arranging') {
    if (placedCount() < slotCount()) return '';
    const faces = ui.slots.slice(0, slotCount()).map(id => viewFace(id));
    return narrateSentence(E.evaluateSentence(faces, isSite() ? { site: true } : { enemy: ui.game.enemy, tax: ui.game.tax || 0 }));
  }
  const n = ui.narr;
  if (!n) return '';
  return n.sentence + (view.enemy && n.hits.length ? ' ' + narrateResult(n.hits) : '');
}
// the enemy's action as one full sentence (act templates; fallback "<shortName> <text>.")
function enemyActSentence(ev) {
  const en = ui.game.enemy, A = en.act || {};
  const key = ev.skipped ? ev.reason : (ev.nothing ? 'noItem' : ev.face);
  let t = A[key];
  if (!t) t = capFirst(en.shortName || en.logName) + ' ' + ev.text + '.';
  return t.replace('{item}', ev.item ? itemName(ev.item).toLowerCase() : C.text.itemWord);
}
function renderPreview() {
  const p = currentPreview();
  const nr = $('narration'), nt = narrationText();
  nr.textContent = nt || ' '; nr.title = nt;
  $('railShape').textContent = p.shape ? p.shape.toUpperCase() : '';
  const t = $('previewText');
  t.innerHTML = p.text ? verbify(p.text) : '&nbsp;';
  t.classList.toggle('hint', !!p.hint);
}
function renderControls() {
  const g = ui.game, ph = ui.phase;
  $('btnRoll').disabled = ph !== 'await-roll' || nothingLeft() || ui.holdPick;
  $('btnLeave').disabled = !(ph === 'await-roll' || ph === 'arranging');
  $('btnLeave').classList.toggle('primary', nothingLeft());
  const allHeld = g.player.dice.every(d => d.held || d.frozen);
  $('btnReroll').disabled = !(ph === 'arranging' && g.rerolls > 0 && !allHeld);
  $('btnReroll').textContent = C.text.buttons.reroll.replace('{n}', ph === 'arranging' || ph === 'resolving' || ph === 'enemy' ? g.rerolls : 0);
  $('btnCommit').disabled = !(ph === 'arranging' && placedCount() === slotCount());
  let s = '';
  if (ph === 'await-roll') {
    const parts = [];
    if (g.rerollPenalty > 0) parts.push(C.text.growlStatus.replace('{n}', Math.max(0, C.rerollsPerTurn - g.rerollPenalty + g.rerollBonus)));
    if (g.rerollBonus > 0) parts.push(C.text.bonusStatus.replace('{n}', g.rerollBonus));
    if (g.pendingSow > 0) parts.push(C.text.sowStatus.replace('{n}', g.pendingSow));
    if (g.tax > 0) parts.push(C.text.s.taxedStatus.replace('{n}', g.tax));
    g.player.dice.forEach(d => { if (d.frozen) parts.push(C.text.s.yourDiceFrozen.replace('{die}', d.id)); });
    if (ui.holdPick) parts.push(C.text.holdPick);
    g.player.dice.forEach(d => { if (d.heldOver) parts.push(C.text.heldStatus.replace('{die}', d.label || d.id)); });
    s = parts.join(' · ');
  } else if (ph === 'arranging') {
    const parts = [];
    if (g.rerolls === 0 && g.player.dice.some(d => !d.held && !d.frozen)) parts.push(C.text.noRerolls);
    if (g.tax > 0) parts.push(C.text.s.taxedStatus.replace('{n}', g.tax));
    g.player.dice.forEach(d => { if (d.frozen) parts.push(C.text.s.yourDiceFrozen.replace('{die}', d.id)); });
    s = parts.join(' · ');
  }
  $('status').textContent = s;
}
function renderTopBar() {
  const enc = ui.screen === 'encounter';
  const n = enc && view ? viewScars() : E.tripScars(ui.trip);
  document.querySelectorAll('#scars .scarbox').forEach((b, i) => b.classList.toggle('on', i < n));
  document.querySelectorAll('#scars .scarbox').forEach(b => { b.style.display = dieRule() ? 'none' : ''; });
  $('scarN').textContent = scarSummary(enc && view ? (id => view.dice[id].faces) : tripFaces);
  $('turn').textContent = enc && ui.game ? C.text.turn + ' ' + ui.game.turn : '';
  $('invCount').textContent = C.text.itemsLabel + ' ' + ui.trip.inventory.length;
  const t = ui.trip;
  const dayEl = $('dayInd'), M = MT();
  dayEl.style.display = t.mode === 'm2' && ui.screen !== 'start' ? 'inline' : 'none';
  if (ui.screen === 'start') { $('stageInd').innerHTML = ''; return; }
  if (t.mode === 'm2') {
    const cold = t.daylight <= 0;
    dayEl.textContent = cold ? M.coldShort : M.dayShort.replace('{n}', t.daylight);
    dayEl.classList.toggle('cold', cold);
    dayEl.title = M.daylight;
    $('stageInd').innerHTML = '<span class="cur">' + M.map + '</span><i>·</i><span>' + esc(M.moves.replace('{n}', t.moves)) + '</span>';
    return;
  }
  // future fights show as '?' until reached (all of them during the intro placement); the campfire is always known
  const intro = ui.screen === 'placement' && ui.placementMode === 'intro';
  $('stageInd').innerHTML = t.sequence.map((id, i) => {
    const cls = t.over ? 'done' : (i < t.stageIdx ? 'done' : (i === t.stageIdx ? 'cur' : ''));
    const known = E.isCampfire(id) || t.over || i < t.stageIdx || (i === t.stageIdx && !intro);
    return '<span class="' + cls + '"' + (known ? '' : ' title="' + esc(C.text.s.unknownFight) + '"') + '>' +
      esc(known ? (C.trip.stageLabels[id] || id) : C.trip.unknownLabel) + '</span>';
  }).join('<i>·</i>');
}
function renderOverlay() {
  const ov = $('overlay'), g = ui.game;
  const show = ui.screen === 'encounter' && (ui.phase === 'won' || ui.phase === 'lost' || ui.phase === 'guardian');
  ov.classList.toggle('show', show);
  if (show && ui.phase === 'guardian') {
    const gd = C.enemies[g.guardian];
    $('ovBig').textContent = MT().guardianArrives.replace('{name}', gd.name);
    $('ovBig').style.color = C.colors.verb.PRUNE;
    $('ovBig').style.fontSize = '56px';
    $('ovSub').textContent = MT().guardianSub;
    $('ovRestart').textContent = MT().fight;
  } else if (show && isSite()) {
    $('ovBig').textContent = C.text.lost; $('ovBig').style.color = C.colors.scarText; $('ovBig').style.fontSize = '';
    $('ovSub').textContent = lostSubText(); $('ovRestart').textContent = C.text.buttons.continue;
  } else if (show) {
    $('ovBig').style.fontSize = ''; $('ovRestart').textContent = C.text.buttons.continue;
    $('ovBig').textContent = ui.phase === 'won' && g.resultLabel ? g.resultLabel : g.result;
    $('ovBig').style.color = ui.phase === 'lost' ? C.colors.scarText : (g.result === C.text.befriended ? C.colors.turned : C.colors.verb.PRUNE);
    $('ovSub').textContent = ui.phase === 'won'
      ? (g.result === C.text.befriended ? g.enemy.winText.befriended : g.enemy.winText.beaten)
      : lostSubText();
  }
}
function lostSubText() {
  const id = (ui.game && ui.game.lostDie) || (ui.trip && ui.trip.lostDie);
  return id ? C.text.lostDieSub.replace('{die}', E.dieLabel(id)) : C.text.lostSub;
}

// popover with all 6 faces
function showPopover(id) {
  if (ui.drag) return;
  const d = ui.game.player.dice.find(x => x.id === id), vd = view.dice[id];
  const pop = $('pop');
  const shownCur = ui.phase !== 'await-roll' && ui.phase !== 'start';
  const cur = vd.faces[vd.idx], cp = E.parseFace(cur);
  const lines = [];
  if (shownCur) {
    if (cp.kind === 'verb') lines.push('<span style="color:' + C.colors.verb[cp.verb] + '">' + cp.verb + '</span> ' + esc(C.verbInfo[cp.verb]));
    else if (cp.kind === 'body') {
      const bp = C.bodyParts[cp.body] || {}, fv = bp.favourite;
      lines.push(esc(cp.body) + ': ' + (bp.fixedPoints != null ? bp.fixedPoints + ' point(s) under any verb' : fv
        ? 'favourite verb <span style="color:' + C.colors.verb[fv] + '">' + fv + '</span> (2 points, others 1)' : 'no favourite verb'));
      if (cp.item) lines.push(esc(itemName(cp.item)) + ': ' + esc(C.items[cp.item].info));
    } else lines.push('SCAR: 0 points');
  }
  if (vd.frozen) lines.push('<span style="color:#8fe0ff">' + esc(C.text.s.frozen) + ':</span> ' + esc(C.text.s.frozenTip));
  pop.innerHTML = '<div class="ttl">' + esc(E.dieLabel(id)) + ' · 6 faces</div><div class="row">' +
    vd.faces.map((f, i) => '<div class="f' + (i === vd.idx && shownCur ? ' cur' : '') + '"><div class="faceRow">' + faceHTML(f) + '</div></div>').join('') + '</div>' +
    (lines.length ? '<div class="ttl" style="margin:8px 0 0;letter-spacing:.04em;font-weight:400;font-size:12px;color:var(--text);max-width:520px;white-space:normal">' + lines.join('<br>') + '</div>' : '');
  pop.style.display = 'block';
  const sr = $('stage').getBoundingClientRect(), r = dom.dieEls[id].getBoundingClientRect();
  const pw = pop.offsetWidth, ph2 = pop.offsetHeight;
  let x = r.left - sr.left + r.width / 2 - pw / 2;
  x = Math.max(8, Math.min(sr.width - pw - 8, x));
  let y = r.top - sr.top - ph2 - 8;
  if (y < 8) y = r.bottom - sr.top + 8;
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function hidePopover() { $('pop').style.display = 'none'; }

// 'KNIFE TAKEN' / 'KNIFE BORROWED' (by the face that did it)
const takenText = (ev) => ((C.text.tookBy && C.text.tookBy[ev.by]) || C.text.took).replace('{item}', itemName(ev.item));
