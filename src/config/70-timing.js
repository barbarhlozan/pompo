// CONFIG: Timing, fx, ui and debug tuning.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  timing: {
    // Commit / enemy playback is ~1.6x the v2-3 speed (playtest: too fast to follow); drag, snap, roll and hold stay snappy.
    rollShuffleMs: 600, resolveStepMs: 544, enemyActMs: 1500,        // enemy action line stays up this long (>= ~1.5 s to read it) before the next event / turn
    preEnemyMs: 500,        // beat between the end of your sentence and the enemy acting
    railStepMs: 450,        // one rail step (caption pops, playhead moves) during COMMIT
    railPlayheadMs: 256,    // playhead slide between steps
    // Phase 3 (ms)
    shuffleStepMs: 55,      // one shuffle frame (also the roll-tick rate)
    settleStaggerMs: 110,   // extra shuffle time per die so they settle one after another
    settleMs: 260,          // bounce when a rolled die settles
    snapMs: 130,            // slide into a slot
    squashMs: 240,          // squash-and-stretch after landing
    returnMs: 260,          // invalid drop animating back (with overshoot)
    popMs: 385,             // a sentence tile popping during COMMIT
    flyMs: 610,             // floating number flight (to enemy / along the arrow)
    shakeMs: 480,           // enemy hit shake
    pipMs: 512,             // pip crack / flip
    flourishMs: 670,        // face-resolve flourish
    crackMs: 385,           // BITE crack before the face becomes SCAR
    lungeMs: 610,           // dog lunge on BITE
    netPunchMs: 220,        // placement: die net punch-scale when an item lands
  },
  fx: {
    shakePx: 7, tiltMaxDeg: 0, particles: 8,
    netPunchScale: 1.06,            // placement: die net punch-scale when an item lands
    tiltPerPx: 1.4,                 // drag tilt degrees per px of horizontal pointer movement
    liftScale: 1.07,                // a dragged die's scale
    squash: [[1.16, .8], [.93, 1.1], [1.03, .98]],   // [scaleX, scaleY] frames after a die lands in a slot
    popScale: 1.28,                 // a die popping during COMMIT
    litPopScale: 1.08, litPopMs: 260,   // the three dice popping when the sentence completes
    settleScale: 1.35,              // roll: die bounce when it settles
    holdBadgeMs: 200, holdTileMs: 180,
    floatMs: 1120, floatMinY: 121, floatRisePx: 60,   // floating BROKEN / TURNED / SCAR! text (floatMinY keeps it below the top bar)
    flyLiftPx: -50, flyLiftDigPx: -34,               // arc height of the +N numbers
    burstDistMin: 26, burstDistRange: 40, burstMs: 610, burstMsRange: 256,
    burstCounts: { pip: 6, resolvedExtra: 4, lunge: 8, scar: 10, win: 14 },   // sparks (resolvedExtra is added to `particles`)
    cardPulseScale: 1.1, cardPulseMs: 256,          // enemy face card when a +N arrives
    arrowSwellScale: 1.5,                           // carry arrow label swelling as DIG points are passed on
    railPopScale: 1.14,                             // a rail caption popping as its step scores
    revealSlideMs: 385,
    lungeUpPx: 16, lungeDownPx: 46, growlShakePx: 4, sniffMs: 830, whimperMs: 960,
    scarShakePx: 9, scarPopScale: 1.6, scarPopMs: 480, scarBoxPulseMs: 512,
    newIntentMs: 480, loseShakePx: 6, loseShakeMs: 800,
    reducedWaitMs: 80,              // pause used in place of animations under prefers-reduced-motion
  },
  ui: {
    dragThresholdPx: 5,             // moving less than this = a click (toggle hold), not a drag
    dropSlackPx: 12,                // how far outside a slot a drop still counts
    trayTiltDeg: 0,                 // max static tilt of a die lying in the tray (new per roll)
  },
  debug: { logRows: 10, pollMs: 120 },
});
