// CONFIG: Core rules: rerolls, scars, lose rule, points, verbs, damage verbs.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

const CONFIG = {
  rerollsPerTurn: 2,
  maxScars: 4,                                        // loseRule 'maxScars': trip is lost when total scars >= this
  loseRule: 'maxScars',                               // 'maxScars' (v1 rule, default) | 'dieLost' = run ends when every face of any single die is a SCAR
  scarTargets: null,                                  // die ids a scar may land on (null = every die with kind 'body')
  mindAloneHolds: false,                              // true: a lone MIND (1-slot sentence) lets you hold one body die into the next turn
  minSlots: 2,                                        // no encounter / site has fewer sentence slots than this (1-slot code paths stay, unreachable by default)
  defaultSlots: 3,                                    // sentence length of an enemy / site without its own `slots`
  points: { favourite: 2, other: 1, itemBonus: 1, scar: 0 },
  verbs: ['PRUNE', 'SOW', 'DIG'],
  revealVerb: 'DIG',                                  // verb that reveals the next intent and carries points
  pipResult: { PRUNE: 'broken', SOW: 'turned' },      // damage verbs -> what they do to a pip
  modKey: { PRUNE: 'pruneMod', SOW: 'sowMod' },       // damage verb -> enemy field added once to that verb's sentence total
};
