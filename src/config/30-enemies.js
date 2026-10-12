// CONFIG: Enemy effect rules and the enemy roster.
// Every tunable lives in CONFIG; engine, UI, FX and debug read it at call time.

Object.assign(CONFIG, {
  // Enemy effect numbers. tax: every verb total of the sentence is reduced by this next turn (min 0, not stacking).
  effectRules: { tax: 1, scarHeadDie: 'HEAD' },
  // Enemies: tags, pruneMod / sowMod (added once to that verb's sentence total, min 0), 6 faces with pips,
  // flavour text (read as "<logName> <text>"), rewards per ending.
  //   effect: 'scar' (random non-scar HAND/HEAD face -> SCAR, its item is destroyed) | 'rerollPenalty' (-1 reroll next turn)
  //           | 'takeItem' (random placed item goes to the enemy; returned if beaten) | 'none'
  //           | 'loseItem' (a random placed item is removed for good, never returned)
  //           | 'scarHead' (scar a random face of effectRules.scarHeadDie) | 'tax' (next turn every verb total -1) | 'freezeDie' (a random non-MIND die can't be held/rerolled next turn)
  //   scar targets: CONFIG.scarTargets (null = all body dice); takeItem / loseItem: any placed item on any body die.
  //   slots: sentence length for this enemy (default CONFIG.defaultSlots).
  //   rewards: { choose:[ids] } pick one, { give:[ids] } all; returnTaken:true gives back taken items; revealTiles is M2.
  enemies: {
    DOG: {
      name: 'STRAY DOG', logName: 'dog', tags: ['animal'], pruneMod: 0, sowMod: 0, slots: 3,
      faces: [
        { name: 'BITE',    pips: 4, hostile: true,  effect: 'scar' },
        { name: 'BITE',    pips: 4, hostile: true,  effect: 'scar' },
        { name: 'GROWL',   pips: 4, hostile: true,  effect: 'rerollPenalty' },
        { name: 'GROWL',   pips: 4, hostile: true,  effect: 'rerollPenalty' },
        { name: 'SNIFF',   pips: 4, hostile: true,  effect: 'none' },
        { name: 'WHIMPER', pips: 4, hostile: false, effect: 'none' },
      ],
      targetPriority: ['BITE', 'GROWL', 'SNIFF'],     // order for spilling PRUNE/SOW past the current intent
      text: { BITE: 'bites', GROWL: 'growls (−1 reroll next turn)', SNIFF: 'sniffs your pockets', WHIMPER: 'whimpers',
              wag: 'wags its tail', broken: 'is too hurt to act' },
      rewards: { beaten: { choose: ['WHISTLE', 'SPADE'] }, befriended: { choose: ['WHISTLE', 'LANTERN'], revealTiles: 4 } },
      winText: { beaten: 'The dog is done for.', befriended: 'The dog is yours now.' },
    },
    PLUMBER: {
      name: 'PLUMBER', logName: 'plumber', tags: ['human'], pruneMod: -1, sowMod: 1, slots: 3,
      faces: [
        { name: 'BORROW', pips: 6, hostile: true,  effect: 'takeItem' },
        { name: 'BORROW', pips: 6, hostile: true,  effect: 'takeItem' },
        { name: 'QUOTE',  pips: 2, hostile: true,  effect: 'rerollPenalty' },
        { name: 'QUOTE',  pips: 2, hostile: true,  effect: 'rerollPenalty' },
        { name: 'SIGH',   pips: 2, hostile: false, effect: 'none' },
        { name: 'SIGH',   pips: 2, hostile: false, effect: 'none' },
      ],
      targetPriority: ['BORROW', 'QUOTE'],
      text: { BORROW: 'borrows your {item}', QUOTE: 'quotes an outrageous price (−1 reroll next turn)', SIGH: 'sighs and shakes his head',
              noItem: 'rummages through your things, finds nothing worth borrowing', wag: 'tips his cap', broken: 'is too hurt to act' },
      rewards: { beaten: { choose: ['SHEARS', 'MATCHES'], returnTaken: true }, befriended: { choose: ['WATERING_CAN', 'VEST'] } },
      winText: { beaten: 'The plumber leaves, rubbing his bruises.', befriended: 'The plumber shakes your hand and stays for tea.' },
    },
    ACCOUNTANT: {
      name: 'ACCOUNTANT', logName: 'accountant', tags: ['human'], pruneMod: 1, sowMod: -1, slots: 2,   // he talks, you nod
      faces: [
        { name: 'TAXES',    pips: 4, hostile: true,  effect: 'tax' },
        { name: 'TAXES',    pips: 4, hostile: true,  effect: 'tax' },
        { name: 'EXPLAINS', pips: 6, hostile: true,  effect: 'scarHead' },
        { name: 'BORES',    pips: 2, hostile: true,  effect: 'rerollPenalty' },
        { name: 'ANECDOTE', pips: 4, hostile: true,  effect: 'freezeDie' },
        { name: 'FILES',    pips: 2, hostile: false, effect: 'none' },
      ],
      targetPriority: ['EXPLAINS', 'TAXES', 'ANECDOTE', 'BORES'],
      text: { TAXES: 'talks about taxes (next turn: every verb −1)', EXPLAINS: 'explains depreciation; your eyes glaze over',
              BORES: 'tells you about his weekend (−1 reroll next turn)', ANECDOTE: 'starts an anecdote (a die freezes up)',
              FILES: 'shuffles his files', wag: 'adjusts his glasses', broken: 'is too hurt to act' },
      rewards: { beaten: { choose: ['FORBIDDEN_BOOK', 'GLASSES'] }, befriended: { choose: ['EAR_TRUMPET', 'PIPE'] } },
      winText: { beaten: 'The accountant flees to a quieter office.', befriended: 'The accountant waves goodbye, his spreadsheet lighter.' },
    },
    BRIDGE: {
      name: 'WOODEN BRIDGE', logName: 'bridge', tags: ['place'], pruneMod: 0, sowMod: 0, slots: 1,   // one careful step
      resultLabels: { beaten: 'FORCED ACROSS', befriended: 'CROSSED SAFELY' },   // shown instead of BEATEN / BEFRIENDED
      faces: [
        { name: 'CREAK',      pips: 4, hostile: true,  effect: 'rerollPenalty' },
        { name: 'CREAK',      pips: 4, hostile: true,  effect: 'rerollPenalty' },
        { name: 'SLIP',       pips: 4, hostile: true,  effect: 'scar' },
        { name: 'DROP',       pips: 6, hostile: true,  effect: 'loseItem' },
        { name: 'SWAY',       pips: 2, hostile: true,  effect: 'rerollPenalty' },
        { name: 'CALM WATER', pips: 2, hostile: false, effect: 'none' },
      ],
      targetPriority: ['DROP', 'SLIP', 'CREAK', 'SWAY'],
      text: { CREAK: 'the planks creak (−1 reroll next turn)', SLIP: 'you slip on wet wood', DROP: 'something falls into the river',
              SWAY: 'the bridge sways (−1 reroll next turn)', 'CALM WATER': 'the water flows quietly',
              noItem: 'something almost falls into the river', wag: 'the planks hold steady', broken: 'the planks are splintered' },
      rewards: { beaten: { give: [] }, befriended: { choose: ['LANTERN', 'WATERING_CAN'] } },
      winText: { beaten: 'You force your way across, planks cracking.', befriended: 'You cross, step by careful step.' },
    },
    CROWS: {
      name: 'CROW FLOCK', logName: 'crows', tags: ['animal'], pruneMod: 1, sowMod: -2, slots: 2,
      faces: [
        { name: 'PECK',   pips: 2, hostile: true,  effect: 'scar' },
        { name: 'PECK',   pips: 2, hostile: true,  effect: 'scar' },
        { name: 'CAW',    pips: 2, hostile: true,  effect: 'rerollPenalty' },
        { name: 'STEAL',  pips: 4, hostile: true,  effect: 'takeItem' },
        { name: 'CIRCLE', pips: 2, hostile: false, effect: 'none' },
        { name: 'CIRCLE', pips: 2, hostile: false, effect: 'none' },
      ],
      targetPriority: ['PECK', 'STEAL', 'CAW'],
      text: { PECK: 'pecks!', CAW: 'caws (−1 reroll next turn)', STEAL: 'steals from you', CIRCLE: 'circles overhead',
              noItem: 'finds nothing shiny', wag: 'settles on a branch', broken: 'is too hurt to act' },
      rewards: { beaten: { give: ['LANTERN'], returnTaken: true }, befriended: { choose: ['SLEEVE_POCKET', 'KNIFE'] } },
      winText: { beaten: 'The crows scatter.', befriended: 'The crows land on your shoulder.' },
    },
  },
});
