// CONFIG: Trip structure, map, noise, site rules, scavenge sites and site contents.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  // Trip: M1 sequence of encounters; campfire id is the rest stop. singleFight is what the v0 single-fight UI plays.
  // M1 = m1Fights distinct random enemies from enemyPool with the campfire after fight number campfireAfter
  // (rolled at createTrip). M2 character tiles pick from the same pool.
  // V1-4c: M1 = m1Events distinct draws from m1Pool (fights, obstacle, sites) with the campfire after event campfireAfter.
  // enemyPool = every enemy id a map CHARACTER tile can hold (sites come from CONFIG.sites).
  trip: { enemyPool: ['DOG', 'PLUMBER', 'CROWS', 'ACCOUNTANT', 'BRIDGE'],
          m1Pool: ['DOG', 'PLUMBER', 'CROWS', 'ACCOUNTANT', 'BRIDGE', 'HUT'], m1Events: 5, campfireAfter: 3,
          campfireId: 'CAMPFIRE', singleFight: 'DOG', healPerCampfire: 1,
          mapStage: 'MAP', siteStage: 'SITE',            // M2 trip.stage values besides enemy ids / campfireId
          unknownLabel: '?',                             // future fights in the stage strip
          stageLabels: { DOG: 'DOG', PLUMBER: 'PLUMBER', ACCOUNTANT: 'ACCOUNTANT', BRIDGE: 'BRIDGE', HUT: 'HUT', CAMPFIRE: 'FIRE', CROWS: 'CROWS' } },   // top-bar stage indicator
  // ---------- M2: map, daylight, scavenge sites ----------
  // Tile weights, size, daylight. START = column 0, row startRow (default floor((rows-1)/2)); GATE = last column, random row.
  // campfireCols = [first, last] column (0-indexed) that must hold at least one CAMPFIRE.
  map: {
    cols: 6, rows: 4, daylight: 8, daylightPerMove: 1, coldScarsPerMove: 1, startRow: null, campfireCols: [1, 3],
    weights: { CHARACTER: 35, SCAVENGE: 30, CAMPFIRE: 10, EMPTY: 25 },
    gateVisible: false,                                   // true = the GATE tile is never fogged
    words: { FOG: '?', START: 'START', GATE: 'GATE', CAMPFIRE: 'FIRE', EMPTY: 'EMPTY' },
    enemyWords: { DOG: 'DOG', PLUMBER: 'PLUMBER', ACCOUNTANT: 'ACCOUNTANT', CROWS: 'CROWS', BRIDGE: 'BRIDGE' },   // CHARACTER tile word per enemy id (site words live in sites)
    typeNames: { START: 'START', GATE: 'GATE', CHARACTER: 'CHARACTER', SCAVENGE: 'SCAVENGE', CAMPFIRE: 'CAMPFIRE', EMPTY: 'EMPTY' },
    text: { cold: 'THE COLD', coldLog: 'the cold bites', moved: 'daylight', revealed: 'shows you the way' },
  },
  noiseMax: 6,
  // Site noise & pip rules. overkill: PRUNE points still unspent when an ITEM face opens -> the item breaks into JUNK.
  siteRules: { overkill: 2, pruneNoisePerPoint: 1, turnNoise: 1, ratsNoise: 2, ratsScars: 1, trapScars: 1,
               sowDivisor: 2, sowMin: 1, shuffleFaces: true },
  // Scavenge sites: faces = hidden contents (one per face, shuffled when the site is created if shuffleFaces),
  // pips = pips per face, pool = item ids an ITEM face can hold, guardian = enemy id fought when noise is full.
  sites: {
    HEAP: { name: 'COMPOST HEAP', word: 'HEAP', faces: ['ITEM', 'ITEM', 'JUNK', 'RATS', 'NOTHING', 'NOTHING'], pips: 2, slots: 3,
            pool: ['WATERING_CAN', 'SPADE', 'MATCHES'], guardian: 'DOG' },
    SHED: { name: 'GARDEN SHED', word: 'SHED', faces: ['ITEM', 'ITEM', 'ITEM', 'JUNK', 'NOTHING', 'TRAP'], pips: 3, slots: 3,
            pool: ['SHEARS', 'KNIFE', 'LANTERN', 'VEST'], guardian: 'CROWS' },
    HUT:  { name: 'ABANDONED HUT', word: 'HUT', faces: ['ITEM', 'ITEM', 'NOTHING', 'JUNK', 'TRAP', 'NOTHING'], pips: 2, slots: 3,
            pool: ['MATCHES', 'PIPE', 'FORBIDDEN_BOOK', 'SLEEVE_POCKET'], guardian: 'ACCOUNTANT' },
    WELL: { name: 'OLD WELL', word: 'WELL', faces: ['ITEM', 'NOTHING', 'NOTHING', 'NOTHING', 'JUNK', 'RATS'], pips: 1, slots: 2,
            pool: ['WHISTLE', 'EAR_TRUMPET'], guardian: 'PLUMBER' },
  },
  siteContents: {                                          // display words for site face contents
    ITEM: { label: 'ITEM', info: 'An item. It goes into your inventory.' },
    JUNK: { label: 'JUNK', info: 'Nothing useful.' },
    NOTHING: { label: 'NOTHING', info: 'Empty.' },
    RATS: { label: 'RATS', info: 'Rats! 1 scar and +2 noise.' },
    TRAP: { label: 'TRAP', info: 'A trap! 1 scar.' },
  },
});
