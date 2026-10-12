// CONFIG: Player dice, starting inventory, body parts, sentence shape names, bare action names.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  // Player dice are data: kind 'mind' (faces are verbs; at most one verb face per sentence) or 'body' (faces are body parts
  // that can hold items and be scarred). Starting dice are bare; the kit sits in the inventory and is placed on the intro screen.
  playerDice: [
    { id: 'MIND',  label: 'MIND',  kind: 'mind', faces: ['PRUNE', 'PRUNE', 'SOW', 'SOW', 'DIG', 'DIG'] },
    { id: 'HEAD',  label: 'HEAD',  kind: 'body', faces: ['NOSE', 'EYE', 'EYE', 'MOUTH', 'EAR', 'EAR'] },
    { id: 'TORSO', label: 'TORSO', kind: 'body', faces: ['PALM', 'PALM', 'ARM', 'ARM', 'BACK', 'BELLY'] },
  ],
  startingInventory: ['KNIFE', 'GLASSES', 'SEED_POUCH'],   // placed on the intro screen
  // Body parts: favourite verb (2 points, else 1), fixedPoints (always that many under any verb, overrides favourite),
  // revealsNext (NOSE: when it acts it also reveals the enemy's next intent), vulnerable (BELLY: exposed -> scar, VEST covers),
  // instinctVerb (verb a part with no favourite uses when it acts on instinct; null = does nothing), label (display, optional).
  bodyParts: {
    PALM:  { favourite: 'PRUNE', label: 'DLAŇ' },
    ARM:   { favourite: 'PRUNE', label: 'PAŽE' },
    MOUTH: { favourite: 'SOW',   label: 'PUSA' },
    EYE:   { favourite: 'DIG',   label: 'OKO' },
    EAR:   { favourite: 'DIG',   label: 'UCHO' },
    NOSE:  { favourite: 'DIG',   label: 'NOS', revealsNext: true },
    BACK:  { favourite: null,    label: 'ZÁDA',   fixedPoints: 1, instinctVerb: null },
    BELLY: { favourite: null,    label: 'BŘICHO', fixedPoints: 1, instinctVerb: null, vulnerable: true },
  },
  // Sentence labels by MIND position. `first` / `middle` / `last` apply to any slot count; no MIND = reflex;
  // a lone MIND in a 1-slot sentence = idle (or hold with mindAloneHolds).
  shapeNames: { first: 'Plan', middle: 'Situation', last: 'Impulse', reflex: 'Reflex', idle: 'Idle', hold: 'Hold' },
  // Action names. Defaults are neutral (they read against an animal, a person, a place or a scavenge site); actionNamesByTag overrides
  // single names for an encounter whose first matching tag is that tag (animal | human | place; scavenge sites use 'site').
  // Lookup order: item name for the tag -> item name -> part name for the tag -> part name. Keep names short (shown big in slots).
  actionNames: {                                      // bare body parts only: [bodyPart][verb]; item faces use items[id].names. IDLE = acting on instinct with no verb
    'PALM':  { PRUNE: 'Hit',      SOW: 'Gesture',     DIG: 'Search' },
    'ARM':   { PRUNE: 'Swing',    SOW: 'Wave',        DIG: 'Reach' },
    'MOUTH': { PRUNE: 'Shout',    SOW: 'Coax',        DIG: 'Call out' },
    'EYE':   { PRUNE: 'Glare',    SOW: 'Soft look',   DIG: 'Look' },
    'EAR':   { PRUNE: 'Tune out', SOW: 'Lend an ear', DIG: 'Listen' },
    'NOSE':  { PRUNE: 'Snort',    SOW: 'Sniff gently', DIG: 'Sniff out' },
    'BACK':  { PRUNE: 'Shove',    SOW: 'Lean',        DIG: 'Hunch',  IDLE: 'Brace' },
    'BELLY': { PRUNE: 'Bump',     SOW: 'Chuckle',     DIG: 'Rumble', IDLE: 'Clench' },
  },
  actionNamesByTag: {                                 // [tag][bodyPart][verb]
    human: { MOUTH: { PRUNE: 'Insult', SOW: 'Small talk', DIG: 'Ask' }, EAR: { SOW: 'Hear out' }, BELLY: { SOW: 'Laugh' } },
  },
});
