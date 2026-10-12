// UI: Event player: one handler per engine event, hooks.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- event player ----------
// One async handler per engine event type. Phase 3: extend a handler (or wrap it) to add animation.
// Handlers update `view` / `ui` fields, call the relevant render functions, then await their own timing.
const T = C.timing;
const EVENT_HANDLERS = {
  async sentence(ev) {
    Object.keys(view.dice).forEach(id => { view.dice[id].frozen = false; });   // the engine thaws a frozen die once it is used
    renderDice();
    ui.previewOverride = { shape: ev.evaluation.shape, triggers: ev.evaluation.triggers, ev: ev.evaluation, text: ev.preview ? ev.preview.text : '' };
    // the rail plays left -> right; a MIND in slot 0 is "reached" first, otherwise the playhead starts at the first step
    ui.railPlay = { idx: ev.evaluation.mindIndex === 0 ? 0 : -1, totals: !ev.evaluation.steps.length };
    ui.narr = { sentence: narrateSentence(ev.evaluation), hits: [] };
    renderPreview(); renderSlots();
    await sleep(T.resolveStepMs / 2);
  },
  async step(ev) {
    ui.actingSlot = ev.step.slot;
    if (ui.railPlay) ui.railPlay.idx = ev.step.slot;
    ui.enemyText = '';
    renderSlots(); renderEnemy();
    await sleep(T.railStepMs);
  },
  async verb(ev) {
    ui.actingSlot = null;
    if (ui.railPlay) ui.railPlay.totals = true;
    ui.verbFlash = isSite() && ev.verb === 'SOW' ? ev.verb + ' ' + ev.total + ' → ' + ev.amount + (ev.amount === 1 ? ' pip' : ' pips') : ev.verb + ' ' + ev.amount;
    renderSlots(); renderEnemy();
    await sleep(T.resolveStepMs / 2);
  },
  async pip(ev) {
    view.enemy.faces[ev.faceIdx].pips[ev.pipIdx] = ev.to;
    if (ui.narr) ui.narr.hits.push({ faceIdx: ev.faceIdx, to: ev.to });
    renderEnemy(); renderPreview();
    await sleep(T.resolveStepMs / 2.5);
  },
  async faceResolved(ev) {
    renderEnemy();
    await sleep(T.resolveStepMs / 2);
  },
  async reveal(ev) {
    view.enemy.next = { faceIdx: ev.next.faceIdx, wag: ev.next.wag };
    view.enemy.queue = ev.list.map(x => ({ faceIdx: x.intent.faceIdx, wag: x.intent.wag }));
    ui.enemyText = ev.rerolled ? C.text.revealChanged : C.text.revealSeen;
    renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async win(ev) {
    ui.verbFlash = '';
    ui.enemyText = ev.result;
    renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async enemyAct(ev) {
    ui.phase = 'enemy';
    ui.verbFlash = ''; ui.actingSlot = null;
    ui.enemyText = enemyActSentence(ev);
    renderEnemy(); renderSlots(); renderControls();
    await sleep(T.enemyActMs);
  },
  async scar(ev) {
    const vd = view.dice[ev.dieId];
    vd.faces[ev.faceIdx] = C.text.scar;
    renderDice(); renderTopBar();
    await sleep(T.resolveStepMs);
  },
  // V1 events ------------------------------------------------------------------
  async mod(ev) {                       // pruneMod / sowMod applied to the sentence total
    ui.actingSlot = null;
    if (ui.railPlay) ui.railPlay.totals = true;
    ui.verbFlash = C.text.modFlash.replace('{verb}', ev.verb).replace('{before}', ev.before).replace('{after}', ev.after)
      .replace('{source}', ev.source).replace('{mod}', signed(ev.mod));
    renderSlots(); renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async itemTaken(ev) {                 // SNIP / STEAL: the item leaves the die for the enemy's bag / nest
    view.dice[ev.dieId].faces[ev.faceIdx] = ev.becomes;
    view.enemy.bag.push(ev.item);
    ui.enemyText = takenText(ev);
    renderDice(); renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async itemDestroyed(ev) {             // a scar destroyed the item on that face (cause 'river': it fell off the bridge)
    if (ev.becomes) view.dice[ev.dieId].faces[ev.faceIdx] = ev.becomes;
    ui.enemyText = (ev.cause === 'river' ? C.text.lostRiver : C.text.destroyed).replace('{item}', itemName(ev.item));
    if (ev.becomes) renderDice();
    renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async pendingSow(ev) {
    if (ev.phase === 'applied') {       // start of the next turn: the watering can's SOW lands before the dice roll
      ui.verbFlash = 'SOW ' + ev.amount;
      ui.enemyText = itemName('WATERING_CAN') + ': SOW ' + ev.amount;
      renderEnemy();
      await sleep(T.resolveStepMs);
    } else {                            // queued by this sentence: just a beat (the status line shows it afterwards)
      await sleep(T.resolveStepMs / 2);
    }
  },
  async rerollBonus(ev) {
    await sleep(T.resolveStepMs / 2);
  },
  async taxed(ev) {                     // ACCOUNTANT tax: this sentence's verb total is reduced
    ui.actingSlot = null;
    if (ui.railPlay) ui.railPlay.totals = true;
    ui.verbFlash = C.text.taxFlash.replace('{verb}', ev.verb).replace('{after}', ev.after).replace('{n}', ev.amount);
    renderSlots(); renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async freeze(ev) {                    // ANECDOTE: a die freezes up for the next turn
    view.dice[ev.dieId].frozen = true;
    renderDice();
    await sleep(T.resolveStepMs);
  },
  async bellyExposed(ev) {              // a BELLY face was showing without a VEST: the scar event follows
    ui.verbFlash = ''; ui.actingSlot = null;
    ui.enemyText = ev.text;
    renderEnemy(); renderSlots();
    await sleep(T.resolveStepMs);
  },
  async chargeSpent(ev) {               // MATCHES etc.: one use spent (the die keeps showing the item until it burns out)
    ui.enemyText = itemName(ev.item) + ': ' + ev.left + ' left';
    renderEnemy();
    await sleep(T.resolveStepMs / 2);
  },
  async itemBurnedOut(ev) {
    view.dice[ev.dieId].faces[ev.faceIdx] = ev.becomes;
    ui.enemyText = itemName(ev.item) + ' burned out';
    renderDice(); renderEnemy();
    await sleep(T.resolveStepMs);
  },
  async lose(ev) {
    ui.enemyText = C.text.lost + (ev.dieId ? ' (' + C.text.lostDie.replace('{die}', ev.dieLabel) + ')' : '');
    renderEnemy();
    await sleep(T.resolveStepMs);
  },
  // scavenge site events ------------------------------------------------------
  async siteReveal(ev) {
    const f = view.site.faces[ev.faceIdx];
    f.revealed = true; f.content = ev.content; f.item = ev.item;
    renderSite();
    await sleep(T.resolveStepMs);
  },
  async sitePip(ev) {
    const f = view.site.faces[ev.faceIdx], st = ev.verb === 'PRUNE' ? 'broken' : 'turned';
    f.pips[ev.pipIdx] = st; f.pipsLeft = ev.pipsLeft;
    (ui.pipRec[ev.faceIdx] = ui.pipRec[ev.faceIdx] || [])[ev.pipIdx] = st;
    renderSite();
    await sleep(T.resolveStepMs / 2.5);
  },
  async noise(ev) {
    view.site.noise = ev.total;
    renderSite();
    await sleep(T.resolveStepMs / 2);
  },
  async siteOpen(ev) {
    const f = view.site.faces[ev.faceIdx], M = MT();
    f.opened = true; f.revealed = true; f.content = ev.content; f.item = ev.item; f.brokenItem = ev.brokenItem;
    ui.enemyText = ev.overkill ? M.brokeInto.replace('{item}', itemName(ev.brokenItem)) + ' (overkill)'
      : M.openedText[ev.content].replace('{item}', ev.item ? itemName(ev.item) : '');
    renderSite();
    await sleep(T.resolveStepMs * 1.3);
  },
  async itemGained(ev) {
    view.site.found.push(ev.item);
    renderSite();
    await sleep(T.resolveStepMs / 2);
  },
  async guardian(ev) {
    ui.enemyText = MT().guardianArrives.replace('{name}', ev.name);
    renderSite();
    await sleep(T.resolveStepMs * 1.5);
  },
  async newIntent(ev) {
    view.enemy.current = { faceIdx: ev.intent.faceIdx, wag: ev.intent.wag };
    view.enemy.next = ev.next ? { faceIdx: ev.next.faceIdx, wag: ev.next.wag } : null;
    view.enemy.queue = ev.list.map(x => ({ faceIdx: x.intent.faceIdx, wag: x.intent.wag }));
    renderEnemy();
    await sleep(T.resolveStepMs / 2);
  },
};
// Cosmetic hooks Phase 3 can fill in (called outside the event player).
const hooks = {
  onRoll(ids) {}, onHold(id) {}, onFrozenClick(id) {}, onRestart() {}, onScreen(name, root) {}, onPick(el) {}, onHeal(dieId, idx) {},
  onDragStart(el, d) {}, onDragMove(el, e, d) {}, onDragEnd(el, d) {},
  onPlace(dieId, idx, item, replaced) {}, onUnplace(item) {}, onReject(el) {}, onDragItem(ghost) {}, onItemReturn(ghost, from, done) {},
  onMapMove(info) {}, onTarget(el, on) {},
  snapshot() { return null; }, play(snap, id, dropped) {},
};

async function playEvents(events, run) {
  for (const ev of events) {
    if (ui.runId !== run) return false;
    if (ev.type === 'enemyAct' && T.preEnemyMs) await sleep(T.preEnemyMs);   // a beat between your sentence and the enemy's action
    const h = EVENT_HANDLERS[ev.type];
    if (h) await h(ev);
  }
  return true;
}
