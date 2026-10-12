// CONFIG: Verb info, special notes, odds templates, all player-facing text.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  verbInfo: {
    PRUNE: 'Force. Breaks pips (points of their resolve). Beat them.',
    SOW: 'Persuade. Turns pips (points of their resolve). Befriend them.',
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
    // plain-language narration under the rail (src/ui/10-render.js narrateSentence / narrateResult). {them} = the enemy's shortName
    // (or the site's shortName); from the second mention it is the pronoun N.pron / enemy.pron. A step's phrase = actions[action name] (items and bare parts share the name space), else the lower-cased action name.
    narration: {
      you: 'You {steps}.', youPartial: 'You {steps}, then …', joinThen: ', then ', joinLast: ', and finally ', youIdle: 'You do nothing much.', pron: { them: 'it', its: 'its' }, idle: 'stand around', scar: 'flail with a scarred limb',
      mind: ' (MIND: {verb})',
      actions: {
        Hit: 'punch {them}', Gesture: 'gesture at {them}', Search: 'pat down {them}',
        Swing: 'swing an arm at {them}', Wave: 'wave at {them}', Reach: 'reach out to {them}',
        Insult: 'insult {them}', 'Small talk': 'make small talk with {them}', Ask: 'ask {them} a question',
        Glare: 'glare at {them}', 'Kind look': 'give {them} a kind look', Look: 'look {them} over',
        'Tune out': 'tune {them} out', 'Hear out': 'hear {them} out', Listen: 'listen to {them}',
        Snort: 'snort at {them}', 'Sniff kindly': 'sniff kindly at {them}', 'Sniff out': 'sniff {them} out',
        Shove: 'shove {them} with your back', Lean: 'lean against {them}', Hunch: 'hunch your back at {them}', Brace: 'brace yourself',
        Bump: 'bump {them} with your belly', Laugh: 'laugh at {them}', Rumble: 'rumble at {them}', Clench: 'clench your belly',
        Stab: 'stab at {them} with your knife', Threaten: 'threaten {them} with your knife', Pry: 'pry at {them} with your knife',
        Snip: 'snip at {them} with your shears', 'Offer to trim': 'offer {them} a trim', 'Cut open': 'cut {them} open',
        Whack: 'whack {them} with your spade', 'Lean and chat': 'lean on your spade and chat with {them}', Dig: 'dig around {them}',
        Splash: 'splash {them}', 'Water their plant': 'water {them}\'s plant', 'Flood out': 'flood {them} out',
        'Light up': 'light {them} up', 'Offer a light': 'offer {them} a light', Shine: 'shine a light on {them}',
        Smack: 'smack {them} with the forbidden book', Quote: 'quote the forbidden book at {them}', 'Look up': 'look {them} up in the forbidden book',
        Glint: 'glint at {them} through your glasses', 'Look learned': 'look learned at {them}', 'Read the fine print': 'read the fine print',
        Dazzle: 'dazzle {them}', 'Warm light': 'cast a warm light on {them}',
        'Listen closely': 'listen closely to {them}', Eavesdrop: 'eavesdrop on {them}',
        Shriek: 'shriek at {them}', 'Call softly': 'call softly to {them}', Echo: 'echo {them}',
        'Blow smoke': 'blow smoke at {them}', 'Calm chat': 'chat calmly with {them}', Ponder: 'ponder {them} over your pipe',
        Shout: 'shout at {them}', Coax: 'coax {them}', 'Call out': 'call out to {them}', 'Lend an ear': 'lend {them} an ear',
        'Soft look': 'give {them} a soft look', 'Sniff gently': 'sniff gently at {them}', Chuckle: 'chuckle at {them}',
        Poke: 'poke at {them} with your knife', 'Show shears': 'show {them} your shears', 'Snip around': 'snip around {them}',
        'Lean on spade': 'lean on your spade near {them}', Sprinkle: 'sprinkle {them}', 'Pour out': 'pour water over {them}',
        'Strike one': 'strike a match near {them}', 'Read aloud': 'read aloud from the forbidden book', 'Offer a trim': 'offer {them} a trim',
        'Peer kindly': 'peer kindly at {them}', Squint: 'squint at {them}', Inspect: 'inspect {them} closely',
        'Shed light': 'shed some light on {them}', 'Listen in': 'listen in on {them}', 'Puff calmly': 'puff calmly on your pipe',
      },
      // phrase overrides for one encounter tag (same name, different wording): [tag][action name]; lookup tag -> actions
      actionsByTag: { site: { Search: 'rummage through {them}', Look: 'look over {them}' }, place: { Search: 'feel along {them}' } },
      // after resolution: what it did to them (one clause per face touched; {face} = its action name, {n} pips)
      faceBroken: '{its} {face} breaks.', faceTurned: '{its} {face} turns friendly.',
      facePartBroken: '{n} of {its} {face} pips break.', facePartTurned: '{n} of {its} {face} pips turn.',   // {its} is capitalised at a sentence start
      // appended to the sentence when it reveals something ({its} = pronoun, {n})
      reveal: { intent: 'You see {its} next move.', intents: 'You see {its} next {n} moves.', faces: 'You peek into {n} spots.', facesAll: 'You peek into every spot.' },
      siteOpened: 'You open {what}.', nothing: 'It barely notices.',
    },
    // the sentence rail (src/ui/10-render.js renderSlots): title, step labels by slot count, per-step tags / captions
    rail: {
      title: 'WHAT YOU DO', empty: 'drop a die', totalsPrefix: '=', totalsPending: '…', totalsSoFar: 'so far', shapePending: '…',
      steps: { 1: ['ONLY'], 2: ['FIRST', 'THEN'], 3: ['FIRST', 'THEN', 'LAST'] },   // more slots than listed: FIRST, THEN, THEN…
      mindSets: 'SETS {verb}', mindHoldAction: 'HOLD', mindIdle: 'nothing to act', mindHold: 'keeps one die for next turn',
      scarRed: 'SCARRED', scarTip: 'SCAR: 0 points, does nothing.',
      mindTip: 'The MIND sets the verb for every die after it.',
      instinct: 'instinct', noInstinct: 'no instinct',
      instinctTip: 'Acts on instinct (before the MIND, or no MIND): its favourite verb {verb}.',
      noInstinctTip: 'No instinct: this part does nothing on its own.',
      directedTip: 'Acts with the MIND\'s verb {verb}.',
      carryTip: 'DIG passes its points on to the next die.',
    },
    // in-game dictionary (src/ui/65-dictionary.js): `kind` picks the tile colour: verb (verb colour, `term` is the verb) | body (body-part
    // colour, `term` is the part) | item (item colour) | term (neutral gold); optional `key` = colour lookup instead of `term`. `big: true` = the headline entries.
    dictionaryUi: { button: 'DICTIONARY', buttonTip: 'What the words mean (?)', title: 'DICTIONARY', close: 'CLOSE', hint: 'Esc or ? closes' },
    dictionary: [
      { term: 'PRUNE', kind: 'verb', big: true, text: 'Violence and force. You hurt, break, cut. It breaks pips (red), and a creature with every pip broken is BEATEN.' },
      { term: 'SOW', kind: 'verb', big: true, text: 'Persuasion and kindness. You talk, charm, offer. It turns pips (green), and a creature with every pip turned is BEFRIENDED.' },
      { term: 'DIG', kind: 'verb', big: true, text: 'Curiosity and searching. You look, listen, pry. It reveals what is coming and passes its points on to the next die.' },
      { term: 'MIND', kind: 'term', text: 'Your verb die (PRUNE, SOW, DIG). The dice placed after it use its verb; at most one MIND face per sentence.' },
      { term: 'INSTINCT', kind: 'body', key: 'EYE', text: 'A body die placed before the MIND (or with no MIND) acts on its own favourite verb. Some parts have none and do nothing.' },
      { term: 'PLAN · SITUATION · IMPULSE · REFLEX', kind: 'term', text: 'The sentence\'s label: MIND first = PLAN, in the middle = SITUATION, last = IMPULSE, no MIND at all = REFLEX.' },
      { term: 'SLOTS', kind: 'term', text: 'The sentence: drag dice into every slot, left to right, then COMMIT. Each die acts in turn, and the order matters.' },
      { term: 'PIPS', kind: 'term', key: 'EAR', text: 'The □ on an enemy face: one point of its resolve each. Points remove pips; a face with none left is out of the fight.' },
      { term: 'NOW · NEXT', kind: 'term', text: 'NOW is what it does this turn; NEXT is what it does after. DIG can show you NEXT before it happens.' },
      { term: 'HOSTILE · HARMLESS', kind: 'term', text: 'Hostile faces hurt you and must be cleared to win. Harmless faces do nothing and are ignored.' },
      { term: 'BEATEN · BEFRIENDED', kind: 'term', text: 'The two ways to win: mostly broken pips (BEATEN) or mostly turned pips (BEFRIENDED). Both end the fight.' },
      { term: 'ITEMS', kind: 'item', key: 'KNIFE', text: 'Placed on a body face: it adds a point and changes the action. Items already on a die stay until a campfire.' },
      { term: 'SCARS', kind: 'term', key: 'SCAR', text: 'A scarred face scores 0 and its item is gone. Too many scars and you flee the trip. A campfire can heal one.' },
      { term: 'REROLL · HOLD', kind: 'term', text: 'Click a die to HOLD it, then REROLL the rest. You get a few rerolls per turn; freezing and growls can take them.' },
      { term: 'NOISE', kind: 'term', key: 'RATS', text: 'At scavenge sites each turn and each PRUNE point adds noise. When it is full a guardian arrives for a fight.' },
    ],
    help: 'ROLL, hold & reroll, drag dice into the slots, COMMIT. The MIND die sets the verb for dice after it; earlier dice act on instinct.',
    // reveal part of the totals ('= PRUNE 6 · REVEAL next intent'): fights reveal intents, sites reveal faces
    revealTotals: { intent: 'REVEAL next intent', intents: 'REVEAL next {n} intents', faces: 'REVEAL {n} faces', facesAll: 'REVEAL all faces' },
    reveal: '(reveal)', noEffect: 'nothing happens', scar: 'SCAR', idleText: 'nothing happens', holdText: 'hold one die for the next turn',
    belly: 'your belly was exposed', lostDie: 'your {die} gave out',   // `scar` is also the face key of a scarred face
    beaten: 'BEATEN', befriended: 'BEFRIENDED', lost: 'YOU FLEE, SCARRED', tripComplete: 'TRIP COMPLETE',
    // enemy die strip: header, per-face explanation (by effect; an enemy may override per face name with `info: { NAME: '…' }`), ghost hit preview
    strip: {
      head: 'ITS DIE', goal: 'clear every pip on its hostile faces to win', legend: '□ pip = 1 point of its resolve · PRUNE breaks, SOW turns · NOW = acts this turn',
      pipTip: 'Pips: each □ is one point of this face\'s resolve. PRUNE breaks a pip (red), SOW turns it (green). When all its pips are gone the face is BROKEN or TURNED, whichever is the majority.',
      sitePipTip: 'Pips: each □ is one layer of cover over what this face hides. Points remove pips; when all are gone the face opens.',
      harmless: 'harmless', hostileNone: 'no effect, but it still counts', broken: 'BROKEN', turned: 'TURNED', wouldBreak: 'WOULD BREAK', wouldTurn: 'WOULD TURN',
      win: 'THIS WINS THE FIGHT', winBeaten: 'WIN · beaten', winBefriended: 'WIN · befriended', provisional: '(so far)',
      effects: { scar: 'scars one of your faces', rerollPenalty: '1 fewer reroll', takeItem: 'takes an item', loseItem: 'an item is lost for good',
        scarHead: 'scars a HEAD face', tax: 'every verb −1 next turn', freezeDie: 'freezes one of your dice', none: '' },
    },
    // --- UI labels / messages ({n} is replaced by a number) ---
    buttons: { roll: 'ROLL', reroll: 'REROLL ({n} left)', commit: 'COMMIT', restart: 'RESTART TRIP', continue: 'CONTINUE' },
    title: 'SMUGGLER', turn: 'TURN', scarsLabel: 'SCARS', intentLabel: 'INTENT', now: 'NOW', next: 'NEXT', nextPrefix: 'next:',
    held: 'HELD', unknownFace: '?', then: 'THEN',
    placeHint: 'Fill all {slots} slots to COMMIT ({n}/{slots})',
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
      noiseOnly: '+{n} noise', noNoise: 'no noise',   // site hint line once the sentence is full (the totals already name PRUNE / REVEAL)
      searchAll: 'search: reveals all', nothing: 'nothing happens', left: 'LEFT', guardian: 'GUARDIAN', noise: 'NOISE',
    },
    // V1-5: start screen, map and site screen strings ({n} {c} {max} {item} {name})
    m2: {
      startSub: 'Choose a trip', changeMode: 'MODE SELECT',
      startM1: 'SEQUENCE', startM1Desc: 'Five events and a campfire, one after another. No map.',
      startM2: 'MAP', startM2Desc: 'Walk a foggy map to the gate. Daylight runs out; scavenge sites make noise.',
      daylight: 'DAYLIGHT', scars: 'SCARS', items: 'ITEMS', you: 'YOU', map: 'MAP', moves: 'MOVES {n}', dayShort: '☀ {n}', coldShort: 'THE COLD',
      mapHint: 'Click a highlighted tile to walk there. Each step costs 1 daylight; in the dark every step scars you.',
      coldHint: 'No daylight left: every step scars you (THE COLD).',
      moveTip: 'Walk here (−1 daylight)', moveTipCold: 'Walk here: the cold scars you', fogTip: 'Unknown. You see tiles next to where you have walked.',
      visitedTip: 'visited', seenTip: 'revealed by the dog', hereTip: 'You are here',
      typeLabel: { CHARACTER: 'FIGHT', SCAVENGE: 'SITE', CAMPFIRE: 'REST', EMPTY: '', START: '', GATE: 'EXIT' },
      coldMsg: 'THE COLD bites.', coldDestroyed: '{item} destroyed by the cold.', revealedMsg: '{n} fogged tiles are now visible.',
      siteLabel: 'SCAVENGE SITE', guardian: 'guardian', rulesLine: 'each turn +1 noise · PRUNE +1/point · full = guardian',
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
