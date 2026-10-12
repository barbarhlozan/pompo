// DEBUG: tuning drawer (own IIFE).

// Debug / tuning drawer. Own IIFE; talks to the game only through window.SmugUI (game state is edited in place, then
// SmugUI.syncView() + SmugUI.renderAll()). Closed by default; toggle with the DEBUG button or the ` key.
(function () {
  const E = globalThis.SmugEngine, C = CONFIG;
  const $ = (id) => document.getElementById(id);
  let U, panel, open = false, sig = '';

  const busy = () => U.ui.phase === 'resolving' || U.ui.phase === 'enemy';   // commit playback running
  const isSite = () => !!U.game && U.game.siteId !== undefined;
  const live = () => U.ui.screen === 'encounter' && !isSite() && (U.ui.phase === 'await-roll' || U.ui.phase === 'arranging');
  const refreshGame = () => { U.syncView(); U.renderAll(); if (U.ui.hover) { const d = U.ui.hover; U.dom.dieEls[d].dispatchEvent(new Event('pointerenter')); } };

  // ---------- actions (also the console API: SmugDebug.*) ----------
  function setFace(dieId, idx) {
    if (U.ui.phase !== 'arranging') return false;
    const die = U.game.player.dice.find(d => d.id === dieId);
    if (!die || !(idx >= 0 && idx < die.faces.length)) return false;
    die.idx = idx; refreshGame(); return true;
  }
  function addRerolls(n) {
    if (U.ui.phase !== 'arranging') return false;
    U.game.rerolls = Math.max(0, U.game.rerolls + n); refreshGame(); return true;
  }
  function resetEnemy() {
    if (!live()) return false;
    U.game.enemy = E.createEnemy(U.game.enemyId, Math.random);
    U.ui.enemyText = ''; U.ui.verbFlash = '';
    refreshGame(); return true;
  }
  function setIntent(faceIdx) {
    if (!live()) return false;
    const en = U.game.enemy, f = en.faces[faceIdx];
    if (!f) return false;
    en.current = { faceIdx, wag: E.faceStatus(f) === 'turned' };
    U.ui.enemyText = '';
    refreshGame(); return true;
  }
  function clearScars() {
    if (!live()) return false;
    U.game.player.dice.forEach(d => {
      const orig = C.playerDice.find(x => x.id === d.id);
      if (orig) d.faces = d.faces.map((f, i) => (f === C.text.scar ? orig.faces[i].split('+')[0] : f));
    });
    refreshGame(); return true;
  }
  // force the ACCOUNTANT's statuses without playing the face: tax for the coming sentence, a frozen die
  function setTax(n) {
    if (!U.game || U.ui.screen !== 'encounter') return false;
    U.game.tax = n; refreshGame(); return true;
  }
  function freezeDie(dieId) {
    if (!U.game || U.ui.screen !== 'encounter') return false;
    const die = U.game.player.dice.find(d => d.id === dieId && d.kind !== 'mind');
    if (!die) return false;
    die.frozen = !die.frozen; if (die.frozen) die.held = false;
    refreshGame(); return true;
  }
  // slot count of the current encounter / site (1..number of dice); dice in the vanished slots return to the tray
  function setSlots(n) {
    if (!U.game || U.ui.screen !== 'encounter') return false;
    U.game.slots = Math.max(1, Math.min(C.playerDice.length, Math.floor(n) || 1));
    if (U.game.enemy) U.game.enemy.slots = U.game.slots;
    refreshGame(); return true;
  }
  function setHidePips(hide) {
    U.ui.hidePips = !!hide;
    U.render.renderEnemy();
    syncPanel(true);
  }

  // trip controls (also console API)
  function giveItem(id) { const ok = U.giveItem(id); syncPanel(true); return ok; }
  function jumpTo(id) { const ok = U.jumpTo(id); syncPanel(true); return ok; }
  function addScars(n) { U.addScars(n); syncPanel(true); }
  function forceLose() { U.forceLose(); syncPanel(true); }
  function setDaylight(n) { const ok = U.setDaylight(n); syncPanel(true); return ok; }
  function setNoise(n) { const ok = U.setNoise(n); syncPanel(true); return ok; }
  function setScars(n) { U.setScars(n); syncPanel(true); }

  // ---------- panel ----------
  let intentFor = '';
  function build() {
    const stage = $('stage');
    const btn = document.createElement('button');
    btn.id = 'btnDebug'; btn.textContent = 'DEBUG'; btn.title = 'Debug / tuning panel (`)';
    $('top').appendChild(btn);
    btn.addEventListener('click', () => toggle());

    panel = document.createElement('aside');
    panel.id = 'dbg';
    panel.innerHTML =
      '<h4>ENEMY VIEW</h4>' +
      '<label class="chk"><input type="checkbox" id="dbgShow"> show all enemy faces and pips</label>' +
      '<h4>PLAYER DICE · SET SHOWN FACE</h4><div id="dbgDice"></div>' +
      '<h4>REROLLS</h4><div class="row"><button class="dbtn" id="dbgRrMinus">− 1</button>' +
      '<button class="dbtn" id="dbgRrPlus">+ 1</button><span id="dbgRr"></span></div>' +
      '<h4>ENEMY</h4><div class="row"><label>intent</label><select id="dbgIntent"></select></div>' +
      '<div class="row"><button class="dbtn" id="dbgReset">RESET ENEMY</button><button class="dbtn" id="dbgScars">CLEAR SCARS</button></div>' +
      '<div class="row"><button class="dbtn" id="dbgTax">TAX NEXT SENTENCE</button></div><div class="row" id="dbgFrz"></div>' +
      '<h4>RULES (V2)</h4>' +
      '<div class="row"><label>slots</label><input type="number" id="dbgSlots" min="1" max="' + C.playerDice.length + '" value="3" style="width:54px"><button class="dbtn" id="dbgSlotsSet">SET</button></div>' +
      '<label class="chk"><input type="checkbox" id="dbgHold"> mindAloneHolds</label>' +
      '<div class="row"><label>lose</label><select id="dbgLoseRule"><option value="dieLost">dieLost</option><option value="maxScars">maxScars</option></select></div>' +
      '<div id="dbgNote"></div>' +
      '<h4>M2 · MAP AND SITES</h4>' +
      '<label class="chk"><input type="checkbox" id="dbgMap"> reveal the whole map</label>' +
      '<label class="chk"><input type="checkbox" id="dbgSite"> show site contents</label>' +
      '<div class="row"><label>daylight</label><input type="number" id="dbgDay" min="0" max="12" value="12" style="width:54px"><button class="dbtn" id="dbgDaySet">SET</button></div>' +
      '<div class="row"><label>noise</label><input type="number" id="dbgNoise" min="0" max="6" value="0" style="width:54px"><button class="dbtn" id="dbgNoiseSet">SET</button></div>' +
      '<div class="row"><label>scars</label><input type="number" id="dbgScarN" min="0" max="5" value="0" style="width:54px"><button class="dbtn" id="dbgScarSet">SET</button></div>' +
      '<div class="row"><button class="dbtn" id="dbgStartM1">NEW M1 TRIP</button><button class="dbtn" id="dbgStartM2">NEW M2 TRIP</button><button class="dbtn" id="dbgMode">MODE SELECT</button></div>' +
      '<h4>TRIP</h4>' +
      '<div class="row"><label>give</label><select id="dbgItem"></select><button class="dbtn" id="dbgGive">GIVE</button></div>' +
      '<div class="row"><label>jump</label><select id="dbgJump"></select><button class="dbtn" id="dbgJumpGo">GO</button></div>' +
      '<div class="row"><button class="dbtn" id="dbgWinB">WIN: BEATEN</button><button class="dbtn" id="dbgWinF">WIN: BEFRIENDED</button></div>' +
      '<div class="row"><button class="dbtn" id="dbgScar1">+1 SCAR</button><button class="dbtn" id="dbgScarM">SCARS = MAX−1</button><button class="dbtn" id="dbgLose">FORCE LOSE</button></div>' +
      '<h4>TURN LOG · NEWEST FIRST</h4><ol id="dbgLog"></ol>';
    stage.appendChild(panel);

    const dice = $('dbgDice');
    C.playerDice.forEach(d => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<label>' + d.id + '</label><select data-die="' + d.id + '"></select>';
      dice.appendChild(row);
      row.querySelector('select').addEventListener('change', (e) => { setFace(d.id, Number(e.target.value)); e.target.blur(); });
    });
    $('dbgShow').addEventListener('change', (e) => setHidePips(!e.target.checked));
    $('dbgRrMinus').addEventListener('click', () => addRerolls(-1));
    $('dbgRrPlus').addEventListener('click', () => addRerolls(1));
    $('dbgReset').addEventListener('click', resetEnemy);
    $('dbgScars').addEventListener('click', clearScars);
    $('dbgTax').addEventListener('click', () => setTax(U.game && U.game.tax ? 0 : C.effectRules.tax));
    E.bodyDieIds().forEach(id => {
      const b = document.createElement('button'); b.className = 'dbtn'; b.textContent = 'FREEZE ' + id;
      b.addEventListener('click', () => freezeDie(id)); $('dbgFrz').appendChild(b);
    });
    $('dbgSlotsSet').addEventListener('click', () => setSlots(Number($('dbgSlots').value)));
    $('dbgHold').checked = !!C.mindAloneHolds;
    $('dbgHold').addEventListener('change', (e) => { C.mindAloneHolds = e.target.checked; U.renderAll(); });
    $('dbgLoseRule').value = C.loseRule;
    $('dbgLoseRule').addEventListener('change', (e) => { C.loseRule = e.target.value; U.renderAll(); });
    const sel = $('dbgIntent');
    sel.addEventListener('change', (e) => { setIntent(Number(e.target.value)); e.target.blur(); });
    Object.keys(C.items).forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = C.items[id].name; $('dbgItem').appendChild(o); });
    C.trip.enemyPool.concat(Object.keys(C.sites), [C.trip.campfireId, C.trip.mapStage]).filter((id, i, a) => a.indexOf(id) === i).forEach(id => {
      const o = document.createElement('option'); o.value = id;
      o.textContent = (C.enemies[id] ? 'fight: ' : C.sites[id] ? 'site: ' : '') + id; $('dbgJump').appendChild(o);
    });
    $('dbgGive').addEventListener('click', () => giveItem($('dbgItem').value));
    $('dbgJumpGo').addEventListener('click', () => jumpTo($('dbgJump').value));
    $('dbgWinB').addEventListener('click', () => U.forceWin(C.text.beaten) && syncPanel(true));
    $('dbgWinF').addEventListener('click', () => U.forceWin(C.text.befriended) && syncPanel(true));
    $('dbgScar1').addEventListener('click', () => addScars(E.tripScars(U.trip) + 1));
    $('dbgScarM').addEventListener('click', () => addScars(C.maxScars - 1));
    $('dbgLose').addEventListener('click', () => forceLose());
    $('dbgMap').addEventListener('change', (e) => { U.setShowMap(e.target.checked); });
    $('dbgSite').addEventListener('change', (e) => { U.setShowSite(e.target.checked); });
    $('dbgDaySet').addEventListener('click', () => { setDaylight(Number($('dbgDay').value)); });
    $('dbgNoiseSet').addEventListener('click', () => { setNoise(Number($('dbgNoise').value)); });
    $('dbgScarSet').addEventListener('click', () => { setScars(Number($('dbgScarN').value)); });
    $('dbgStartM1').addEventListener('click', () => { U.startTrip('m1'); syncPanel(true); });
    $('dbgStartM2').addEventListener('click', () => { U.startTrip('m2'); syncPanel(true); });
    $('dbgMode').addEventListener('click', () => { U.showStart(); syncPanel(true); });

    // keep the panel's own typing / clicks away from the game's global key handlers (1-3) — except the toggle key
    panel.addEventListener('keydown', (e) => { if (e.key !== '`') e.stopPropagation(); });
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.code === 'Backquote') { e.preventDefault(); toggle(); }
    });
  }

  function toggle(force) {
    open = force === undefined ? !open : !!force;
    panel.classList.toggle('open', open);
    $('btnDebug').classList.toggle('on', open);
    if (open) syncPanel(true);
  }

  // Cheap signature of everything the panel shows; the panel re-renders only when it changes (no per-frame DOM churn).
  function signature() {
    const g = U.game, ui = U.ui;
    const t = U.trip;
    if (!g) return ['nogame', ui.screen, t.stageIdx, t.stage, t.daylight, t.inventory.length, t.log.length].join('#');
    if (g.siteId !== undefined) return ['site', ui.phase, ui.screen, g.siteId, g.turn, g.rerolls, g.noise, g.log.length, t.inventory.length, t.daylight,
      g.player.dice.map(d => d.idx + ':' + d.faces.join(',')).join('|')].join('#');
    return [ui.phase, ui.screen, g.enemyId, g.turn, g.rerolls, g.log.length, ui.hidePips, g.enemy.current && g.enemy.current.faceIdx,
      t.stageIdx, t.inventory.length, t.log.length, g.over,
      g.player.dice.map(d => d.idx + ':' + d.faces.join(',')).join('|')].join('#');
  }
  function syncPanel(force) {
    if (!panel || !open) return;
    const s = signature();
    if (!force && s === sig) return;
    sig = s;
    if (isSite()) {                            // scavenge site: dice controls work, enemy controls don't
      const g = U.game, ui = U.ui;
      const hid = ui.phase !== 'arranging';
      ['dbgIntent', 'dbgReset', 'dbgScars'].forEach(id => { $(id).disabled = true; });
      $('dbgRrMinus').disabled = hid || g.rerolls <= 0; $('dbgRrPlus').disabled = hid;
      $('dbgRr').textContent = g.rerolls + ' left';
      g.player.dice.forEach(d => {
        const sel = panel.querySelector('select[data-die="' + d.id + '"]');
        sel.innerHTML = d.faces.map((f, i) => '<option value="' + i + '">' + (i + 1) + ': ' + f + '</option>').join('');
        sel.value = d.idx; sel.disabled = hid;
      });
      $('dbgNoise').value = g.noise;
      $('dbgDay').value = U.trip.daylight;
      $('dbgNote').textContent = 'scavenge site: ' + g.name + ', noise ' + g.noise + '/' + g.noiseMax + ' (a full track brings the guardian at the end of the turn)';
      const log = g.log.slice(-C.debug.logRows).reverse();
      $('dbgLog').innerHTML = log.map(() => '<li></li>').join('');
      $('dbgLog').querySelectorAll('li').forEach((li, i) => { li.textContent = log[i]; });
      return;
    }
    if (!U.game) {                              // map / intro placement / other screens: no encounter exists
      $('dbgNote').textContent = U.ui.screen + ': no encounter now (jump to one to use the fight controls)';
      ['dbgIntent', 'dbgReset', 'dbgScars', 'dbgRrMinus', 'dbgRrPlus'].forEach(id => { $(id).disabled = true; });
      panel.querySelectorAll('select[data-die]').forEach(x => { x.disabled = true; });
      $('dbgDay').value = U.trip.daylight;
      return;
    }
    const g = U.game, ui = U.ui, dis = busy();
    const hidden = ui.phase !== 'arranging';
    if (intentFor !== g.enemyId) {            // intent options follow the current enemy's faces
      intentFor = g.enemyId;
      $('dbgIntent').innerHTML = C.enemies[g.enemyId].faces.map((cf, i) => '<option value="' + i + '">' + (i + 1) + ': ' + cf.name + '</option>').join('');
    }
    g.player.dice.forEach(d => {
      const sel = panel.querySelector('select[data-die="' + d.id + '"]');
      sel.innerHTML = d.faces.map((f, i) => '<option value="' + i + '">' + (i + 1) + ': ' + f + '</option>').join('');
      sel.value = d.idx; sel.disabled = hidden;
      sel.title = hidden ? (dis ? 'locked during playback' : 'ROLL first: dice are hidden until rolled') : '';
    });
    $('dbgShow').checked = !ui.hidePips;
    $('dbgRr').textContent = g.rerolls + ' left' + (g.rerollPenalty ? ' (−' + g.rerollPenalty + ' next turn)' : '') +
      (g.tax ? ' · taxed −' + g.tax : '') + g.player.dice.filter(d => d.frozen).map(d => ' · ' + d.id + ' frozen').join('');
    $('dbgRrMinus').disabled = ui.phase !== 'arranging' || g.rerolls <= 0;
    $('dbgRrPlus').disabled = ui.phase !== 'arranging';
    $('dbgIntent').value = g.enemy.current.faceIdx;
    $('dbgIntent').disabled = !live();
    $('dbgReset').disabled = !live();
    $('dbgScars').disabled = !live();
    $('dbgNote').textContent = dis ? 'locked while the commit plays back'
      : ui.screen !== 'encounter' ? 'not in an encounter (' + ui.screen + '): jump to one to use the fight controls'
      : (ui.phase === 'won' || ui.phase === 'lost') ? 'fight over: CONTINUE, or jump / restart the trip'
      : ui.phase === 'await-roll' ? 'dice are hidden until ROLL (face + reroll controls wake up after)' : '';
    // log: engine pushes the new line at once, hide it until playback is over
    const log = g.log.slice(0, g.log.length - (dis ? 1 : 0)).slice(-C.debug.logRows).reverse();
    $('dbgLog').innerHTML = log.length ? log.map(l => '<li></li>').join('') : '<li>(no turns yet)</li>';
    if (log.length) $('dbgLog').querySelectorAll('li').forEach((li, i) => { li.textContent = log[i]; });
  }

  function init() {
    U = window.SmugUI;
    build();
    setInterval(() => syncPanel(false), C.debug.pollMs);
    window.SmugDebug = { toggle, setTax, freezeDie, setSlots, setFace, addRerolls, resetEnemy, setIntent, clearScars, setHidePips, giveItem, jumpTo, addScars, forceLose,
      setDaylight, setNoise, setScars, revealMap: (on) => U.setShowMap(on), showSite: (on) => U.setShowSite(on),
      forceWin: (r) => { const ok = U.forceWin(r); syncPanel(true); return ok; }, sync: () => syncPanel(true) };
  }
  document.addEventListener('DOMContentLoaded', init);
})();
