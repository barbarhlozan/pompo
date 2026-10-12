// CONFIG: Verb info, special notes, odds templates, all player-facing text.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  verbInfo: {
    PRUNE: 'Force. Breaks pips. Beat them.',
    SOW: 'Persuade. Turns pips. Befriend them.',
    DIG: 'Search. Reveals what is coming and passes its points to the next die.',
  },
  // Item special annotations shown in the preview (placeholders: {n}).
  notes: {
    knife: 'knife +{n}', lantern: 'lantern', whistle: 'whistle ×{n}', shears: 'shears split', wateringCanNow: 'watering can +{n}',
    wateringCan: '+{n} SOW next turn', glasses: 'glasses: sees {n}', nose: 'nose: sees {n}', spade: 'reveals all',
    matches: 'matches +{n}', forbiddenBook: 'forbidden book +{n}', earTrumpet: '+{n} ear trumpet', taxed: 'taxed −{n}',
  },
  // Odds summary under a die in placement ({part} {items} {bare} {scar} {k} {n} ...).
  odds: {
    single: '{part} · {items}{bare}× bare · {scar}× scar → item {k}/{n}',     // one-part dice; {items} = "1× KNIFE · " pieces
    multiPart: '{parts} · scar {scar}/{n}',                                    // multi-part dice (HEAD, TORSO)
    partPiece: '{part} {count} ({items})',                                     // "EYE 3 (1× GLASSES)"
    noItems: '0 items',
  },
  text: {
    // the sentence rail (src/ui/10-render.js renderSlots): title, step labels by slot count, per-step tags / captions
    rail: {
      title: 'WHAT YOU DO', empty: 'drop a die', totalsPrefix: '=', totalsPending: '…',
      steps: { 1: ['ONLY'], 2: ['FIRST', 'THEN'], 3: ['FIRST', 'THEN', 'LAST'] },   // more slots than listed: FIRST, THEN, THEN…
      mind: 'MIND: sets {verb}', mindIdle: 'MIND: sets {verb}, nothing to act', mindHold: 'MIND: keep one die',
      mindTip: 'The MIND sets the verb for every die after it.',
      instinct: 'instinct', noInstinct: 'no instinct',
      instinctTip: 'Acts on instinct (before the MIND, or no MIND): its favourite verb {verb}.',
      noInstinctTip: 'No instinct: this part does nothing on its own.',
      directedTip: 'Acts with the MIND\'s verb {verb}.',
      carryTip: 'DIG passes its points on to the next die.',
    },
    help: 'ROLL, hold & reroll, drag dice into the sentence slots, COMMIT. The MIND die (optional) sets the verb for dice after it; dice before it, or with no MIND, act on instinct.',
    reveal: '(reveal)', noEffect: 'nothing happens', scar: 'SCAR', idleText: 'nothing happens', holdText: 'hold one die for the next turn',
    belly: 'your belly was exposed', lostDie: 'your {die} gave out',   // `scar` is also the face key of a scarred face
    beaten: 'BEATEN', befriended: 'BEFRIENDED', lost: 'YOU FLEE, SCARRED', tripComplete: 'TRIP COMPLETE',
    // --- UI labels / messages ({n} is replaced by a number) ---
    buttons: { roll: 'ROLL', reroll: 'REROLL ({n} left)', commit: 'COMMIT', restart: 'RESTART TRIP', continue: 'CONTINUE' },
    title: 'SMUGGLER', turn: 'TURN', scarsLabel: 'SCARS', intentLabel: 'INTENT', now: 'NOW', next: 'NEXT', nextPrefix: 'next:',
    held: 'HELD', unknownFace: '?', then: 'THEN',
    placeHint: 'Fill all {slots} slots to see what the sentence does ({n}/{slots})',
    holdPick: 'HOLD: click one body die to keep its face for the next turn', heldStatus: '{die} held over',
    lastTurn: 'Last:', lastAction: 'last turn:', pressRoll: 'Press ROLL to start',
    growlStatus: '−1 reroll this turn ({n} total)', bonusStatus: '+{n} reroll (seeds)', sowStatus: '+{n} SOW at turn start (watering can)',
    noRerolls: 'no rerolls left', itemsLabel: 'ITEMS', noMods: 'no mods', bagLabel: { PLUMBER: 'TOOLBOX', CROWS: 'NEST' },
    destroyed: '{item} DESTROYED', lostRiver: '{item} LOST IN THE RIVER', took: '{item} TAKEN', tookBy: { BORROW: '{item} BORROWED' }, itemWord: 'item',
    taxFlash: '{verb} {after} (taxed −{n})', taxFloat: 'TAXED −{n}', frozenFloat: 'FROZEN', introStrip: 'start', modFlash: '{verb} {after} ({source} {mod})',
    // trip screens
    s: {
      rewardChoose: 'CHOOSE ONE', rewardGive: 'YOU GET', rewardReturned: 'RETURNED TO YOU', rewardLost: 'GONE FOR GOOD', take: 'TAKE',
      placeTitle: 'PLACE ITEMS', placeReward: 'Place your new items. Items already on your dice are locked (drop on one to replace it).',
      placeCampfire: 'Campfire: move any item to another face, or drag it back to the inventory.',
      placeIntro: 'Pack your things onto your dice.',
      unknownFight: 'An unknown event is waiting.', leave: 'LEAVE', frozen: 'FROZEN', frozenTip: 'Frozen: cannot be held or rerolled this turn (it still rolls once).',
      taxedStatus: 'taxed: every verb −{n} this turn',
      yourDiceFrozen: '{die} frozen: no hold / reroll',
      placeInvHint: 'drag an item onto a face (or click it, then click a face)', placeInvFull: 'Unplaced items stay in the inventory for later.',
      slotEmpty: 'ITEM', lockedTip: 'Locked: placed earlier. Only the campfire can move it.', newTag: 'NEW', healTip: 'Heal this scar',
      replaceTitle: 'REPLACE?', replaceDiscard: 'DISCARD {item}', replaceBecomes: 'to place', replaceYes: 'YES, DISCARD', replaceNo: 'CANCEL',
      scarTip: 'SCAR: 0 points under any verb. The item that was here is gone.', faceN: 'face {n}', trayDrop: 'drop here to take it off the die',
      inventory: 'INVENTORY', inventoryEmpty: '(empty)', placeBtn: 'PLACE', noFace: 'NO FREE FACE', toInv: '→ INVENTORY', undo: 'UNDO', locked: 'locked',
      done: 'DONE', placed: 'ON YOUR DICE',
      campfireTitle: 'CAMPFIRE', campfireSub: 'Choose one.', healTitle: 'HEAL 1 SCAR', healDesc: 'A scarred face returns as a bare body part. Its item is not restored.',
      healNone: 'No scars to heal.', rearrangeTitle: 'REARRANGE', rearrangeDesc: 'Move any placed item to another valid face, or back to the inventory.',
      healPick: 'Click a scarred face to heal it.', back: 'BACK',
      endWon: 'TRIP COMPLETE', endLost: 'YOU FLEE, SCARRED', results: 'ENCOUNTERS', finalDice: 'FINAL DICE', logLabel: 'TURN LOG',
      fled: 'FLED at turn {n}', turns: '{n} turns', scarsFinal: 'SCARS {n}/{max}', leftover: 'IN INVENTORY',
    },
    site: {                                    // preview / status strings for scavenge sites ({n} {noise} {pips})
      force: 'force {n} (+{noise} noise)', forceQuiet: 'force {n} (no noise)', coax: 'coax {n} pips', search: 'search: reveals {n}',
      searchAll: 'search: reveals all', nothing: 'nothing happens', left: 'LEFT', guardian: 'GUARDIAN', noise: 'NOISE',
    },
    // V1-5: start screen, map and site screen strings ({n} {c} {max} {item} {name})
    m2: {
      startSub: 'Choose a trip', changeMode: 'MODE SELECT',
      startM1: 'M1 SEQUENCE', startM1Desc: 'Five events and a campfire, one after another. No map.',
      startM2: 'M2 MAP', startM2Desc: 'Walk a foggy map to the gate. Daylight runs out; scavenge sites make noise.',
      daylight: 'DAYLIGHT', scars: 'SCARS', items: 'ITEMS', you: 'YOU', map: 'MAP', moves: 'MOVES {n}', dayShort: '☀ {n}', coldShort: 'THE COLD',
      mapHint: 'Click a highlighted tile to walk there. Each step costs 1 daylight; in the dark every step scars you.',
      coldHint: 'No daylight left: every step scars you (THE COLD).',
      moveTip: 'Walk here (−1 daylight)', moveTipCold: 'Walk here: the cold scars you', fogTip: 'Unknown. You see tiles next to where you have walked.',
      visitedTip: 'visited', seenTip: 'revealed by the dog', hereTip: 'You are here',
      typeLabel: { CHARACTER: 'FIGHT', SCAVENGE: 'SITE', CAMPFIRE: 'REST', EMPTY: '', START: '', GATE: 'EXIT' },
      coldMsg: 'THE COLD bites.', coldDestroyed: '{item} destroyed by the cold.', revealedMsg: '{n} fogged tiles are now visible.',
      siteLabel: 'SCAVENGE SITE', guardian: 'guardian', rulesLine: 'each turn +1 noise · PRUNE +1 per point · full = guardian',
      noise: 'NOISE', found: 'FOUND', target: 'TARGET', first: 'FIRST',
      targetTip: 'Click to aim your points at this face first (click again to clear).', hiddenTip: 'Hidden: DIG reveals it, PRUNE / SOW open it.',
      seen: 'SEEN', got: 'TAKEN', brokeInto: '{item} → JUNK', nothingLeft: 'Nothing left here. LEAVE when you are ready.',
      leaveTip: 'Walk away, keeping what you opened.',
      guardianArrives: '{name} ARRIVES', guardianSub: 'The noise brought it. A fight!', fight: 'FIGHT',
      openedText: { ITEM: '{item}!', JUNK: 'junk', NOTHING: 'nothing', RATS: 'rats! +2 noise', TRAP: 'a trap!' },
      endDaylight: 'DAYLIGHT LEFT {n}/{max}', endMoves: '{n} moves · {c} cold hits', endGate: 'You reached the gate.',
      revealsTiles: 'also reveals {n} fogged map tiles',
    },
    revealSeen: 'you see what it will do next', revealChanged: 'its next move changes…',
    lostSub: 'Too many scars. You cannot go on.', lostDieSub: 'Every face of your {die} is scarred. You cannot go on.',
    floatBroken: 'BROKEN', floatTurned: 'TURNED', floatReveal: 'REVEAL', floatScar: 'SCAR!',
  },
});
