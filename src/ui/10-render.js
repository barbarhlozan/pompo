// UI: Static DOM, enemy panel, render functions, popovers.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- static DOM ----------
const dom = { slotEls: [], cellEls: {}, dieEls: {}, efc: [] };
function buildDOM() {
  // slots + arrows
  const slots = $('slots');
  for (let i = 0; i < C.playerDice.length; i++) {
    if (i > 0) { const a = document.createElement('div'); a.className = 'arrow'; a.textContent = '▶'; slots.appendChild(a); }
    const s = document.createElement('div');
    s.className = 'slot'; s.dataset.slot = i;
    s.innerHTML = '<span class="num">' + (i + 1) + '</span>';
    slots.appendChild(s); dom.slotEls.push(s);
  }
  // tray cells + dice
  ui.slots = emptySlots();
  C.playerDice.forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.dataset.die = d.id;
    $('tray').appendChild(cell); dom.cellEls[d.id] = cell;
    const die = document.createElement('div');
    die.className = 'die'; die.dataset.id = d.id;
    die.innerHTML = '<div class="faceRow"></div><div class="cap">' + (d.label || d.id) + '</div><span class="held">' + C.text.held + '</span>' +
      '<span class="frz" title="' + esc(C.text.s.frozenTip) + '">' + C.text.s.frozen + '</span>' +
      '<div class="ctl"><button class="up" title="Place in leftmost empty slot">▲</button>' +
      '<button class="down" title="Return to tray">▼</button></div>';
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
   ['lift', C.fx.liftScale]].forEach(kv => { if (kv[1] != null) root.setProperty('--' + kv[0], kv[1]); });
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
    el.classList.toggle('in-slot', si >= 0);
    el.classList.toggle('held', (d.held || !!d.heldOver) && !hidden);
    el.classList.toggle('frozen', !!vd.frozen);
    el.title = vd.frozen ? C.text.s.frozenTip : '';
    el.classList.toggle('dim', hidden);
    el.querySelector('.ctl').style.visibility = canInteract() ? 'visible' : 'hidden';
  });
}
function renderSlots() {
  const n = slotCount();
  for (let i = n; i < ui.slots.length; i++) ui.slots[i] = null;           // a debug change of the slot count empties the hidden slots
  const arrows = document.querySelectorAll('#slots .arrow');
  dom.slotEls.forEach((s, i) => {
    s.style.display = i < n ? '' : 'none';
    if (arrows[i - 1]) arrows[i - 1].style.display = i < n ? '' : 'none';
    s.classList.toggle('full', !!ui.slots[i]);
    s.classList.toggle('acting', ui.actingSlot === i);
    s.dataset.n = i + 1;
  });
  const tg = (currentPreview().triggers) || {}, last = n - 1;
  dom.slotEls.forEach((s, i) => {
    s.classList.toggle('trig', !!(i < n && ((tg.glassesFirst && i === 0) || (tg.earTrumpet && tg.earTrumpet.indexOf(i) >= 0) || (tg.pipeLast && i === last))));
  });
  $('slots').classList.toggle('complete', placedCount() === slotCount() && (ui.phase === 'arranging' || ui.phase === 'resolving' || ui.phase === 'enemy'));
}
function currentPreview() {
  if (ui.previewOverride) return ui.previewOverride;
  if (ui.phase === 'arranging') {
    if (placedCount() < slotCount()) return { hint: true, shape: '', text: C.text.placeHint.replace(/\{slots\}/g, slotCount()).replace('{n}', placedCount()) };
    const faces = ui.slots.slice(0, slotCount()).map(id => viewFace(id));
    if (isSite()) {
      const ev = E.evaluateSentence(faces, { site: true });
      const sp = E.sitePreview(ui.game, ev);
      const tg = ui.game.target !== null ? ' (' + MT().target.toLowerCase() + ': ' + (ui.game.target + 1) + ')' : '';
      return { shape: ev.shape, triggers: ev.triggers, text: ev.text + '  ⇒  ' + sp.text + tg, sentence: faces.map((f, i) => i === ev.mindIndex ? '[' + faceLabel(f) + ']' : faceLabel(f)).join(' ') };
    }
    const ev = E.evaluateSentence(faces, { enemy: ui.game.enemy, tax: ui.game.tax || 0 });
    return { shape: ev.shape, triggers: ev.triggers, text: ev.text, sentence: faces.map((f, i) => i === ev.mindIndex ? '[' + faceLabel(f) + ']' : faceLabel(f)).join(' ') };
  }
  if (ui.phase === 'await-roll') {
    const log = ui.game.log;
    const fresh = isSite() ? ui.game.turn <= 1 : !log.length;
    return { hint: true, shape: '', text: !fresh && log.length ? C.text.lastTurn + ' ' + log[log.length - 1] : C.text.pressRoll };
  }
  return { hint: true, shape: '', text: '' };
}
function renderPreview() {
  const p = currentPreview();
  $('shape').textContent = p.sentence ? (p.shape ? p.shape + ' · ' : '') + p.sentence : (p.shape || '');
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
