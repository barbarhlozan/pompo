// CONFIG: Colours.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  colors: {
    bg: '#0b0b10', panel: '#16161f', line: '#2a2a3a', text: '#e8e6f0', textDim: '#a9a7c0',
    // verbs carry meaning: PRUNE = red (force), SOW = blue (intellect / persuasion), DIG = amber (curiosity / search)
    verb: { PRUNE: '#ff4a4a', SOW: '#3d8bff', DIG: '#ffb21f' },
    // body parts: a muted, neutral bone / sand / clay family so they never read as verbs
    body: { PALM: '#d6cdb4', ARM: '#cbbf9c', MOUTH: '#c99a80', EYE: '#bdb48f', EAR: '#b8a98a', NOSE: '#d4b49a', BACK: '#a9a590', BELLY: '#c4a8a0' },
    // items: one distinct purple family
    item: { KNIFE: '#b967ff', SHEARS: '#9f7bff', SPADE: '#8f5fd8', WATERING_CAN: '#c996ff', SEED_POUCH: '#a06be0',
            GLASSES: '#e38cff', LANTERN: '#d6a8ff', WHISTLE: '#b57fe8', MATCHES: '#9a8cff', FORBIDDEN_BOOK: '#d27fe0',
            SLEEVE_POCKET: '#ae8cf0', EAR_TRUMPET: '#c28cff', PIPE: '#a27ff0', VEST: '#bba0ff' },
    // M2 map tiles (word blocks) and site face contents
    map: { START: '#ffe36b', GATE: '#f2f2f2', CHARACTER: '#e0806a', SCAVENGE: '#c9b97a', CAMPFIRE: '#ff9f43', EMPTY: '#23232f', FOG: '#1b1b26', sun: '#ffd23f' },
    site: { ITEM: '#b967ff', JUNK: '#8a7a60', NOTHING: '#4a4a58', RATS: '#b86a4a', TRAP: '#e0508a', hidden: '#444444' },
    tileText: '#0b0b10',
    scar: '#3a3a44', scarText: '#ff3b3b',
    turned: '#4fe06a', broken: '#5a5a66', pipIntact: '#e8e6f0',   // turned = green, scar = dark grey with a red crack
    hostile: '#ff5a5a', glow: '#ffffff',
    lit: '#ffe36b',        // "sentence complete" gold, COMMIT button, held badge
    status: '#ffd36b',     // enemy action text, status line, debug accents
    unknownBg: '#444444', unknownFg: '#aaaaaa',   // the "?" tile before the first roll
    enemy: { BITE: '#ff5a5a', GROWL: '#d8704a', SNIFF: '#b98a6a', WHIMPER: '#8fa4c0',
             SNIP: '#ff5a5a', BOAST: '#d8704a', HAGGLE: '#8fa4c0',
             PECK: '#ff5a5a', CAW: '#d8704a', STEAL: '#e0508a', CIRCLE: '#8fa4c0',
             BORROW: '#ff5a5a', QUOTE: '#d8704a', SIGH: '#8fa4c0',
             CREAK: '#d8704a', SLIP: '#ff5a5a', DROP: '#e0508a', SWAY: '#d8704a', 'CALM WATER': '#8fa4c0',
             TAXES: '#e0b84a', EXPLAINS: '#ff5a5a', BORES: '#d8704a', ANECDOTE: '#7fc4e8', FILES: '#8fa4c0' },
  },
});
