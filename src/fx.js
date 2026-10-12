// FX: juice layer (own IIFE).

// Juice layer: roll shuffle, drag/snap/swap/return animation, commit effects. Everything reacts to player input; nothing idles.
// Hooks into the UI only through SmugUI.EVENT_HANDLERS and SmugUI.hooks (no game rules in here).
(function () {
  const C = CONFIG, T = C.timing, FXC = C.fx;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  let U = null, dom = null;
  const live = new Set();          // transient DOM nodes (flyers, sparks, crack overlays) — swept on RESTART
  let shuffleTimer = null, tiltTimer = null;

  // ---------- helpers ----------
  // Web Animations helper; no-op when the user prefers reduced motion (unless `force`).
  function motion(el, kf, opts, force) {
    if (!el || !el.animate || (reduced() && !force)) return null;
    return el.animate(kf, Object.assign({ easing: 'ease-out' }, opts));
  }
  function ctr(el) {
    const r = el.getBoundingClientRect(), s = $('stage').getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  }
  function sweep(node) { live.delete(node); if (node.parentNode) node.parentNode.removeChild(node); }
  function addLive(node) { live.add(node); $('stage').appendChild(node); return node; }
  function shake(el, px, ms) {
    px = px == null ? FXC.shakePx : px;
    motion(el, [0, -1, .9, -.7, .5, -.3, 0].map(m => ({ transform: 'translateX(' + (m * px) + 'px)' })), { duration: ms || T.shakeMs, easing: 'linear' });
  }
  function popAnim(el, big, ms) {
    big = big || FXC.popScale;
    motion(el, [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(' + big + ') rotate(-3deg)', offset: .35 },
      { transform: 'scale(.95) rotate(1deg)', offset: .7 }, { transform: 'scale(1) rotate(0)' }], { duration: ms || T.popMs });
  }
  // text/number that flies from -> to (stage coords). Returns a promise-ish `onArrive` callback via opts.
  function fly(text, from, to, color, o) {
    o = o || {};
    const n = document.createElement('div');
    n.className = 'flyer' + (o.small ? ' small' : '');
    n.textContent = text; n.style.color = color;
    addLive(n);
    const base = 'translate(-50%,-50%)';
    const at = (p, dy, sc) => 'translate(' + p.x + 'px,' + (p.y + (dy || 0)) + 'px) ' + base + ' scale(' + sc + ')';
    const ms = o.ms || T.flyMs;
    let a;
    if (reduced()) {
      a = n.animate([{ transform: at(to, 0, 1), opacity: 1 }, { transform: at(to, 0, 1), opacity: 0 }], { duration: ms, easing: 'linear' });
    } else {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const lift = o.lift != null ? o.lift : FXC.flyLiftPx;
      a = n.animate([
        { transform: at(from, 0, .6), opacity: 0 },
        { transform: at(from, -10, 1.3), opacity: 1, offset: .18 },
        { transform: at(mid, lift, 1.15), opacity: 1, offset: .55 },
        { transform: at(to, 0, .8), opacity: 1, offset: .92 },
        { transform: at(to, 0, .4), opacity: 0 }], { duration: ms, easing: 'ease-in-out' });
    }
    a.onfinish = () => { sweep(n); if (o.onArrive) o.onArrive(); };
    a.oncancel = () => sweep(n);
    return n;
  }
  function floatText(text, at, color, o) {
    o = o || {};
    const n = document.createElement('div');
    n.className = 'flyer' + (o.small === false ? '' : ' small');
    n.textContent = text; n.style.color = color; addLive(n);
    at = { x: at.x, y: Math.max(at.y, FXC.floatMinY) };   // keep the whole rise below the top bar (stays inside the stage)
    const p = (dy, sc, op) => ({ transform: 'translate(' + at.x + 'px,' + (at.y + dy) + 'px) translate(-50%,-50%) scale(' + sc + ')', opacity: op });
    const a = n.animate([p(0, .6, 0), p(-14, 1.2, 1), p(-FXC.floatRisePx * .73, 1, 1), p(-FXC.floatRisePx, .9, 0)], { duration: o.ms || FXC.floatMs, easing: 'ease-out' });
    a.onfinish = a.oncancel = () => sweep(n);
  }
  function burst(at, color, count) {
    if (reduced()) return;
    count = count || FXC.particles;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'spark'; s.style.background = color; addLive(s);
      const ang = (i / count) * Math.PI * 2 + Math.random() * .6, dist = FXC.burstDistMin + Math.random() * FXC.burstDistRange;
      const x = at.x + Math.cos(ang) * dist, y = at.y + Math.sin(ang) * dist;
      const a = s.animate([
        { transform: 'translate(' + at.x + 'px,' + at.y + 'px) scale(1.2) rotate(0)', opacity: 1 },
        { transform: 'translate(' + x + 'px,' + y + 'px) scale(.2) rotate(' + (Math.random() * 360) + 'deg)', opacity: 0 }],
        { duration: FXC.burstMs + Math.random() * FXC.burstMsRange, easing: 'cubic-bezier(.1,.7,.4,1)' });
      a.onfinish = a.oncancel = () => sweep(s);
    }
  }
  const verbColor = (v) => C.colors.verb[v] || '#fff';

  // ---------- roll: shuffle faces, then settle with a bounce ----------
  function stopShuffle(restore) {
    if (shuffleTimer) { clearInterval(shuffleTimer); shuffleTimer = null; }
    shuffleJobs = [];
    if (restore) { Object.keys(dom.dieEls).forEach(id => { dom.dieEls[id].dataset.face = ''; }); U.render.renderDice(); }
  }
  let shuffleJobs = [];            // persistent: a REROLL mid-shuffle must not orphan dice that are still shuffling
  function startShuffle(ids) {
    if (reduced()) return;
    const t0 = performance.now(), step = T.shuffleStepMs;
    shuffleJobs = shuffleJobs.filter(j => !j.done && ids.indexOf(j.id) < 0)
      .concat(ids.map((id, k) => ({ id, end: t0 + T.rollShuffleMs + k * T.settleStaggerMs, done: false })));
    const jobs = shuffleJobs;
    let last = null;
    if (shuffleTimer) clearInterval(shuffleTimer);
    function tick() {
      const now = performance.now();
      let any = false;
      jobs.forEach(j => {
        if (j.done) return;
        const el = dom.dieEls[j.id], row = el.querySelector('.faceRow');
        if (now >= j.end) {
          j.done = true;
          el.dataset.face = '';                        // force renderDice to write the real face
          U.render.renderDice();
          motion(row, [{ scale: String(FXC.settleScale), rotate: '-5deg' }, { scale: '.9', rotate: '2deg', offset: .55 }, { scale: '1', rotate: '0deg' }], { duration: T.settleMs, easing: 'cubic-bezier(.3,1.4,.5,1)' });
          return;
        }
        any = true;
        const faces = U.view.dice[j.id].faces;
        let f; do { f = faces[Math.floor(Math.random() * faces.length)]; } while (f === last && faces.length > 1 && Math.random() < .7);
        last = f;
        row.innerHTML = U.faceHTML(f);
        row.style.rotate = ((Math.random() - .5) * 12) + 'deg';
      });
      if (!any) { clearInterval(shuffleTimer); shuffleTimer = null; shuffleJobs = []; }
    }
    queueMicrotask(tick);
    shuffleTimer = setInterval(tick, step);
  }

  // ---------- drag / snap / swap / return (FLIP) ----------
  function snapshot() {
    const rects = {};
    Object.keys(dom.dieEls).forEach(id => {
      const el = dom.dieEls[id]; const r = el.getBoundingClientRect();
      rects[id] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, parent: el.parentNode };
    });
    return rects;
  }
  function play(snap, dragId) {
    if (!snap || reduced()) return;
    Object.keys(dom.dieEls).forEach(id => {
      const el = dom.dieEls[id], s = snap[id];
      if (el._flip) { el._flip.cancel(); el._flip = null; }
      const r = el.getBoundingClientRect();
      const dx = s.cx - (r.left + r.width / 2), dy = s.cy - (r.top + r.height / 2);
      const moved = s.parent !== el.parentNode;
      if (Math.abs(dx) + Math.abs(dy) < 2 && id !== dragId) return;
      el.style.zIndex = 20;
      let a;
      if (id === dragId) {
        const tilt = el._tilt || 0;
        const from = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + tilt + 'deg) scale(' + FXC.liftScale + ')';
        if (moved) {
          const total = T.snapMs + T.squashMs, f = T.snapMs / total;
          a = el.animate([
            { transform: from },
            { transform: 'translate(0,0) rotate(0) scale(1)', offset: f * .85, easing: 'cubic-bezier(.4,0,.8,1)' },
            { transform: 'scale(' + FXC.squash[0] + ')', offset: f + (1 - f) * .22 },
            { transform: 'scale(' + FXC.squash[1] + ')', offset: f + (1 - f) * .55 },
            { transform: 'scale(' + FXC.squash[2] + ')', offset: f + (1 - f) * .8 },
            { transform: 'scale(1,1)' }], { duration: total, easing: 'ease-out' });
        } else {
          a = el.animate([{ transform: from }, { transform: 'translate(0,0) rotate(0) scale(1)' }],
            { duration: T.returnMs, easing: 'cubic-bezier(.3,1.7,.5,1)' });     // overshoot: "boing, back"
        }
      } else {
        a = el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }],
          { duration: T.snapMs + 60, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
      }
      el._flip = a;
      const done = () => { if (el._flip === a) el._flip = null; el.style.zIndex = ''; };
      a.onfinish = done; a.oncancel = done;
    });
  }

  function onDragStart(el) { el._tilt = 0; }
  function onDragMove(el, e, d) {
    if (reduced()) return;
    const vx = e.clientX - (d.lx == null ? e.clientX : d.lx); d.lx = e.clientX;
    el._tilt = (el._tilt || 0) * .6 + Math.max(-FXC.tiltMaxDeg, Math.min(FXC.tiltMaxDeg, vx * FXC.tiltPerPx)) * .4;
    el.style.rotate = el._tilt + 'deg';
    if (tiltTimer) clearTimeout(tiltTimer);
    tiltTimer = setTimeout(function relax() {          // ease the tilt back to 0 when the pointer stops
      el._tilt *= .6; el.style.rotate = el._tilt + 'deg';
      if (Math.abs(el._tilt) > .3 && el.classList.contains('dragging')) tiltTimer = setTimeout(relax, 40); else tiltTimer = null;
    }, 60);
  }
  function onDragEnd(el) { if (tiltTimer) { clearTimeout(tiltTimer); tiltTimer = null; } }

  function onHold(id) {
    const el = dom.dieEls[id];
    motion(el.querySelector('.held'), [{ transform: 'scale(.4)' }, { transform: 'scale(1.3)', offset: .6 }, { transform: 'scale(1)' }], { duration: FXC.holdBadgeMs });
    motion(el.querySelector('.faceRow'), [{ scale: '1' }, { scale: '.9', offset: .4 }, { scale: '1' }], { duration: FXC.holdTileMs });
  }

  // ---------- full reset (RESTART): nothing animated or floating may survive ----------
  function reset() {
    stopShuffle(false);
    if (tiltTimer) { clearTimeout(tiltTimer); tiltTimer = null; }
    Array.from(live).forEach(sweep);
    document.querySelectorAll('#stage *').forEach(el => { if (el.getAnimations) el.getAnimations().forEach(a => a.cancel()); });
    Object.keys(dom.dieEls).forEach(id => {
      const el = dom.dieEls[id];
      el._flip = null; el.style.zIndex = ''; el.style.rotate = ''; el.dataset.face = '';
      const row = el.querySelector('.faceRow'); if (row) row.style.rotate = '';
    });
    document.querySelectorAll('.crack').forEach(n => n.remove());
  }

  // ---------- COMMIT playback ----------
  function targetCard() {
    if (U.game && U.game.siteId !== undefined) {               // scavenge site: the aimed face, else the first closed one
      const sv = U.view.site;
      if (sv.target !== null && sv.faces[sv.target] && !sv.faces[sv.target].opened) return sv.target;
      return Math.max(0, sv.faces.findIndex(f => !f.opened));
    }
    const en = U.view.enemy, ok = (i) => { const f = en.faces[i]; return f.hostile && f.pips.some(p => p === 'intact'); };
    if (en.current && !en.current.wag && ok(en.current.faceIdx)) return en.current.faceIdx;
    for (const nm of U.game.enemy.targetPriority) for (let i = 0; i < en.faces.length; i++) if (en.faces[i].name === nm && ok(i)) return i;
    return en.current ? en.current.faceIdx : 0;
  }
  function flashArrows(a, b) {
    const arrows = document.querySelectorAll('#slots .arrow');
    for (let i = Math.min(a, b); i < Math.max(a, b); i++) {
      const ar = arrows[i];
      motion(ar, [{ transform: 'scale(1)', color: C.colors.glow }, { transform: 'scale(' + FXC.arrowSwellScale + ')', color: verbColor(C.revealVerb), offset: .4 }, { transform: 'scale(1)' }], { duration: T.flyMs });
    }
  }
  function installHandlers() {
    const EH = U.EVENT_HANDLERS;
    const wrap = (name, fn) => {            // fn(ev, orig, run) must call orig(ev) exactly once and return its promise
      const orig = EH[name];
      EH[name] = (ev) => fn(ev, orig, U.ui.runId);
    };
    const same = (run) => U.ui.runId === run;

    wrap('step', async (ev, orig) => {
      const st = ev.step, id = U.ui.slots[st.slot], die = dom.dieEls[id];
      const from = ctr(dom.slotEls[st.slot]);
      const p = orig(ev);
      if (die) popAnim(die);
      const col = verbColor(st.verb);
      if (st.role === 'scar') floatText('0', from, C.colors.textDim, { small: false });
      else if (st.verb === C.revealVerb) {
        if (st.passesTo != null) {
          fly('+' + st.total, from, ctr(dom.slotEls[st.passesTo]), col, { lift: FXC.flyLiftDigPx });
          flashArrows(st.slot, st.passesTo);
        } else floatText(C.text.floatReveal, from, col);
      } else {
        const ci = targetCard(), card = dom.efc[ci];
        fly('+' + st.total, from, ctr(card), col, { onArrive: () => {
          motion(card, [{ transform: 'scale(1)' }, { transform: 'scale(' + FXC.cardPulseScale + ')', offset: .4 }, { transform: 'scale(1)' }], { duration: FXC.cardPulseMs });
        } });
      }
      await p;
    });
    wrap('verb', async (ev, orig) => {
      const p = orig(ev); popAnim($('verbFlash'), 1.4, 220); await p;
    });
    wrap('pip', async (ev, orig) => {
      const p = orig(ev);
      const card = dom.efc[ev.faceIdx], pip = card.querySelectorAll('.pip')[ev.pipIdx];
      const at = ctr(pip);
      if (ev.to === 'broken') {
        motion(pip, [{ transform: 'scale(2) rotate(0)' }, { transform: 'scale(.5) rotate(120deg)', offset: .6 }, { transform: 'rotate(45deg) scale(.7)' }], { duration: T.pipMs });
        burst(at, C.colors.pipIntact, FXC.burstCounts.pip);
      } else {
        motion(pip, [{ transform: 'rotateY(0) scale(1.9)' }, { transform: 'rotateY(180deg) scale(1.3)', offset: .5 }, { transform: 'rotateY(360deg) scale(1)' }], { duration: T.pipMs });
        burst(at, C.colors.turned, FXC.burstCounts.pip);
      }
      shake(card, FXC.shakePx);
      if (U.view.enemy.current && U.view.enemy.current.faceIdx === ev.faceIdx) shake($('intentTile'), FXC.shakePx);
      await p;
    });
    wrap('faceResolved', async (ev, orig) => {
      const p = orig(ev);
      const card = dom.efc[ev.faceIdx], tile = card.querySelector('.tile'), at = ctr(card);
      const turned = ev.resolved === 'turned';
      popAnim(card, 1.2, T.flourishMs);
      if (turned) motion(tile, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(360deg)' }], { duration: T.flourishMs });
      else motion(tile, [{ transform: 'translateX(0) rotate(0)' }, { transform: 'translateX(-5px) rotate(-6deg)', offset: .25 },
        { transform: 'translateX(5px) rotate(5deg)', offset: .5 }, { transform: 'translateX(0) rotate(0)' }], { duration: T.flourishMs });
      floatText(turned ? C.text.floatTurned : C.text.floatBroken, at, turned ? C.colors.turned : C.colors.hostile, { small: false });
      burst(at, turned ? C.colors.turned : C.colors.hostile, FXC.particles + FXC.burstCounts.resolvedExtra);
      if (U.view.enemy.current && U.view.enemy.current.faceIdx === ev.faceIdx) popAnim($('intentTile'), 1.25, T.flourishMs);
      await p;
    });
    wrap('reveal', async (ev, orig) => {
      const p = orig(ev);
      motion($('nextWrap'), [{ transform: 'translateX(-30px) scale(.8)' }, { transform: 'translateX(0) scale(1)' }], { duration: FXC.revealSlideMs, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      await p;
    });
    wrap('enemyAct', async (ev, orig) => {
      const p = orig(ev);
      const tile = $('intentTile'), at = ctr(tile);
      if (ev.anim === 'bite') {
        motion(tile, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(' + (-FXC.lungeUpPx) + 'px) scale(.9)', offset: .3 },
          { transform: 'translateY(' + FXC.lungeDownPx + 'px) scale(1.3)', offset: .55 }, { transform: 'translateY(0) scale(1)' }], { duration: T.lungeMs, easing: 'ease-in-out' });
        burst({ x: at.x, y: at.y + FXC.lungeDownPx }, C.colors.hostile, FXC.burstCounts.lunge);
      } else if (ev.anim === 'growl') {
        shake(tile, FXC.growlShakePx, T.enemyActMs * .8);
      } else if (ev.anim === 'sniff') {
        motion(tile, [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg) translateY(4px)', offset: .25 }, { transform: 'rotate(4deg)', offset: .5 },
          { transform: 'rotate(-5deg) translateY(4px)', offset: .75 }, { transform: 'rotate(0)' }], { duration: FXC.sniffMs, easing: 'linear' });
      } else if (ev.anim === 'whimper' || ev.anim === 'haggle') {
        motion(tile, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(8px) rotate(-8deg)' }, { transform: 'translateY(0) rotate(0)' }], { duration: FXC.whimperMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'snip') {          // scissors: the tile closes twice
        motion(tile, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.45)', offset: .2 }, { transform: 'scaleX(1.1)', offset: .4 },
          { transform: 'scaleX(.45)', offset: .6 }, { transform: 'scaleX(1)' }], { duration: T.lungeMs, easing: 'ease-in-out' });
        burst(at, C.colors.hostile, FXC.burstCounts.lunge);
      } else if (ev.anim === 'boast') {         // puffs up
        motion(tile, [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.3) rotate(-4deg)', offset: .45 }, { transform: 'scale(1.2) rotate(3deg)', offset: .75 },
          { transform: 'scale(1) rotate(0)' }], { duration: FXC.sniffMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'peck') {          // three quick pecks
        const d = FXC.lungeDownPx * .5;
        motion(tile, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + d + 'px)', offset: .15 }, { transform: 'translateY(0)', offset: .3 },
          { transform: 'translateY(' + d + 'px)', offset: .5 }, { transform: 'translateY(0)', offset: .65 }, { transform: 'translateY(' + d + 'px) scale(1.2)', offset: .85 },
          { transform: 'translateY(0)' }], { duration: T.lungeMs + 120, easing: 'linear' });
        burst({ x: at.x, y: at.y + d }, C.colors.hostile, FXC.burstCounts.lunge);
      } else if (ev.anim === 'caw') {
        motion(tile, [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-8deg) scale(1.2)', offset: .25 }, { transform: 'rotate(8deg) scale(1.2)', offset: .5 },
          { transform: 'rotate(-4deg) scale(1.1)', offset: .75 }, { transform: 'rotate(0) scale(1)' }], { duration: FXC.sniffMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'steal') {         // swoops down at your dice
        motion(tile, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(40px,-14px) scale(.9)', offset: .3 },
          { transform: 'translate(10px,' + FXC.lungeDownPx + 'px) scale(1.3)', offset: .6 }, { transform: 'translate(0,0) scale(1)' }], { duration: T.lungeMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'creak' || ev.anim === 'sway') {   // the planks groan
        motion(tile, [{ transform: 'rotate(0)' }, { transform: 'rotate(-4deg) translateX(-8px)', offset: .3 }, { transform: 'rotate(4deg) translateX(8px)', offset: .65 },
          { transform: 'rotate(0)' }], { duration: FXC.sniffMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'slip') {
        motion(tile, [{ transform: 'translateX(0) rotate(0)' }, { transform: 'translateX(-30px) rotate(-18deg)', offset: .4 }, { transform: 'translateX(0) rotate(0)' }],
          { duration: T.lungeMs, easing: 'ease-in' });
        burst(at, C.colors.hostile, FXC.burstCounts.lunge);
      } else if (ev.anim === 'drop') {          // sinks
        motion(tile, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + FXC.lungeDownPx + 'px) scale(.8)', offset: .5 }, { transform: 'translateY(0)' }],
          { duration: T.lungeMs + 100, easing: 'ease-in-out' });
      } else if (ev.anim === 'calm water') {
        motion(tile, [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)' }, { transform: 'translateY(0)' }], { duration: FXC.whimperMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'borrow') {        // reaches over for your things
        motion(tile, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(-30px,6px) scale(1.05) rotate(-6deg)', offset: .3 },
          { transform: 'translate(-12px,' + (FXC.lungeDownPx * .8) + 'px) scale(1.25)', offset: .6 }, { transform: 'translate(0,0) scale(1)' }], { duration: T.lungeMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'quote') {         // sucks in air through the teeth
        motion(tile, [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(.8) rotate(-5deg)', offset: .35 }, { transform: 'scale(1.25) rotate(4deg)', offset: .7 },
          { transform: 'scale(1) rotate(0)' }], { duration: FXC.sniffMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'sigh' || ev.anim === 'files' || ev.anim === 'bores') {
        motion(tile, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(6px) scale(.9)' }, { transform: 'translateY(0) scale(1)' }],
          { duration: FXC.whimperMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'taxes') {         // a rubber stamp thuds down
        motion(tile, [{ transform: 'translateY(-26px) scale(1.5)' }, { transform: 'translateY(0) scale(.9)', offset: .45 },
          { transform: 'translateY(0) scale(1.15)', offset: .6 }, { transform: 'translateY(0) scale(1)' }], { duration: T.lungeMs, easing: 'ease-in' });
        burst(at, C.colors.status, FXC.burstCounts.lunge);
      } else if (ev.anim === 'explains') {      // a droning lecture: slow side to side
        motion(tile, [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-5deg) scale(1.1)', offset: .25 }, { transform: 'rotate(5deg) scale(1.1)', offset: .5 },
          { transform: 'rotate(-3deg) scale(1.05)', offset: .75 }, { transform: 'rotate(0) scale(1)' }], { duration: T.lungeMs + 200, easing: 'ease-in-out' });
      } else if (ev.anim === 'anecdote') {      // winding up
        motion(tile, [{ transform: 'rotate(0)' }, { transform: 'rotate(10deg) translateY(-6px)', offset: .3 }, { transform: 'rotate(-10deg) translateY(-6px)', offset: .6 },
          { transform: 'rotate(0)' }], { duration: FXC.sniffMs, easing: 'ease-in-out' });
      } else if (ev.anim === 'circle') {
        motion(tile, [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(30px,-10px) rotate(120deg)', offset: .33 },
          { transform: 'translate(-10px,-18px) rotate(240deg)', offset: .66 }, { transform: 'translate(0,0) rotate(360deg)' }], { duration: FXC.whimperMs, easing: 'ease-in-out' });
      }
      await p;
    });
    // an item tile flies from your die to the enemy's bag / nest; then the die loses it
    wrap('itemTaken', async (ev, orig, run) => {
      const die = dom.dieEls[ev.dieId], bag = $('bag');
      const from = ctr(die), to = ctr(bag);
      const d = C.items[ev.item];
      fly(d ? d.name : ev.item, from, to, C.colors.item[ev.item] || '#b967ff', { ms: T.flyMs + 200, lift: -70 });
      burst(from, C.colors.item[ev.item] || '#b967ff', FXC.burstCounts.lunge);
      floatText(U.takenText(ev), from, C.colors.hostile, { small: false });
      await wait(reduced() ? FXC.reducedWaitMs : T.flyMs + 120);
      if (!same(run)) return;
      const p = orig(ev);
      motion(bag, [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: FXC.cardPulseMs * 2 });
      await p;
    });
    // the item tile breaks in two halves that fall apart
    wrap('itemDestroyed', async (ev, orig) => {
      const p = orig(ev);
      const el = dom.dieEls[ev.dieId], at = ctr(el), d = C.items[ev.item];
      const col = C.colors.item[ev.item] || '#b967ff';
      if (!reduced()) {
        [['inset(0 50% 0 0)', -1], ['inset(0 0 0 50%)', 1]].forEach(h => {
          const n = document.createElement('div');
          n.className = 'flyer';
          n.style.cssText = 'font-size:26px;padding:10px 14px;background:' + col + ';color:' + C.colors.tileText + ';border:3px solid #000;clip-path:' + h[0] + ';-webkit-text-stroke:0;text-shadow:none';
          n.textContent = d ? d.name : ev.item;
          addLive(n);
          const at0 = 'translate(' + at.x + 'px,' + at.y + 'px) translate(-50%,-50%)';
          const a = n.animate([
            { transform: at0, opacity: 1 },
            { transform: at0 + ' translate(' + (h[1] * 6) + 'px,-8px) rotate(' + (h[1] * 8) + 'deg)', opacity: 1, offset: .2 },
            { transform: at0 + ' translate(' + (h[1] * 46) + 'px,70px) rotate(' + (h[1] * 55) + 'deg)', opacity: 0 }], { duration: 640, easing: 'ease-in' });
          a.onfinish = a.oncancel = () => sweep(n);
        });
      }
      burst(at, col, FXC.burstCounts.scar);
      floatText((d ? d.name : ev.item) + (ev.cause === 'river' ? ' LOST' : ' DESTROYED'), { x: at.x, y: at.y - 60 }, C.colors.scarText, { small: false });
      await p;
    });
    wrap('mod', async (ev, orig) => {
      const p = orig(ev);
      const v = $('verbFlash');
      popAnim(v, 1.3, 260);
      floatText(ev.source.toUpperCase() + ' ' + (ev.mod < 0 ? '−' : '+') + Math.abs(ev.mod), ctr(v), verbColor(ev.verb), { small: false });
      await p;
    });
    wrap('taxed', async (ev, orig) => {
      const p = orig(ev);
      const v = $('verbFlash');
      popAnim(v, 1.3, 260);
      floatText(C.text.taxFloat.replace('{n}', ev.amount), ctr(v), C.colors.status, { small: false });
      burst(ctr(v), C.colors.status, FXC.burstCounts.pip);
      await p;
    });
    wrap('freeze', async (ev, orig) => {
      const el = dom.dieEls[ev.dieId], at = ctr(el);
      floatText(C.text.frozenFloat, { x: at.x, y: at.y - 40 }, '#8fe0ff', { small: false });
      burst(at, '#8fe0ff', FXC.burstCounts.scar);
      const p = orig(ev);
      motion(el, [{ transform: 'scale(1.18)' }, { transform: 'scale(.96)', offset: .5 }, { transform: 'scale(1)' }], { duration: FXC.scarPopMs });
      await p;
    });
    wrap('pendingSow', async (ev, orig) => {
      const p = orig(ev);
      if (ev.phase === 'applied') {
        fly('+' + ev.amount, ctr($('btnRoll')), ctr(dom.efc[targetCard()]), verbColor('SOW'));
      } else {
        floatText('+' + ev.amount + ' SOW NEXT TURN', ctr($('intentTile')), verbColor('SOW'), { small: false });
      }
      await p;
    });
    wrap('rerollBonus', async (ev, orig) => {
      const p = orig(ev);
      floatText('+' + ev.amount + ' REROLL', ctr($('btnReroll')), C.colors.lit, { small: false });
      await p;
    });
    wrap('scar', async (ev, orig, run) => {
      const el = dom.dieEls[ev.dieId], at = ctr(el);
      shake(el, FXC.scarShakePx, T.crackMs);
      let ov = null;
      if (ev.wasCurrent && !reduced()) {
        ov = document.createElement('div'); ov.className = 'crack';
        ov.innerHTML = '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="46,0 52,9 43,16 55,24 47,32 53,40" fill="none" stroke="' + C.colors.scarText + '" stroke-width="2.4" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>' +
          '<polyline points="52,9 63,12 68,20" fill="none" stroke="' + C.colors.scarText + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
        el.appendChild(ov); live.add(ov);
      }
      floatText(C.text.floatScar, { x: at.x, y: at.y - 40 }, C.colors.scarText, { small: false });
      await wait(reduced() ? FXC.reducedWaitMs : T.crackMs);
      if (!same(run)) return;
      if (ov) { live.delete(ov); ov.remove(); }
      const p = orig(ev);
      const row = el.querySelector('.faceRow');
      motion(row, [{ scale: String(FXC.scarPopScale) }, { scale: '.85', offset: .5 }, { scale: '1' }], { duration: FXC.scarPopMs, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      burst(at, C.colors.scarText, FXC.burstCounts.scar);
      const boxes = document.querySelectorAll('#scars .scarbox.on');
      if (boxes.length) motion(boxes[boxes.length - 1], [{ transform: 'scale(2.2)' }, { transform: 'scale(1)' }], { duration: FXC.scarBoxPulseMs });
      await p;
    });
    wrap('newIntent', async (ev, orig) => {
      const p = orig(ev);
      motion($('intentTile'), [{ transform: 'scale(.3) rotate(-10deg)' }, { transform: 'scale(1.15) rotate(2deg)', offset: .6 }, { transform: 'scale(1) rotate(0)' }], { duration: FXC.newIntentMs, easing: 'ease-out' });
      await p;
    });
    wrap('win', async (ev, orig) => {
      const p = orig(ev);
      burst(ctr($('intentTile')), C.colors.turned, FXC.burstCounts.win); burst(ctr($('faceStrip')), C.colors.lit, FXC.burstCounts.win);
      await p;
    });
    wrap('lose', async (ev, orig) => {
      const p = orig(ev);
      shake($('stage'), FXC.loseShakePx, FXC.loseShakeMs);
      await p;
    });
    wrap('sentence', async (ev, orig) => orig(ev));

    // ---- scavenge site events ----
    const breakTile = (at, name, col, size) => {
      if (reduced()) return;
      [['inset(0 50% 0 0)', -1], ['inset(0 0 0 50%)', 1]].forEach(h => {
        const n = document.createElement('div');
        n.className = 'flyer';
        n.style.cssText = 'font-size:' + size + 'px;padding:8px 10px;background:' + col + ';color:' + C.colors.tileText + ';border:3px solid #000;clip-path:' + h[0] + ';-webkit-text-stroke:0;text-shadow:none';
        n.textContent = name;
        addLive(n);
        const at0 = 'translate(' + at.x + 'px,' + at.y + 'px) translate(-50%,-50%)';
        const a = n.animate([{ transform: at0, opacity: 1 },
          { transform: at0 + ' translate(' + (h[1] * 6) + 'px,-8px) rotate(' + (h[1] * 8) + 'deg)', opacity: 1, offset: .2 },
          { transform: at0 + ' translate(' + (h[1] * 46) + 'px,70px) rotate(' + (h[1] * 55) + 'deg)', opacity: 0 }], { duration: 640, easing: 'ease-in' });
        a.onfinish = a.oncancel = () => sweep(n);
      });
    };
    wrap('siteReveal', async (ev, orig) => {
      const p = orig(ev);
      const card = dom.efc[ev.faceIdx], at = ctr(card);
      motion(card.querySelector('.tile'), [{ transform: 'rotateY(90deg) scale(1.25)' }, { transform: 'rotateY(0) scale(1)' }], { duration: T.flourishMs });
      floatText(C.text.floatReveal, at, verbColor('DIG'), { small: false });
      burst(at, verbColor('DIG'), FXC.burstCounts.pip);
      await p;
    });
    wrap('sitePip', async (ev, orig) => {
      const p = orig(ev);
      const card = dom.efc[ev.faceIdx], pip = card.querySelectorAll('.pip')[ev.pipIdx];
      if (pip) {
        const at = ctr(pip);
        if (ev.verb === 'PRUNE') {
          motion(pip, [{ transform: 'scale(2) rotate(0)' }, { transform: 'scale(.5) rotate(120deg)', offset: .6 }, { transform: 'rotate(45deg) scale(.7)' }], { duration: T.pipMs });
          burst(at, C.colors.pipIntact, FXC.burstCounts.pip);
        } else {
          motion(pip, [{ transform: 'rotateY(0) scale(1.9)' }, { transform: 'rotateY(180deg) scale(1.3)', offset: .5 }, { transform: 'rotateY(360deg) scale(1)' }], { duration: T.pipMs });
          burst(at, C.colors.turned, FXC.burstCounts.pip);
        }
      }
      shake(card, FXC.shakePx);
      await p;
    });
    wrap('noise', async (ev, orig) => {
      const p = orig(ev);
      const nb = $('noiseTrack').querySelectorAll('.nb')[ev.total - 1];
      if (nb) motion(nb, [{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 220 });
      if (ev.cause === 'RATS') floatText('+' + ev.amount + ' NOISE', ctr($('noiseTrack')), C.colors.status, { small: false });
      await p;
    });
    wrap('siteOpen', async (ev, orig) => {
      const p = orig(ev);
      const card = dom.efc[ev.faceIdx], at = ctr(card), SC = C.colors.site;
      popAnim(card, 1.18, T.flourishMs);
      if (ev.overkill) {
        const d = C.items[ev.brokenItem];
        breakTile(at, d ? d.name : ev.brokenItem, C.colors.item[ev.brokenItem] || SC.ITEM, 14);
        burst(at, SC.JUNK, FXC.burstCounts.scar);
        floatText('BROKE INTO JUNK', { x: at.x, y: at.y - 50 }, SC.RATS, { small: false });
      } else if (ev.content === 'ITEM') {
        const d = C.items[ev.item], col = C.colors.item[ev.item] || SC.ITEM;
        burst(at, col, FXC.burstCounts.win);
        floatText(d ? d.name : ev.item, { x: at.x, y: at.y - 50 }, col, { small: false });
        fly(d ? d.name : ev.item, at, ctr($('invCount')), col, { small: true, ms: T.flyMs + 260, lift: -80 });
      } else if (ev.content === 'RATS' || ev.content === 'TRAP') {
        shake(card, FXC.scarShakePx, T.crackMs + 200);
        burst(at, SC[ev.content], FXC.burstCounts.scar);
        floatText(ev.content + '!', { x: at.x, y: at.y - 50 }, SC[ev.content], { small: false });
      } else {
        floatText(ev.content, { x: at.x, y: at.y - 50 }, C.colors.textDim, { small: false });
      }
      await p;
    });
    wrap('guardian', async (ev, orig) => {
      const p = orig(ev);
      shake($('noiseTrack'), FXC.shakePx + 3, 500);
      shake($('stage'), FXC.loseShakePx, FXC.loseShakeMs);
      floatText(ev.name, ctr($('noiseTrack')), C.colors.verb.PRUNE, { small: false });
      await p;
    });
  }

  // ---------- init ----------
  function init() {
    U = window.SmugUI; dom = U.dom;
    const H = U.hooks;
    H.onRoll = (ids) => startShuffle(ids);
    H.onHold = onHold;
    H.onFrozenClick = (id) => { const el = dom.dieEls[id]; shake(el, FXC.growlShakePx + 2, 260); floatText(C.text.frozenFloat, ctr(el), '#8fe0ff', { small: false }); };
    H.onRestart = reset;
    H.onDragStart = onDragStart; H.onDragMove = onDragMove; H.onDragEnd = onDragEnd;
    H.snapshot = snapshot; H.play = play;
    // reward pick: the chosen card pops (screens animate in with the CSS .pop-in entrance)
    H.onPick = (el) => { if (el) popAnim(el, 1.12, 320); };
    // campfire heal: the healed face flashes green
    H.onHeal = () => {
      const at = { x: 640, y: 360 };
      floatText('HEALED', at, C.colors.turned, { small: false });
      burst(at, C.colors.turned, FXC.burstCounts.win);
    };

    // ---- placement screen (all reactions to the player's drag / click) ----
    const faceAt = (dieId, idx) => document.querySelector('#screen .nf[data-die="' + dieId + '"][data-idx="' + idx + '"]');
    H.onDragItem = (g) => { motion(g, [{ scale: '.8' }, { scale: '1.12' }], { duration: 120, fill: 'forwards' }); };
    // invalid drop target: a short shake
    H.onReject = (el) => {
      if (!el) return;
      el.classList.remove('rej'); void el.offsetWidth; el.classList.add('rej');
      setTimeout(() => el.classList.remove('rej'), 340);
    };
    // the ghost returns to where the item came from, with overshoot
    H.onItemReturn = (ghost, from, done) => {
      if (!ghost) { done(); return; }
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(ghost.style.transform || '');
      const cur = m ? { x: +m[1], y: +m[2] } : from;
      const fin = () => { if (ghost.parentNode) ghost.remove(); done(); };
      if (reduced()) { fin(); return; }
      const a = ghost.animate([{ transform: 'translate(' + cur.x + 'px,' + cur.y + 'px) rotate(0)' },
        { transform: 'translate(' + from.x + 'px,' + from.y + 'px) rotate(0)' }], { duration: T.returnMs, easing: 'cubic-bezier(.3,1.7,.5,1)', fill: 'forwards' });
      a.onfinish = fin; a.oncancel = fin;
    };
    // an item landed: the face squashes, the net does a small punch scale, sparks; a replaced item breaks apart
    H.onPlace = (dieId, idx, item, replaced) => {
      const nf = faceAt(dieId, idx);
      if (!nf) return;
      const col = C.colors.item[item] || '#b967ff', at = ctr(nf);
      const net = nf.parentNode, tile = nf.querySelector('.it .tile');
      motion(net, [{ transform: 'scale(1)' }, { transform: 'scale(' + FXC.netPunchScale + ')', offset: .35 }, { transform: 'scale(1)' }],
        { duration: T.netPunchMs, easing: 'ease-out' });
      motion(tile || nf, FXC.squash.map((q, i, arr) => ({ transform: 'scale(' + q[0] + ',' + q[1] + ')', offset: (i + 1) / (arr.length + 1) }))
        .concat([{ transform: 'scale(1,1)' }]), { duration: T.squashMs + 120, delay: 200 });
      setTimeout(() => burst(at, col, FXC.particles), 260);
      if (replaced) {
        const d = C.items[replaced], rc = C.colors.item[replaced] || '#b967ff';
        floatText((d ? d.name : replaced) + ' DISCARDED', { x: at.x, y: at.y - 46 }, C.colors.scarText, { small: false });
        if (!reduced()) [['inset(0 50% 0 0)', -1], ['inset(0 0 0 50%)', 1]].forEach(h => {
          const n = document.createElement('div');
          n.className = 'flyer';
          n.style.cssText = 'font-size:16px;padding:6px 9px;background:' + rc + ';color:' + C.colors.tileText + ';border:3px solid #000;clip-path:' + h[0] + ';-webkit-text-stroke:0;text-shadow:none';
          n.textContent = d ? d.name : replaced;
          addLive(n);
          const at0 = 'translate(' + at.x + 'px,' + at.y + 'px) translate(-50%,-50%)';
          const a = n.animate([{ transform: at0, opacity: 1 },
            { transform: at0 + ' translate(' + (h[1] * 5) + 'px,-6px) rotate(' + (h[1] * 8) + 'deg)', opacity: 1, offset: .2 },
            { transform: at0 + ' translate(' + (h[1] * 40) + 'px,60px) rotate(' + (h[1] * 55) + 'deg)', opacity: 0 }], { duration: 600, easing: 'ease-in' });
          a.onfinish = a.oncancel = () => sweep(n);
        });
      }
    };
    H.onUnplace = (item) => {
      const tr = $('invTray');
      if (tr) motion(tr, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: .4 }, { transform: 'scale(1)' }], { duration: 220 });
    };
    // site: clicking a face to aim at it
    H.onTarget = (el, on) => { popAnim(el, on ? 1.12 : 1.04, 160); };
    // map: kept functional (instant update, no effects); the cold is shown by the message line and the scar tiles
    H.onMapMove = () => {};
    installHandlers();

    // sentence completes: all three tiles pulse together (glow itself is CSS on #slots.complete)
    let wasComplete = false;
    new MutationObserver(() => {
      const c = $('slots').classList.contains('complete');
      if (c && !wasComplete && U.ui.phase === 'arranging') {
        U.ui.slots.forEach(id => { if (id) popAnim(dom.dieEls[id], FXC.litPopScale, FXC.litPopMs); });
      }
      wasComplete = c;
    }).observe($('slots'), { attributes: true, attributeFilter: ['class'] });

    window.SmugFX = { reset, burst, fly, floatText, reduced };
  }
  document.addEventListener('DOMContentLoaded', init);
})();
