// CONFIG: Items and their item rules.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  // Items: part, a name per verb (null = use the part's action name), a `special` code the engine switches on, `info` for
  // tooltips, optional `uses` (charges) and `forbidden` (inert until checks). Numbers for the specials live in itemRules.
  // Every item also gives points.itemBonus.
  items: {
    KNIFE:        { name: 'KNIFE',        part: 'PALM',  names: { PRUNE: 'Stab',   SOW: 'Threaten',        DIG: 'Pry' },
                    special: 'knife',       info: 'PRUNE: +1 extra point' },
    SHEARS:       { name: 'SHEARS',       part: 'PALM',  names: { PRUNE: 'Snip',   SOW: 'Offer to trim',   DIG: 'Cut open' },
                    special: 'shears',      info: 'PRUNE: its points are split across 2 different faces. On a scavenge site, PRUNE with SHEARS makes no noise' },
    SPADE:        { name: 'SPADE',        part: 'PALM',  names: { PRUNE: 'Whack',  SOW: 'Lean and chat',   DIG: 'Dig' },
                    special: 'spade',       info: 'DIG on a scavenge site: reveals all faces' },
    WATERING_CAN: { name: 'WATERING CAN', part: 'PALM',  names: { PRUNE: 'Splash', SOW: 'Water their plant', DIG: 'Flood out' },
                    special: 'wateringCan', info: 'SOW: +1 now, and +1 SOW automatically at the start of your next turn' },
    MATCHES:      { name: 'MATCHES',      part: 'PALM',  names: { PRUNE: 'Light up', SOW: 'Offer a light', DIG: 'Shine' },
                    special: 'matches',     uses: 3, info: 'PRUNE: +2. Each use spends 1 charge; at 0 the matches burn out' },
    FORBIDDEN_BOOK: { name: 'FORBIDDEN BOOK', part: 'PALM', names: { PRUNE: 'Smack', SOW: 'Quote', DIG: 'Look up' },
                    special: 'forbiddenBook', forbidden: true, info: 'SOW: +2. Forbidden: suspicious at checks (later)' },
    SEED_POUCH:   { name: 'SEED POUCH',   part: 'PALM',  names: { PRUNE: null, SOW: null, DIG: null },
                    special: 'seedPouch',   uses: 3, info: 'Needed to catch a soul (later). One use per soul. No effect yet' },
    SLEEVE_POCKET: { name: 'SLEEVE POCKET', part: 'ARM', names: { PRUNE: null, SOW: null, DIG: null },
                    special: 'sleevePocket', info: 'At a check (later) the item on a neighbouring face stays hidden. No effect yet' },
    GLASSES:      { name: 'GLASSES',      part: 'EYE',   names: { PRUNE: 'Glint',  SOW: 'Look learned',    DIG: 'Read the fine print' },
                    special: 'glasses',     info: 'First in the sentence: reveals the next 2 enemy intents' },
    LANTERN:      { name: 'LANTERN',      part: 'EYE',   names: { PRUNE: 'Dazzle', SOW: 'Warm light',      DIG: 'Light up' },
                    special: 'lantern',     info: 'This eye face counts as matching (2 points) under any verb' },
    EAR_TRUMPET:  { name: 'EAR TRUMPET',  part: 'EAR',   names: { PRUNE: null,     SOW: 'Listen closely',  DIG: 'Eavesdrop' },
                    special: 'earTrumpet',  info: 'Directly before a MOUTH die: that MOUTH gets +2' },
    WHISTLE:      { name: 'WHISTLE',      part: 'MOUTH', names: { PRUNE: 'Shriek', SOW: 'Call softly',     DIG: 'Echo' },
                    special: 'whistle',     info: 'SOW vs animals: this die\'s points ×2' },
    PIPE:         { name: 'PIPE',         part: 'MOUTH', names: { PRUNE: 'Blow smoke', SOW: 'Calm chat',   DIG: 'Ponder' },
                    special: 'pipe',        info: 'Last in the sentence: wanted level −1 (no effect yet)' },
    VEST:         { name: 'VEST',         part: 'BELLY', names: { PRUNE: null, SOW: null, DIG: null },
                    special: 'vest',        info: 'Covers the belly: no scar when it is exposed' },
  },
  itemRules: {
    knifePruneBonus: 1,            // KNIFE, PRUNE
    matchesPruneBonus: 2,          // MATCHES, PRUNE (spends 1 charge per use)
    forbiddenBookSowBonus: 2,      // FORBIDDEN BOOK, SOW
    glassesRevealDepth: 2,         // GLASSES in the first slot: intents revealed
    defaultRevealDepth: 1,         // DIG
    noseRevealDepth: 1,            // a body part with revealsNext (NOSE) when it acts
    whistleMultiplier: 2,          // WHISTLE, SOW vs enemy tag whistleTag
    whistleTag: 'animal',
    wateringCanNow: 1,             // WATERING CAN, SOW: extra points now ...
    wateringCanSow: 1,             // ... and pending SOW applied at the start of the next turn
    earTrumpetBonus: 2,            // EAR TRUMPET directly before a face of part earTrumpetPart: that face +2
    earTrumpetPart: 'MOUTH',
    pipeWanted: -1,                // PIPE in the last slot: wanted level change (no-op until the wanted level exists)
  },
});
