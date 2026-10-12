# Implementation plan — Smuggler prototype v1

Spec: [DESIGN-V1.md](DESIGN-V1.md). v0 background: [DESIGN.md](DESIGN.md), [PLAN.md](PLAN.md)
(v0 rules §4 and phase notes describe the existing code). Frozen v0 copy: `archive/v0/`.
Where this file and DESIGN-V1.md disagree, **this file wins**: it resolves the spec's ambiguities.

Same file, same architecture as v0: `index.html` with `CONFIG` / `ENGINE` / `UI` / `FX` /
`DEBUG` blocks; ENGINE stays pure (no DOM, rng injected) and is tested by
`node tests/engine.test.mjs` (slices CONFIG START…ENGINE END, runs it in `node:vm`). No sound.
Animations only react to the player's actions or to events they triggered (no idle loops).

Phases run **one after another** (they all edit `index.html`). Each phase ends with: tests
green, the page loads with zero console errors and no scrolling at 1280×720, browser-verified,
and a "Phase notes" entry appended to the bottom of this file (what was built, API changes,
deviations, known issues). Don't init git or commit.

---

## 1. Data model changes (ENGINE + CONFIG)

**Faces stay strings.** Body face = `PART` or `PART+ITEMID` (e.g. `HAND+WATERING_CAN`),
`SCAR`, or a verb (`PRUNE`). Item ids are UPPER_SNAKE; display names come from CONFIG.
`parseFace` already splits on `+`; keep it, extend for multi-word ids.

**Player dice are now mutable trip state** (items placed/removed, scars), so dice faces live in
`trip.dice` and persist across encounters. Starting kit (CONFIG `playerDice`):
- MIND: `PRUNE PRUNE SOW SOW DIG DIG`
- HAND: `HAND+KNIFE HAND HAND HAND HAND HAND`
- HEAD: `EYE+GLASSES EYE EYE MOUTH MOUTH MOUTH`

**Items** in `CONFIG.items` keyed by id:
```js
KNIFE: { name: 'KNIFE', part: 'HAND', names: { PRUNE:'Stab', SOW:'Threaten', DIG:'Pry' },
         special: 'knife', info: 'PRUNE: +1 extra point' },
```
`special` is a code string the engine switches on (`knife, shears, spade, wateringCan,
seedPouch, glasses, lantern, whistle`); numbers for specials go in `CONFIG.itemRules`
(e.g. `knifePruneBonus: 1, glassesRevealDepth: 2, whistleMultiplier: 2, wateringCanSow: 1,
seedPouchRerollPerTurned: 1`). Bare-part names stay in `CONFIG.actionNames` (`HAND`, `MOUTH`,
`EYE` rows only); item names come from the item. Remove the `HAND+KNIFE`/`EYE+GLASSES` rows.

**Enemies** in `CONFIG.enemies` keyed by id (`DOG`, `GARDENER`, `CROWS`):
```js
DOG: { name:'STRAY DOG', logName:'dog', tags:['animal'], pruneMod:0, sowMod:0,
  faces: [ { name:'BITE', pips:2, hostile:true, effect:'scar' }, ... ],   // 6 entries
  targetPriority: ['BITE','GROWL','SNIFF'],
  text: { BITE:'bites', ... wag:'wags its tail', broken:'is too hurt to act' },
  rewards: { beaten: { choose:['WHISTLE','SPADE'] }, befriended: { choose:['WHISTLE','LANTERN'], revealTiles:4 } },
  winText: { beaten:'…', befriended:'…' } }
```
Effects: `scar`, `rerollPenalty`, `none`, `takeItem` (SNIP/STEAL). Rewards: `{ choose:[ids] }`
(pick one) or `{ give:[ids] }` (all); `returnTaken:true` on `beaten` for GARDENER and CROWS
returns the items they took. `revealTiles` is ignored until M2. Enemy face objects in state:
`{ name, pips:[...] }` with pip count from CONFIG per face.

**Trip state** (new, top level): `{ dice, inventory:[itemIds], scars (derived), log:[],
stage, encounter }`. `CONFIG.maxScars: 6` replaces `scarsToLose`. Rerolls, the GROWL penalty, and
pending watering-can effects reset at the start of each encounter.

## 2. Rule clarifications (decided: implement exactly)

**Scoring a body die** (`scoreStep`): `base` = favourite (2) if verb is the part's favourite,
else other (1); +itemBonus (1) if it has an item; SCAR = 0. Then the item special:
- **KNIFE**: if verb is PRUNE: +1 (`knifePruneBonus`). Annotate `(knife +1)`.
- **LANTERN**: the favourite check always passes (2), so the total is always 3. Annotate `(lantern)` when the verb isn't DIG.
- **WHISTLE**: if verb is SOW and the current enemy has tag `animal`: the die's own points
  (base incl. item bonus, **before** carry) ×2. Annotate `(whistle ×2)`. On a site: no effect.
- Carry from DIG is then added: `total = own + carryIn`.
- Text: `"<Name> <own>"` / `"<Name> <own>+<carry>"`, then ` (reveal)` for DIG steps, then special
  annotations. Required: `EYE PRUNE HAND+KNIFE` → `Situation: Look 2 (reveal) → Stab 4+2 (knife +1) → PRUNE 6`.
  (The spec's example drops "(reveal)"; we keep it, as in v0.) **Update the v0 tests**:
  knife PRUNE is now 4, so the v0 example strings change accordingly; keep the non-knife v0 cases.
- **pruneMod / sowMod** are added once to that verb's sentence total, **only if the sentence
  produces that verb at all** (total > 0 before the mod), clamped at ≥ 0. Totals text:
  `PRUNE 5 (gardener −1)`; if the mod clamps to 0: `SOW 0 (crows −2)`. Mods don't apply on sites.
- **SHEARS** (PRUNE): that die's total (own + carry) is applied **first and alternating**
  between the first two eligible targets (target 1, target 2, target 1, …), and the rest of the
  PRUNE total is applied normally afterwards. If only one eligible face remains, everything goes to it.
  Annotate `(shears split)`. On a site the shears portion makes no noise (M2).
- **WATERING CAN** (SOW): sets `pendingSow += wateringCanSow` (1). It is applied at the
  **start of the next turn of the same encounter**, before rolling: animate it, log it
  (`watering can: SOW 1`), then check win. Discarded when the encounter ends. Annotate `(+1 SOW next turn)`.
- **SEED POUCH** (SOW): if the sentence contains a SEED POUCH die performing SOW, every enemy face
  that becomes `turned` during this sentence's resolution gives +1 reroll next turn (stacks with
  GROWL penalty: `rerolls = base − penalty + bonus`, min 0). Annotate `(seeds)`. The preview can't
  know how many faces will turn, so it only shows the annotation; the result appears in the log.
- **GLASSES** (DIG): reveal depth 2 instead of 1 (see foresight). Annotate `(sees 2)`.
- **SPADE** (DIG): in fights no special. On a site: reveals all faces (M2). Annotate only on sites.

**Foresight, generalised**: the enemy keeps an `upcoming` queue of pre-rolled intents. A DIG
reveal with depth d makes sure `upcoming` holds at least d intents and sets `foresight = d`. At
the turn transition `current = upcoming.shift() ?? roll`; if foresight was set, top up `upcoming`
to `foresight` entries and keep them visible (greyed, in order) **during the following turn**,
then clear foresight. Entries that become broken get rerolled at the transition. (v0 behaviour =
depth 1.)

**Enemy effects**:
- `scar` (BITE, PECK): a random non-scar face on HAND or HEAD becomes `SCAR`. **If it had an item,
  the item is destroyed** (event `{type:'itemDestroyed', dieId, faceIdx, item, cause:'scar'}`, log
  `KNIFE destroyed by the bite`). Then check lose (`scars ≥ maxScars`) → trip lost.
- `rerollPenalty` (GROWL, BOAST, CAW): −1 reroll next turn (non-stacking within a turn).
- `takeItem` (SNIP, STEAL): a random face holding an item loses it (face becomes bare); the item
  goes into `encounter.taken`. If you have no placed items: nothing (flavour text). If the enemy
  is BEATEN and its rewards say `returnTaken`, taken items go back to the **inventory** (not the face).
  If BEFRIENDED, they are gone.
- Win per enemy as v0: all hostile faces resolved. BEATEN vs BEFRIENDED by majority of
  **resolved hostile** faces, tie → BEFRIENDED.

**Lose** anywhere in the trip when total scars ≥ `CONFIG.maxScars` → lose screen.

## 3. Placement rules (decided)

- Two modes: `reward` (after a reward or, in M2, after a site) and `campfire` (rearrange option).
- **reward mode**: items already on faces are **locked** (can't be moved or removed). Inventory items
  (new **and** older leftovers) can be dropped on any valid face. Dropping on an occupied face
  (locked or not) asks "replace? discard X" → yes discards the old item for good. Items placed
  during this screen stay movable until DONE. Unplaced items stay in the inventory.
- **campfire mode**: any placed item can be moved to another valid face (onto an occupied face →
  same replace confirmation), or dragged back to the inventory.
- Valid face = same body part as `item.part` (HAND die faces: HAND; HEAD die faces: EYE or MOUTH
  per face) and not SCAR. MIND die is never shown.
- **Odds summary** under each net, recomputed live: e.g. `HAND · 1× KNIFE · 1× SHEARS · 4× bare · 0× scar → item 2/6`;
  HEAD: `EYE 3 (1× GLASSES) · MOUTH 3 (0 items) · scar 0/6`. Format strings go in CONFIG.
- Hovering a net face shows its 3 verb names (with points) for that face.

## 4. Visual changes (decided)

- **Verb colours carry meaning**: PRUNE = red (force), SOW = **blue** (intellect / persuasion),
  DIG = amber (curiosity / search). Body parts move to a muted, neutral family (e.g. bone /
  sand / clay tones) so they never read as verbs; items stay one distinct family (purple);
  turned = green, scar = dark grey with a red crack. All in `CONFIG.colors`.
- **Verb tooltip**: `CONFIG.verbInfo = { PRUNE:'Force. Breaks pips. Beat them.', SOW:'Persuade. Turns pips. Befriend them.', DIG:'Search. Reveals what is coming and passes its points to the next die.' }`.
  Shown in the dice hover popover (for the current face's verb, or the body part's favourite verb
  plus the item special for body faces), on verb words in the preview, and on MIND faces in the sentence.
- Item tiles: the item's name as a word tile in the item colour, stuck to the body-part tile (as v0).

## 5. Phases

### V1-1 — M1 engine (no UI)
- Rewrite CONFIG to the §1 data model: items (all 8), enemies (all 3 from the spec), starting
  kit, `maxScars`, `itemRules`, `verbInfo`, new colours (§4), M1 trip sequence
  `CONFIG.trip.m1 = ['DOG','GARDENER','CAMPFIRE','CROWS']`.
- ENGINE: generalise `evaluateSentence(faces, ctx)` (`ctx = { enemy }` for tags/mods; works with
  no enemy for the placement preview) with all specials and annotations from §2; multi-enemy
  `createEnemy(id, rng)`, per-face pips, effects, foresight queue, item destruction on scar,
  `takeItem`, watering-can pending SOW (`startTurn` applies it and returns events), seed-pouch
  rerolls; trip functions: `createTrip(rng)`, `startEncounter(trip, enemyId, rng)`,
  `rewardsFor(trip, result)` → `{ choose|give, returned }`, `addToInventory`, `placeItem(trip,
  item, dieId, faceIdx, mode)` → `{ ok, replaced }` / validation `canPlace(...)`, `moveItem`,
  `unplaceItem`, `healScar(trip, dieId, faceIdx)`, `oddsSummary(die)`, `advanceStage(trip)`.
  Keep `resolveTurn` returning an ordered event list, plus new events: `itemDestroyed`,
  `itemTaken`, `pendingSow`, `rerollBonus`, `mod` (pruneMod/sowMod applied), `reveal` with a list.
- Tests: update v0 tests for the new kit/knife numbers; add a test for every item special, both
  mods (incl. clamping and "only if verb present"), shears alternate application, glasses depth-2
  foresight, scar destroys item, SNIP/STEAL + return on beaten / lost on befriended, placement
  validation (part, scar, replace, locked in reward mode, free in campfire mode), heal scar,
  maxScars lose, seeded full M1 trip simulation to an end.
- UI: the minimum to keep the current single fight running on the new engine (DOG, new kit).
  No new screens.

### V1-2 — M1 encounter UI + trip flow
- Trip state machine: `encounter → reward → placement → … → campfire → … → end` (lose screen from
  anywhere). Top bar: stage indicator (DOG · GARDENER · FIRE · CROWS), scars as a row of
  `maxScars` scar tiles, inventory count.
- Encounter screen for any enemy: name, tags, mods shown on the enemy panel (`PRUNE −1 · SOW +1`),
  variable pips per face, greyed foresight queue (up to 2), new effects animated (SNIP/STEAL: the
  item tile flies from your die to the enemy's bag/nest shown on its panel; scar destroying an item:
  the item tile breaks), watering-can start-of-turn SOW, seed-pouch reroll bonus in the status line.
- Preview shows item names, special annotations, mods. Verb tooltip (§4).
- Reward screen: BEATEN/BEFRIENDED + big item tiles; click one if it's a choice; returned items listed.
- **Placement screen stub only**: a list of inventory items and a DONE button (real screen in V1-3).
- Campfire screen: two big tiles: HEAL 1 SCAR (then click a scar face on a simple die view) or
  REARRANGE (opens the placement stub in campfire mode).
- End screen: result per encounter, final dice (simple face lists for now), scars, log. Lose
  screen. RESTART TRIP.
- Debug panel: keep the existing controls working; add "give item to inventory" and "jump to
  encounter/campfire" (by id).

### V1-3 — Placement screen + M1 QA
- Real placement screen per §3: HAND and HEAD as cross-shaped die nets (6 faces each, showing
  part, item, scar), inventory tray, Pointer Events drag of items, valid faces highlight while
  dragging, invalid drop target shakes and the item returns, replace confirmation tile, locked
  items visibly locked in reward mode, drag back to inventory in campfire mode, live odds summary,
  hover face → 3 verb names with points. Juice: snap with squash, a small one-shot spin/flip of
  the net when an item lands. Reuse it for the campfire heal choice (click a scar face).
- End screen shows the real dice nets.
- QA: verify every M1 acceptance item from DESIGN-V1.md in the browser (use the debug panel),
  fix bugs, append an "M1 QA report" (checklist with evidence, balance notes: run an engine
  simulation of M1 trips with a few simple policies, report win rate, scars, turns).

### V1-4 — M2 engine (map + sites, no UI)
Decided rules:
- Map `CONFIG.map = { cols:6, rows:4, daylight:12, weights:{CHARACTER:35,SCAVENGE:30,CAMPFIRE:10,EMPTY:25} }`.
  START = column 0, row `floor((rows−1)/2)` (= row 1). GATE = last column, random row. Other tiles
  rolled by weight; CHARACTER picks a random enemy id, SCAVENGE a random site id. Guarantee ≥ 1
  CAMPFIRE in columns 1–3 (0-indexed): if none, convert a random non-start/gate tile there. All
  tiles are walkable, so a path always exists; still assert it in tests.
- Fog: a tile's **specific** word (DOG / GARDENER / CROWS / HEAP / SHED / WELL / FIRE / empty / GATE)
  is visible if it is visited, orthogonally adjacent to a visited tile, or revealed (dog befriend:
  4 random fogged tiles). Otherwise fog.
- Move: orthogonal, one tile; −1 daylight per move; at 0 daylight each move gives +1 scar
  ("the cold", log line) and checks lose. Entering a tile triggers it: CHARACTER → fight,
  SCAVENGE → site, CAMPFIRE → campfire choice, EMPTY → nothing, GATE → trip won. Resolved tiles
  become EMPTY (a site is resolved when left or after its guardian fight).
- Site model: `CONFIG.sites` per the spec table: `{ name, word, faces:[contents], pips, pool,
  guardian }`. State per face: `{ content, item (rolled at creation from pool for ITEM faces),
  pipsLeft, revealed, opened }`. `CONFIG.noiseMax = 6`, `CONFIG.siteRules = { overkill:2,
  pruneNoisePerPoint:1, turnNoise:1, ratsNoise:2 }`.
- Site turn: roll/reroll/arrange as usual (no enemy, no intent, no mods, WHISTLE does nothing).
  Target = the clicked unopened face, default the first unopened face by index. Effects resolve in
  sentence order:
  - DIG step: reveals `total` unrevealed faces (target first, then by index); SPADE reveals all.
    Still passes carry as normal.
  - PRUNE total: removes pips from the target, overflow to the next unopened face by index
    (wrapping). +1 noise per PRUNE point applied, except points from a SHEARS die. **Overkill**:
    when an ITEM face is opened by PRUNE and the PRUNE points still left at that moment are ≥ 2,
    the item becomes JUNK (log it); leftover keeps overflowing.
  - SOW total: `max(1, floor(total/2))` pips, same targeting/overflow, no noise.
  - Opened faces resolve immediately: ITEM → inventory; JUNK/NOTHING → nothing; RATS → 1 scar and
    +2 noise; TRAP → 1 scar.
  - End of each committed turn: +1 noise. If noise ≥ noiseMax at any point: the guardian fight
    starts right after this turn's effects finish (a normal encounter with that enemy and its normal
    rewards). Afterwards the site is done.
  - LEAVE between turns: keep everything opened; site done.
  - After the site (left or guardian beaten), if new items were gained → placement (reward mode).
- Tests for all of the above, plus a seeded full M2 trip simulation.

### V1-4b — Content update: PLUMBER, ACCOUNTANT, random fights, intro (user decisions, binding)
Runs after V1-4, before V1-5. Overrides DESIGN-V1.md where different.

- **RIVAL GARDENER is removed.** Its items (SHEARS, SEED POUCH, WATERING CAN) stay in the game via site pools.
  OLD WELL's guardian becomes PLUMBER. Remove every GARDENER reference (CONFIG, tests, debug, labels).
- **PLUMBER** (tags human, pruneMod −1, sowMod +1; logName 'plumber'; bag label 'TOOLBOX'):
  - BORROW ×2 (3 pips, hostile, `takeItem`: "borrows your {item}"); returned if BEATEN.
  - QUOTE ×2 (1 pip, hostile, `rerollPenalty`: "quotes an outrageous price").
  - SIGH ×2 (1 pip, not hostile).
  - Rewards: beaten `{give:['PIPE_WRENCH'], returnTaken:true}`; befriended `{choose:['PLUNGER','WATERING_CAN']}`.
- **New plumber items** (both part HAND, normal +1):
  - PIPE WRENCH: PRUNE "Wrench", SOW "Fix their tap", DIG "Unscrew". Special `wrench` (passive): the face holding it
    can't be scarred and its item can't be taken; scar/take effects pick among other eligible faces (nothing if none).
    Shown on the net/hover as "sturdy". No preview annotation (passive).
  - PLUNGER: PRUNE "Plunge", SOW "Unclog their worries", DIG "Suck out". Special `plunger`: on DIG, also removes 1 pip
    (`itemRules.plungerPips`) from the current intent face **as turned** (on a site: from the target face, no noise).
    Annotate `(plunger −1 pip)`.
- **ACCOUNTANT** (tags human, pruneMod +1, sowMod −1; logName 'accountant'): hurts you by talking.
  - TAXES ×2 (2 pips, hostile, new effect `tax`: "talks about taxes"): next turn every verb total the sentence produces is −1
    (min 0), annotated `(taxed −1)` in the totals; non-stacking; cleared after that turn / at encounter end.
  - EXPLAINS (3 pips, hostile, new effect `scarHead`: "explains depreciation; your eyes glaze over"): scars a random
    non-scar HEAD face (item destroyed as usual; wrench can't be on HEAD so no interaction).
  - BORES (1 pip, hostile, `rerollPenalty`: "tells you about his weekend").
  - ANECDOTE (2 pips, hostile, new effect `freezeDie`: "starts an anecdote"): a random non-MIND die is frozen next turn:
    it can't be held/rerolled (rolls once normally). Show it frozen (icy outline + tooltip).
  - FILES (1 pip, not hostile).
  - targetPriority: EXPLAINS, TAXES, ANECDOTE, BORES.
  - Rewards: beaten `{choose:['LANTERN','GLASSES']}`; befriended `{choose:['WHISTLE','SEED_POUCH']}`.
- **Random fights**: pool `CONFIG.trip.enemyPool = ['DOG','PLUMBER','CROWS','ACCOUNTANT']`. M1 = 3 **distinct** random enemies
  with the campfire after the 2nd: `[e1, e2, 'CAMPFIRE', e3]`, rolled at `createTrip`. The player doesn't choose. Stage strip
  shows future fights as `?` until reached. M2 character tiles pick from the same pool.
- **Intro**: every trip (M1 and M2) starts with an intro placement screen (mode `'intro'`, rules = campfire mode: free placing
  and moving). Dice start **bare** (HAND ×6; HEAD EYE×3 MOUTH×3); `CONFIG.startingInventory = ['KNIFE','GLASSES']`.
  One help line from CONFIG ("Pack your things onto your dice."). DONE may leave items in the inventory.
- Tests: new items/effects (wrench protection for scar and take, plunger pip, tax incl. min 0 and expiry, scarHead,
  freezeDie blocks reroll/hold for one turn), random M1 sequence (3 distinct + campfire 3rd), intro state (bare dice, inventory),
  OLD WELL guardian, GARDENER gone. Update existing tests that used GARDENER (use PLUMBER, same mods).
- UI: enemy panels/animations for the new effects (frozen die visual, tax status line + annotation, head-scar uses the existing
  scar animation, borrow uses the item-taken flight to the TOOLBOX), intro screen via `openPlacement('intro')`, `?` in stage strip,
  debug jump/give lists updated.

### V1-4c — More events: ABANDONED HUT, WOODEN BRIDGE, 5-event M1 (user decisions, binding)
Engine + CONFIG + tests are done right after V1-4b (same session). The site UI they need for M1 comes in V1-5.

- **ABANDONED HUT** (new scavenge site, map word `HUT`): faces ITEM, ITEM, NOTHING, JUNK, TRAP, NOTHING; 2 pips per face;
  pool PIPE_WRENCH, PLUNGER, KNIFE, SEED_POUCH; guardian ACCOUNTANT ("was doing his taxes in peace").
- **WOODEN BRIDGE** (obstacle, uses the normal enemy/fight model; tags `place`; pruneMod 0, sowMod 0; logName 'bridge'):
  - CREAK ×2 (2 pips, hostile, `rerollPenalty`: "the planks creak").
  - SLIP (2 pips, hostile, `scar`: "you slip on wet wood").
  - DROP (3 pips, hostile, new effect `loseItem`: "something falls into the river"): a random placed item is removed and is
    **gone for good** (never returned; wrench protection applies).
  - SWAY (1 pip, hostile, `rerollPenalty`).
  - CALM WATER (1 pip, not hostile).
  - Result labels from CONFIG instead of BEATEN/BEFRIENDED: beaten = `FORCED ACROSS`, befriended = `CROSSED SAFELY`
    (make win labels per enemy data-driven, default BEATEN/BEFRIENDED).
  - Rewards: beaten `{give:[]}` (nothing; skip the reward screen and placement when there is nothing to get);
    befriended `{choose:['LANTERN','WATERING_CAN']}`.
  - Verb meaning here: PRUNE = force your way (break planks), SOW = steady it (careful), DIG = look for the safe path.
- **M1 = 5 events + campfire**: pool `CONFIG.trip.m1Pool = ['DOG','PLUMBER','CROWS','ACCOUNTANT','BRIDGE','HUT']`;
  draw 5 distinct, campfire after the 3rd: `[e1,e2,e3,'CAMPFIRE',e4,e5]`. Overrides V1-4b's 3-fight M1.
  A HUT stage in M1 runs as a site (no daylight; noise and guardian work as on the map; after it: placement if items gained).
- **M2 map**: HUT joins the SCAVENGE site pool; BRIDGE joins the CHARACTER pool (map word `BRIDGE`).
- Tests: HUT data, guardian; BRIDGE loseItem (gone for good, wrench-protected), labels, empty reward skip; M1 sequence
  (5 distinct from the pool + campfire 4th).

### V1-5 — M2 UI
- Also build the V1-4c UI: HUT/BRIDGE in M1 (site screen used for M1 HUT stages), per-enemy result labels, skip empty rewards.
- Map screen in the word-tile look: tiles as small word blocks, fog tiles, visited marks, the
  player marker, valid moves highlighted (click to move), daylight as a row of sun tiles, scars as
  a row of scar tiles, inventory. Move animation only on click. Cold scar animation.
- Site screen: the site die as 6 face cards (hidden/revealed content, pips left, opened), click to
  target (highlight), NOISE track (6 boxes), LEAVE button, preview shows site-specific text
  (`→ force 4 (+4 noise)`, `→ coax 2 pips`, `search: reveals 2`), opening animations per content,
  guardian arrival transition into the fight.
- Trip flow: map ↔ encounters/sites/campfire/placement; gate → end screen (dice nets, items, scars,
  daylight left, log). Lose screen. RESTART TRIP. Keep the M1 sequence reachable from the debug
  panel ("M1 sequence" vs "M2 map" start option).
- Debug additions: reveal whole map, set daylight / noise / scars, jump to any encounter or site,
  toggle "show site contents".

### V1-6 — M2 QA + learning report
- Verify every M2 acceptance item (plus a regression pass on M1) in the browser; fix bugs.
- Engine simulation of M2 trips with simple policies (cautious / greedy scavenger / fighter):
  trip length in moves and turns, win rate, scars, cold hits, items collected, beat vs befriend.
- Append an "M2 QA report": checklist with evidence, bugs fixed, balance, and observations for each
  of the 5 "What we want to learn" questions in DESIGN-V1.md.

---

## Phase notes
(append below)

### V1-1 notes (done — M1 engine)

**Built:** CONFIG rewritten to the §1 data model; ENGINE extended per §1–§3 (all specials, mods, shears, foresight queue,
item destruction/taking, watering-can pending SOW, seed-pouch rerolls, trip / reward / placement / heal / odds / stage
functions). `node tests/engine.test.mjs` → **52/52 green** (22 v0 tests updated + 30 new, incl. the exact string
`Situation: Look 2 (reveal) → Stab 4+2 (knife +1) → PRUNE 6` and a 60-seed full M1 trip simulation run twice for determinism).
The single-fight UI runs on the new engine (DOG, new kit): 3 full fights played in the browser, 0 console errors.
Engine-only greedy simulation (500 trips, best-of-6 arrangement, no rerolls, first-valid placement): 100 % complete, 0 scars,
~6.2 turns per trip — M1 is far too easy for a greedy player (same finding as v0); balance is for V1-3 QA.

#### State shapes
```
trip      = { dice:[{id,faces[6],idx,held}], player:{dice} /*same array*/, inventory:[itemId], discarded:[itemId],
              log:[str], sequence:['DOG','GARDENER','CAMPFIRE','CROWS'], stageIdx, stage:id|null,
              encounter:enc|null, results:[{enemyId,result,turns}], placement:null|{mode,fresh:['HAND:2',…]},
              over:null|'won'|'lost', result:null|'TRIP COMPLETE'|'YOU FLEE, SCARRED' }
encounter = { enemyId, enemy, player /*= trip.player, shared dice*/, turn, rerolls, rerollPenalty, rerollBonus,
              pendingSow, taken:[itemId], over:null|'won'|'lost', result:null|'BEATEN'|'BEFRIENDED'|lost text,
              log:[str] }            // + non-enumerable `trip` back-reference
enemy     = { id, name, logName, tags, pruneMod, sowMod, targetPriority, text, winText,
              faces:[{name, pips:['intact'|'broken'|'turned',…] /*variable length*/, hostile, effect}],
              current:{faceIdx,wag}, upcoming:[{faceIdx,wag}], shown:n, foresight:n, next:{faceIdx,wag}|null }
```
- `shown` = how many `upcoming` entries the player may see now (render `upcoming.slice(0, shown)` greyed, in order).
  `next` is derived (`upcoming[0]` while `shown>0`) — kept so the old single-fight UI works; V1-2 should use `upcoming/shown`.
- `foresight` = reveal depth earned this turn, consumed at the turn transition (then `shown = foresight`, else 0).
- `encounter` **is the "game state"** passed to `startTurn / rerollUnheld / resolveTurn / enemyAct` (it has `.player`,
  `.enemy`, `.rerolls`, …). `ui.game` in the UI is the encounter. Dice/scars/items live on `trip.dice` (so they persist).
- The encounter ends with `over:'won'` (result BEATEN/BEFRIENDED; pushes `{enemyId,result,turns}` to `trip.results`)
  or `'lost'` (also sets `trip.over='lost'`). The engine never advances the stage or claims rewards by itself.

#### Exported API (`globalThis.SmugEngine`)
| Function | Notes |
|---|---|
| `makeRng(seed)`, `parseFace(str)` → `{face,kind,verb,body,item}` | `HAND+WATERING_CAN` → body `HAND`, item `WATERING_CAN` |
| `scoreBodyFace(face, verb, ctx?)` → n; `scoreDetail(parsedFace, verb, ctx?)` → `{own, notes[], flags{}, depth}` | ctx `{enemy?, site?}` |
| `evaluateSentence(faces[3], ctx?)` | see below |
| `createPlayer()`, `currentFace(die)`, `rollDie(die,rng)`, `toggleHold(die)`, `countScars(player)` | unchanged |
| `rerollUnheld(enc, rng)` → ids \| null | unchanged |
| `createEnemy(id, rng?)` | `createEnemy(rng)` still works (→ singleFight id) |
| `faceStatus`, `isResolved(face)`, `isHostile(face)` (= `face.hostile`) | |
| `applyVerb(enemy, verb, amount, {alternate:n}?)` → pip / faceResolved events | `alternate`: first n points alternate over the first two eligible faces (SHEARS), pip events then carry `shears:true` |
| `rollIntent(enemy, rng)`, `enemyAct(enc, rng)` → `{events, rerollPenalty}`, `checkWin(enemy)`, `checkLose(player)` (≥ `maxScars`) | |
| `createTrip(rng, sequence?)`, `tripScars(trip)` | |
| `startEncounter(trip, enemyId, rng)` → encounter (sets `trip.encounter`; resets rerolls/penalty/bonus/pendingSow/taken) | |
| `createGame(rng)` | v0 convenience = `startEncounter(createTrip(rng), CONFIG.trip.singleFight, rng)` |
| `startTurn(enc, rng)` → **`{rerolls, events, over, result}`** (was a number in v0) | applies pending watering-can SOW first; if that wins, `over:'won'` and the dice are **not** rolled |
| `resolveTurn(enc, slotOrder, rng)` → `{events, log, over, result, evaluation}` | slotOrder = 3 die ids or indices |
| `rewardsFor(trip, result)` → `{ending:'beaten'\|'befriended', choose:[ids]\|null, give:[ids], returned:[ids], revealTiles}` | pure; `returned` = `encounter.taken` only if BEATEN and `returnTaken` |
| `claimReward(trip, result, pick?)` → `{ok, added:[ids], reason?}` | adds returned + give (+ `pick` if `choose`; `ok:false,'pick-required'` if pick not offered) to the inventory, clears `taken` |
| `addToInventory(trip, itemId)` | |
| `beginPlacement(trip, 'reward'\|'campfire')`, `endPlacement(trip)` | `trip.placement.fresh` = faces filled during this screen (movable in reward mode) |
| `canPlace(trip, itemId, dieId, faceIdx, mode)` → `{ok, reason, replaces:itemId\|null}` | reasons: `unknown-item, not-an-item-die, no-face, scar, wrong-part`; does not check the inventory. `replaces` ≠ null → UI shows "replace? discard X" |
| `isLocked(trip, dieId, faceIdx, mode)` | true for an item on a face in reward mode that wasn't placed during this screen |
| `placeItem(trip, itemId, dieId, faceIdx, mode)` → `{ok, replaced, reason}` | takes the item from the inventory; replaced item goes to `trip.discarded`. Extra reason `not-in-inventory`. **No confirmation inside the engine** — the UI confirms via `canPlace().replaces` first |
| `moveItem(trip, fromDie, fromIdx, toDie, toIdx, mode)` → `{ok, replaced, reason}` | reason `locked` / `no-item` / canPlace reasons |
| `unplaceItem(trip, dieId, faceIdx, mode)` → `{ok, item, reason}` | item goes back to `trip.inventory`; reward mode only for fresh items |
| `healScar(trip, dieId, faceIdx)` → `{ok, restored:'HAND'\|…, reason}` | face becomes the bare original part, item not restored |
| `oddsSummary(die)` → `{text, parts:{PART:{count,items:{ID:n}}}, bare, scar, itemFaces, total}` | text e.g. `HAND · 1× KNIFE · 5× bare · 0× scar → item 1/6`, `EYE 3 (1× GLASSES) · MOUTH 3 (0 items) · scar 0/6`; templates in `CONFIG.odds` |
| `isCampfire(stageId)`, `advanceStage(trip)` → next stage id \| `null` | past the last stage: `trip.over='won'`, `result='TRIP COMPLETE'`; clears `encounter` and `placement` |

**Typical M1 flow for V1-2:** `trip=createTrip(rng)` → for `trip.stage`: encounter id → `enc=startEncounter(trip,id,rng)`; loop
`startTurn` → (UI: reroll/arrange) → `resolveTurn`; on `enc.over==='won'` → `rewardsFor` → UI pick → `claimReward` →
`beginPlacement(trip,'reward')` … `endPlacement` → `advanceStage`. Campfire: either `healScar` (one face) or
`beginPlacement(trip,'campfire')` free `moveItem/unplaceItem/placeItem`; then `advanceStage`. On `enc.over==='lost'` / `trip.over==='lost'` show the lose screen.

#### `evaluateSentence(faces, ctx)` → 
`{shape, mindIndex, verb, steps[], totals:{PRUNE,SOW} /*after mods*/, order[], reveal, revealDepth, mods:{VERB:{mod,before,after,source}},
shears /*points of the SHEARS die(s), ≤ PRUNE total*/, seeds:bool, pendingSow:n, totalsText, text}`.
Step = v0 fields `{slot,face,role,verb,base,carryIn,total,reveal,passesTo,name}` + `item` (id|null), `notes:[str]`
(annotations shown in text, e.g. `knife +1`), `depth` (DIG steps: intents revealed). `ctx.enemy` supplies tags + mods;
`ctx.site:true` = scavenge-site mode (no mods, no whistle, SPADE annotated `reveals all`). Without ctx: no mods, no whistle.
Text rules: `<Name> <base>[+carry][ (reveal)][ (note)…]`; totals `PRUNE 5 (gardener −1)`; a verb clamped to 0 still shows
(`SOW 0 (crows −2)`); a verb not produced by the sentence gets no mod (and no entry).

#### Events
`resolveTurn` (ordered): 
1. `sentence {slotOrder, faces, evaluation, text}`
2. `step {index, step}` per body die
3. per damage verb in sentence order: optional `mod {verb, mod, before, after, source}`; then (if total>0) `verb {verb, amount, shears}` followed by
   `pip {faceIdx, pipIdx, to, verb, shears?}` and `faceResolved {faceIdx, resolved}`
4. `reveal {next, face, rerolled, depth, list:[{intent,face}]}` — DIG (depth 1, or 2 with GLASSES), or a visible queue entry was rerolled because its face broke
5. either `win {result}` (no enemy act; no 6/7) **or** (before the act) `pendingSow {phase:'queued', amount, total}` (watering can) and
   `rerollBonus {amount, total, source:'SEED_POUCH'}` (turned faces ≥ 1 with a seed pouch SOW), then
6. `enemyAct {intent, face, skipped, reason:null|'wag'|'broken', effect:null|'scar'|'rerollPenalty'|'takeItem'|'none', anim:'bite'|'growl'|…|'wag'|'broken', text, rerollPenalty?, nothing?}`
   followed by: `scar {dieId,faceIdx,previous,wasCurrent}` then (if the face had an item) `itemDestroyed {dieId,faceIdx,item,cause:'scar',by:faceName,wasCurrent}`;
   or `itemTaken {dieId,faceIdx,item,previous,becomes,by:faceName,enemy,wasCurrent}` (SNIP / STEAL; `nothing:true` + text `noItem` on `enemyAct` when no item is placed)
7. `lose {scars}` (terminal; also `trip.over='lost'`) **or** `newIntent {intent, face, next, nextFace, list:[{intent,face}]}` (`list` = the greyed queue for the coming turn, 0–2 entries)

`startTurn` events: `pendingSow {phase:'applied', amount}`, then `pip`/`faceResolved`, then `win {result}` if that finished the enemy.
Log lines: `T1: EYE [PRUNE] HAND+KNIFE → PRUNE 6, broke GROWL, broke BITE, broke BITE; dog is too hurt to act`; extras after the broke list:
`, watering can: +1 SOW next turn`, `, seeds: +2 reroll next turn`; tails: `dog bites (HAND HAND+KNIFE → SCAR), KNIFE destroyed by the bite`,
`gardener snips an item off your dice (HAND HAND+KNIFE → HAND)`, start of turn `T2: watering can: SOW 1[, turned X][; BEFRIENDED]`, campfire `campfire: healed HAND face 1 → HAND`.
`trip.log` accumulates every encounter log line plus heal lines.

#### CONFIG additions / changes
- Removed: `scarsToLose`, `pipsPerEnemyFace`, `enemy`, `items` (array), `text.wonBeaten/wonBefriended`, `actionNames` item rows.
- New: `maxScars: 6`, `modKey`, `itemDice: ['HAND','HEAD']`, `items{ID:{name,part,names,special,info}}` (8), `itemRules{knifePruneBonus, glassesRevealDepth,
  defaultRevealDepth, whistleMultiplier, whistleTag, wateringCanSow, seedPouchRerollPerTurned}`, `enemies{DOG,GARDENER,CROWS}`
  (`name, logName, tags, pruneMod, sowMod, faces[{name,pips,hostile,effect}], targetPriority, text, rewards, winText`),
  `trip{m1, campfireId, singleFight, healPerCampfire}`, `verbInfo`, `notes` (annotation templates), `odds` (summary templates),
  `text.tripComplete`; `colors.verb` (PRUNE red / SOW blue / DIG amber), `colors.body` (bone/clay/sand), `colors.item` (8 purples),
  `colors.enemy` extended for the new faces.
- `playerDice`: HAND `HAND+KNIFE` + 5 bare; HEAD `EYE+GLASSES`, 2 EYE, 3 MOUTH.

#### UI / FX / DEBUG edits (minimal)
`C.enemy*` → `C.enemies[singleFight]` / `game.enemy`; scar boxes use `maxScars` (6, fits the top bar); preview passes `{enemy}`; win subtitle
from `enemy.winText`; enemy snapshots carry `hostile`; FX enemy-act animations key off `ev.anim` (was `ev.effect`); debug reset enemy uses
`game.enemyId`; debug CLEAR SCARS now restores scars to bare parts (items are not resurrected); `onRoll` handles `startTurn().over`.
No new screens. NB V1-2: FX has animations only for `bite/growl/sniff/whimper` — new faces (`snip, boast, haggle, peck, caw, steal, circle`) fall through silently.

#### Deviations / decisions
- Enemy face state has extra `hostile` and `effect` fields (spec: `{name,pips}`) so `isHostile` needs no enemy lookup.
- `startTurn` now returns `{rerolls, events, over, result}` instead of a number (needed for the watering-can events/win).
- `resolveTurn`/`startTurn` take the **encounter**, not the trip (v0 call shape preserved); `createGame` returns an encounter.
- `ev.effect` on `enemyAct` is now the config effect (`scar/rerollPenalty/takeItem/none`); the animation key is `ev.anim`.
- BEATEN/BEFRIENDED majority counts **resolved hostile faces only** (spec §2); v0 counted all faces, which could differ only for non-hostile faces that got resolved — they are never targeted, so identical in practice.
- `reveal` is re-announced only when the queue is *visible* and one of its entries was rerolled; a hidden leftover queue (depth-2 turn after next) is silently refreshed.
- With depth 2 the queue holds intents for turns +1 and +2; during the following turn the player sees `current` plus 2 greyed (the same top-up rule as v0 depth 1).
- `claimReward` convenience added (not in the plan list). `placeItem` has no built-in confirmation; replace is decided by the UI.
- SHEARS on a site: `evaluation.shears` is exposed for V1-4's "no noise" rule; nothing site-specific is applied in V1-1 beyond `ctx.site` annotations.
- Mods apply to the whole PRUNE/SOW total; if a negative mod shrinks it below the shears die's points the shears share is clamped (`min(shears, total)`).

### V1-2 notes (done — M1 encounter UI + trip flow)

**Built** (all in `index.html`; engine untouched, `node tests/engine.test.mjs` still 52/52):
- Trip state machine in the UI: `ui.screen` = `encounter | reward | placement | campfire | end`; `ui.phase` additionally has `'start'`
  (watering-can SOW playing before the dice roll) and `'screen'` (any non-encounter screen). `enterStage()` starts the trip's current stage
  (encounter → `E.startEncounter`, campfire → campfire screen, `trip.over` → end). Encounter won → overlay (BEATEN/BEFRIENDED + CONTINUE) →
  `onContinue()` → reward screen → `claimAndPlace(pick)` (`E.claimReward` + `openPlacement('reward')`) → DONE (`closePlacement()` =
  `endPlacement` + `advanceStage` + `enterStage`). Lose (from any encounter, incl. debug) → overlay → end screen (lost). RESTART TRIP (button in
  the encounter controls and on the end screen) = brand-new `createTrip`.
- Top bar: stage indicator (`CONFIG.trip.stageLabels`; current underlined, done struck), turn, `ITEMS n`, scar boxes ×`maxScars` + `n/6`, DEBUG.
- Encounter screen for any enemy: `buildEnemyPanel()` rebuilds label, tag chips, `PRUNE −1 · SOW +1` (verb coloured, tooltipped), bag/nest
  (only for enemies with a `takeItem` face; label from `CONFIG.text.bagLabel`), and the 6 face cards with variable pip counts.
  Foresight queue: `view.enemy.queue` (from `reveal.list` / `newIntent.list`), cards tagged NOW / NEXT / THEN, greyed queue row under the intent.
- New EVENT_HANDLERS: `mod`, `itemTaken`, `itemDestroyed`, `pendingSow` (`applied` plays in the `'start'` phase before the dice roll, `queued`
  is a beat), `rerollBonus`. FX wrappers: `itemTaken` (item name tile flies from the die to the bag/nest, bag pulses), `itemDestroyed` (tile
  splits into two halves that fall), `mod` (pop + floating `GARDENER −1`), `pendingSow` (blue +1 flies to the target face / "+1 SOW NEXT TURN"),
  `rerollBonus` ("+n REROLL" at the REROLL button), plus `enemyAct` animations for `snip, boast, haggle, peck, caw, steal, circle`.
- Preview: engine text rendered with `verbify()` (PRUNE/SOW/DIG coloured + `title` tooltip from `CONFIG.verbInfo`); shape line uses item names;
  all tiles carry `title` tooltips (verb info, item info, favourite verb); dice hover popover also lists the current face's verb/item info.
  Status line next to the buttons shows `−1 reroll this turn`, `+n reroll (seeds)`, `+1 SOW at turn start (watering can)`.
- Reward screen: big item cards (part + item tile, info, 3 verb names in verb colours), "CHOOSE ONE" (click = pick, 0.5 s pop, then placement),
  "YOU GET" (+ TAKE), "RETURNED TO YOU" (taken items on BEATEN), "GONE FOR GOOD" (taken items on BEFRIENDED).
- Campfire screen: two big tiles; HEAL 1 SCAR (off when no scars) → die lists with clickable scar faces → `E.healScar` → HEALED flourish → next
  stage after 650 ms; REARRANGE → `openPlacement('campfire')`.
- End screen (won/lost): per-encounter result + turns, `FLED at turn n` on loss, scars n/6, leftover inventory, final dice as simple face lists
  (MIND/HAND/HEAD), scrollable full trip log, RESTART TRIP.
- Debug drawer: existing controls kept (face select, rerolls, intent — now per current enemy, RESET ENEMY, CLEAR SCARS, show-all-pips) + TRIP
  section: give item (select + GIVE), jump to DOG/GARDENER/CAMPFIRE/CROWS (GO), WIN: BEATEN / BEFRIENDED, +1 SCAR, SCARS = MAX−1, FORCE LOSE.
  Console API `SmugDebug.giveItem/jumpTo/addScars/forceLose/forceWin`.

**Placement stub / what V1-3 must replace:**
- Entry point: `SmugUI.openPlacement(mode)` with `mode` `'reward' | 'campfire'` (calls `E.beginPlacement`, sets `ui.screen='placement'`); exit
  `SmugUI.closePlacement()` (DONE → `endPlacement`, `advanceStage`, `enterStage`). Both are in the UI IIFE and exposed on `window.SmugUI`.
- The stub is `SCREENS.placement(root)` (rendered into `#screen`; `#screen` clicks go through `onScreenClick` and `data-act` attributes:
  `place` = put the first inventory item of that id on the first bare valid face; `unplace` = `E.unplaceItem`; `done`). V1-3 replaces
  `SCREENS.placement` (and the `place` / `unplace` branches of `onScreenClick`) with the die-net screen using `E.canPlace / placeItem /
  moveItem / unplaceItem / isLocked / oddsSummary`; `mode` is `ui.placementMode`. Keep `openPlacement` / `closePlacement` and `ui.screen`.
- The campfire heal view (`SCREENS.campfire` with `ui.healing`) and the end screen use `diceListHTML()` (simple face lists): V1-3 can swap
  that helper for the real nets ("Reuse it for the campfire heal choice" per §5).
- Hooks added to `SmugUI.hooks`: `onScreen(name, root)` (called when the screen / placement mode / heal state changes), `onPick(el)`, `onHeal(dieId, idx)`.
  Screen entrances use the CSS `.pop-in` class (one shot; stripped on re-render of the same screen).
- `SmugUI` additions: `trip`, `SCREENS`, `enterStage`, `openPlacement`, `closePlacement`, `showEnd`, `onContinue`, `buildEnemyPanel`, `jumpTo`,
  `giveItem`, `forceWin`, `addScars`, `forceLose`, `itemTileHTML`.

**New CONFIG** (data only): `trip.stageLabels`, `text.s` (screen strings), `text.bagLabel`, `text.then`, `text.bonusStatus/sowStatus/modFlash/...`,
`buttons.restart = 'RESTART TRIP'`, `buttons.continue`. Item colours already existed. Removed from the DOM: `#nextTile`, `#nextText`
(queue is rendered into `#nextWrap`).

**Verified in the browser** (1280×720, no scrolling, 0 console errors): a real full M1 sequence DOG → GARDENER → FIRE → CROWS to TRIP COMPLETE;
a natural loss (bite at 5/6 scars) and FORCE LOSE → lose screen → RESTART TRIP; SNIP (GLASSES flew to the bag, `GLASSES TAKEN`) and STEAL
(WATERING CAN → nest); beaten gardener returned the snipped GLASSES + SHEARS on the reward screen; a bite destroyed KNIFE (break animation,
`KNIFE destroyed by the bite`); watering can (queued → status line → applied at the next ROLL with the blue +1 fly and `turned CAW`); seed
pouch (`+1 reroll (seeds)` status); glasses depth-2 queue (NEXT + THEN); crows' `SOW −2` shown in the enemy panel and in the preview
(`SOW 2 (crows −2)`); gardener `+1 SOW`; campfire HEAL (clicked a scar face) and REARRANGE (stub in campfire mode).

**Known issues / notes:**
- The placement screen is the stub (inventory list with a PLACE button that picks the first bare valid face; no replace flow, no drag).
- Won encounters show a CONTINUE overlay before the reward screen (one extra click; the result is also the reward screen's heading).
- After a turn, the preview line keeps the last committed sentence while waiting for ROLL (v0 behaviour).
- The long preview (`Plan: Water their plant 2 (+1 SOW next turn) · Call softly 6 (whistle ×2) → SOW 6 (crows −2)`) may wrap to two lines
  (max-width 1200); still fits above the dice.
- Debug "jump" keeps the existing trip log/results/inventory; "WIN" is a UI-level shortcut (engine invariants preserved: result pushed to `trip.results`).
- Browser verification used scripted clicks plus the debug drawer for deterministic setups (the sentence arrangement was set via `ui.slots`).

### V1-3 notes + M1 QA report (done — placement screen + M1 QA)

**Built** (all in `index.html`; engine untouched, `node tests/engine.test.mjs` still 52/52; no engine bugs found):
- **Placement screen** (`SCREENS.placement`, entered only via `openPlacement(mode)`, left via `closePlacement()` — unchanged API): HAND and HEAD as
  cross-shaped nets (`netHTML(dieId, {mode:'place'|'heal'|'view', mini})`, 4×3 CSS grid, face idx 0 top, 1–4 middle row, 5 bottom, small
  face numbers), each face = body-part tile + item tile (or a dashed `ITEM` slot), scar faces as a SCAR tile. Inventory tray under the nets,
  DONE button. Locked items (reward mode, `E.isLocked`) are dimmed with a 🔒; items placed on this screen carry a `NEW` tag and a lit outline
  (= movable until DONE). Odds line under each net = `E.oddsSummary(die).text` (CONFIG.odds templates), recomputed on every render **and
  shown hypothetically while dragging** (yellow `.odds.hyp` for "if you drop here").
- **Drag** with Pointer Events (delegated `pointerdown` on `#screen`, `window` move/up): items from the tray or from a movable face; a ghost
  tile follows the pointer; while dragging every face gets `valid` (green; `E.canPlace().ok`, locked/occupied faces included) or `invalid`
  (dimmed; wrong part / scar), the face under the pointer lights up. Drop on a valid face → `tryPlace` → `E.placeItem` / `E.moveItem`; drop
  on the tray → `E.unplaceItem` (engine decides which are allowed: campfire all, reward only fresh); invalid face → that face shakes and the ghost
  springs back to its origin; outside → springs back. `< dragThresholdPx` = click: **click an item, then click a face** works too
  (selected item outlines, valid faces outlined; click a face / the tray / empty space). Clicking a locked item shakes its face.
- **Replace confirmation**: dropping on an occupied face (`canPlace().replaces`) opens a modal tile `REPLACE? — [OLD] DISCARD OLD — to place
  [NEW]` with `YES, DISCARD` / `CANCEL`; only YES calls the engine. Old tile breaks in two halves + `X DISCARDED`.
- **Hover** a net face (placement, campfire heal, end screen) → `#pop` shows `DIE · face n`, its 3 verb names with points
  (`E.scoreBodyFace`) in verb colours, favourite verb + item, and the item's special text; scar faces explain themselves.
- **Juice** (all reactions): one-shot 3-D flip of the net (520 ms) when an item lands, squash-and-stretch of the item tile (CONFIG.fx.squash),
  sparks in the item colour, invalid shake (`.rej`), ghost return with overshoot, tray pulse on un-place. No idle motion; reduced-motion respected.
- **Campfire heal** now uses real nets (scar faces highlighted & clickable, `E.healScar`). **End screen** shows the MIND face row + HAND/HEAD
  mini nets side by side with odds; fits 1280×720 (button bottom 636 px).
- `diceListHTML` removed (`mindRowHTML` replaces it for MIND). New CONFIG strings under `text.s` (`replace*`, `slotEmpty`, `lockedTip`,
  `scarTip`, `faceN`, `trayDrop`, …). New hooks in `SmugUI.hooks`: `onPlace(dieId, idx, item, replaced)`, `onUnplace`, `onReject(el)`,
  `onDragItem(ghost)`, `onItemReturn(ghost, from, done)`; `SmugUI.tryPlace(src, dieId, idx)` (`src = {kind:'inv',item}|{kind:'face',item,die,idx}`)
  and `SmugUI.netHTML` exposed for debug/tests. `#pop` z-index 40 → 58 (it must sit above `#screen`).
- Inventory row scrolls (max 96 px) instead of overflowing when a debug user gives 17 items.

**Deviations / notes**
- Face order on a net is just face index order (a fold layout has no gameplay meaning: faces of one part are interchangeable).
- Locked faces are valid drop targets (per §3: replace confirmation) — they highlight green while dragging, as does any matching face.
- Placing is immediate (engine state changes on drop); there is no "undo" besides dragging a fresh item back to the tray (reward) or any item (campfire).

#### M1 QA — acceptance checklist (DESIGN-V1.md, M1)
| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | 3-fight sequence playable to the end, reward → placement after each win, one campfire | ✅ | UI-driven bot (real DOM clicks on ROLL / COMMIT / CONTINUE / reward cards / DONE / HEAL) ran DOG→reward→placement→GARDENER→reward→placement→campfire(heal)→placement(campfire)→CROWS→reward→placement→TRIP COMPLETE, twice; stage strip, scars, ITEMS count update; 0 console errors |
| 2a | Items placeable only on matching, non-scarred faces | ✅ | real pointer drag of WHISTLE onto a HAND face: rejected, state unchanged, ghost returned, face shook; SCAR faces are dimmed `invalid`; engine `canPlace` tests (V1-1) |
| 2b | Replace discards the old item **with confirmation** | ✅ | real drag of WATERING CAN onto locked KNIFE → `REPLACE?` tile; CANCEL → nothing changed (`discarded:[]`); LANTERN onto GLASSES (campfire) → YES → `trip.discarded:['GLASSES']`, face holds LANTERN |
| 2c | Reward mode: existing placements locked; unplaced items stay | ✅ | 🔒 on KNIFE/GLASSES, no `data-drag` on them; fresh SHEARS draggable back to the tray (`inv` regained it); leftover items remain in the inventory after DONE |
| 2d | Campfire: move freely, back to inventory | ✅ | real drags: KNIFE face 1 → face 5; item → tray (`unplaceItem`) |
| 3a | A scar destroys the item on that face | ✅ | V1-2 browser run (KNIFE destroyed by the bite, break animation, log) + engine test; in this session the heal view showed LANTERN gone after a scar (`addScars`) |
| 3b | SNIP/STEAL remove an item; BEATEN returns it | ✅ | gardener SNIP took GLASSES (bag `["GLASSES"]`, face → bare EYE); `forceWin('BEATEN')` → reward screen "RETURNED TO YOU: GLASSES" + SHEARS → TAKE → placement tray `[GLASSES, SHEARS]`; click-select GLASSES → EYE face placed. BEFRIENDED = "GONE FOR GOOD" (V1-2 + engine test) |
| 4 | Every item special works and shows in the preview | ✅ | live previews (arranging phase): `Stab 4 (knife +1)` · `Snip 3 (shears split)` · `Dig 2 (reveal)` (spade silent in fights) · `Water their plant 2 (+1 SOW next turn)` · `Give seeds 2 (seeds)` · `Read closely 3+1 (reveal) (sees 2)` · `Dazzle 3 (lantern)` · `Call softly 6 (whistle ×2)` vs dog (→ SOW 7), and `→ SOW 5 (crows −2)` vs crows (whistle ×2 applies before the mod). Behaviour per item covered by V1-1 tests |
| 5 | pruneMod / sowMod change totals | ✅ | `PRUNE 2 (gardener −1)`, `SOW 4 (gardener +1)`, `SOW 1 (crows −2)`; enemy panel shows `PRUNE −1 · SOW +1` / `PRUNE +1 · SOW −2` |
| 6 | Odds summary updates live during placement | ✅ | mid-drag state via pointer events: `HAND · 1× KNIFE · 1× SHEARS · 4× bare · 0× scar → item 2/6` shown (`.hyp`) before the drop; after drop the same text without `.hyp`; tray-drop previews the die without the item |
| – | One screen 1280×720, no scrolling, 0 console errors | ✅ | #screen scrollHeight = clientHeight on placement / campfire / heal / end (normal inventories); console clean over two full trips |
| – | Hover face → 3 verb names with points | ✅ | tooltip e.g. `PRUNE Snip 3 · SOW Offer to trim 2 · DIG Cut open 2` |

**Bugs found & fixed in this phase** (all new-UI, none in the engine): end screen overflowed 1280×720 by ~110 px with stacked nets → nets side by side;
results lines wrapped when the inventory tiles were allowed to wrap (wrap now only on the inventory line); `#pop` was hidden under `#screen`
(z-index); invalid-drop expression simplified. No engine change was needed.

#### M1 balance (engine simulation; script kept outside the repo: `side-session-notes/…/sim-m1.mjs`)
1000 seeded trips per policy; "good" policies pick the best of the 6 sentence orders and reroll with a Monte-Carlo hold choice; picks by item
preference; items are placed on the first bare valid face; campfire heals a scar if any.

| Policy | Win rate | Scars (mean) | Turns/trip | DOG t | GARDENER t | CROWS t | Beaten / befriended (D · G · C) |
|---|---|---|---|---|---|---|---|
| fighter (PRUNE-weighted, KNIFE/SHEARS/SPADE picks) | 100 % | 0.00 | 5.6 | 2.4 | 2.2 | 1.1 | 100/0 · 98/2 · 100/0 % beaten |
| talker (SOW-weighted, WHISTLE/POUCH/CAN picks) | 100 % | 0.00 | 6.5 | 2.9 | 2.1 | 1.6 | 10/90 · 2/98 · 36/64 % beaten/befriended |
| adaptive (max PRUNE+SOW) | 100 % | 0.00 | 5.4 | 2.3 | 2.0 | 1.0 | 100/0 · 22/78 · 92/8 |
| lazy (best order of first roll, never rerolls) | 100 % | 0.00 | 6.1 | 2.7 | 2.2 | 1.3 | 100/0 · 28/72 · 91/9 |
| novice (random order, no rerolls, random picks) | 100 % | 0.10 | 9.1 | 3.8 | 3.2 | 2.1 | 65/35 · 34/66 · 81/19 |

- **M1 is far too easy**: not one loss in 5000 trips; even a random-order novice averages 0.1 scars (max 3). With `maxScars 6` the lose
  condition is unreachable; the whole trip is ~5–6 turns.
- Sensitivity (adaptive / novice): enemy pips ×2 → 100 % / 100 % (novice 0.4 scars, 18 turns); ×3 → 100 % / 97 % (novice 1.3 scars, 29 turns,
  items taken 2.7/trip); ×3 with `maxScars 4` → 100 % / 89 %. A competent player still takes ~0 scars even at ×3: the engine spends damage on
  the *current intent first*, so the face that would hurt you is usually the first thing broken.
- Item use: 40–70 % of turns contain ≥ 1 item face, but it is almost always the starting KNIFE (37–39 % of turns) or GLASSES (22–29 %); newly won
  items appear in 0–19 % of turns (WHISTLE 17–19 % for the talker, WATERING CAN/SHEARS/SEED POUCH ≤ 6 %). Trips end before late items get a roll.
- Scars/item loss is rare (0.0–0.04 items destroyed per trip for good play); SNIP/STEAL takes ~0.0–0.4 items per trip (novice 0.3), ×3 pips 1–2.7.

#### Observations for "What we want to learn"
1. **Does placing items create real choices?** Not yet. After 3 rewards a player holds 5 items on 12 faces; every bare face of a die is
   interchangeable, so *which* face is arbitrary and only *which die* matters (HAND vs HEAD, fixed by the item's part). An item has a 1/6
   chance of showing per die regardless of its neighbours — "stack knives vs spread" does not exist with one knife in the kit, and there is no
   face pressure (6 faces per die vs ≤ 3 items per die). The only real tension seen: replace-vs-keep never arises, and the reward pick (which
   of two items) is the decision. To make placement matter: scarcity of faces (fewer item faces, more scars, or faces that already have a
   different rule), duplicate items (stack effects), or items whose value depends on neighbours. M2's scavenging (more items per trip) is the
   first thing that can create face pressure.
2. **Do specials make builds feel different?** Mechanically yes at the sentence level (previews are rich and clearly different), but in
   practice a build is dominated by the starting KNIFE/GLASSES and by the single reward pick; fights end in 1–3 turns so most acquired items
   are seen 0–2 times. The fighter/talker split is real (90 % vs 0 % befriends on the dog) — the clearest "build" signal is
   WHISTLE (talker) vs KNIFE/SPADE (fighter), plus the gardener/crows mods pushing the other way.
5. **Beat vs befriend by reward?** The player can steer the ending deliberately (talker 90/98/64 % befriend, fighter ≤ 2 % on all but crows)
   and the reward lists differ enough to matter (dog: SPADE vs WHISTLE/LANTERN; gardener: SHEARS + returns vs POUCH/CAN; crows: LANTERN vs
   GLASSES/KNIFE). The reward is generous on both sides, so there's little cost to "just win and take what's offered"; the adaptive policy
   that ignores the reward lands wherever the dice go (gardener 78 % befriend because of +1 SOW, crows 92 % beaten because of +1 PRUNE).
   The enemy mods are doing the steering — the crows really are hard to talk to (talker only gets 64 % even with WHISTLE ×2).

**Suggested balance levers before M2** (not applied): enemy pips ×2–3, fewer `maxScars` (3–4), or let some enemy intents bypass
"target the current intent first"; consider 2 rewards per fight or a tighter face budget so placement bites.

**Known issues**
- The net flip animates the whole net container (3-D `rotateY`), which is cosmetic; Safari/Firefox untested.
- Screenshots in the QA were taken at an emulated 1280×720; the real-pointer drags used the browser tool's `left_click_drag`
  (mouse-down → move → up), the mid-drag state was verified with dispatched `PointerEvent`s.
- Touch-only dragging is untested (`touch-action:none` set on draggable items).

### V1-4 notes (done — M2 engine: map + sites, no UI)

**Built** (all inside CONFIG / ENGINE of `index.html`; UI untouched). `node tests/engine.test.mjs` → **85/85 green** (52 old + 33 new: map
generation/guarantees, fog, moves, daylight, cold + lose, tile entry, tile resolution, dog reveal, every site rule, guardian, LEAVE, previews,
a seeded 80-trip full M2 simulation run twice for determinism). Browser: page loads, an M1 dog fight played to BEATEN through the real
buttons, 0 console errors. M1 flow is unchanged (`createTrip(rng)` / `advanceStage` behave exactly as before for `mode:'m1'`).

#### CONFIG additions
```
map:   { cols:6, rows:4, daylight:12, daylightPerMove:1, coldScarsPerMove:1, startRow:null /*=floor((rows-1)/2)*/, campfireCols:[1,3],
         weights:{CHARACTER:35,SCAVENGE:30,CAMPFIRE:10,EMPTY:25}, gateVisible:false,
         words:{FOG:'?',START:'START',GATE:'GATE',CAMPFIRE:'FIRE',EMPTY:'EMPTY'}, enemyWords:{DOG:'DOG',GARDENER:'GARDENER',CROWS:'CROWS'},
         typeNames:{…}, text:{cold:'THE COLD', coldLog:'the cold bites', revealed:'shows you the way'} }
noiseMax: 6
siteRules: { overkill:2, pruneNoisePerPoint:1, turnNoise:1, ratsNoise:2, ratsScars:1, trapScars:1, sowDivisor:2, sowMin:1, shuffleFaces:true }
sites: { HEAP|SHED|WELL: { name:'COMPOST HEAP'|…, word:'HEAP'|…, faces:[6 contents], pips, pool:[itemIds], guardian:enemyId } }   // per the spec table
siteContents: { ITEM|JUNK|NOTHING|RATS|TRAP: { label, info } }
trip:  + mapStage:'MAP', siteStage:'SITE'
text.site: { force:'force {n} (+{noise} noise)', forceQuiet:'force {n} (no noise)', coax:'coax {n} pips', search:'search: reveals {n}',
             searchAll:'search: reveals all', nothing, left:'LEFT', guardian:'GUARDIAN', noise:'NOISE' }
```
The dog's `rewards.befriended.revealTiles: 4` already existed and is now honoured in M2 (data-driven). Words are keyed by enemy id /
site id, so adding an enemy or site is data only.

#### State shapes
```
trip (M2 extras) = { mode:'m2', map, daylight, moves, coldHits, site:site|null, sequence:[], stage:'MAP'|'SITE'|'CAMPFIRE'|enemyId|null,
                     results:[ {enemyId,result,turns} | {kind:'site', siteId, result:'LEFT'|'GUARDIAN', turns, gained:[ids]} ] }
                   // M1 trips have mode:'m1' and no map; everything else is as in V1-1
map  = { cols, rows, tiles[row][col], start:{c,r}, gate:{c,r}, pos:{c,r} }
tile = { c, r, type:'START'|'GATE'|'CHARACTER'|'SCAVENGE'|'CAMPFIRE'|'EMPTY', origin /*type at generation*/, enemyId|null, siteId|null,
         visited:bool, revealed:bool /*dog reveal*/ }
mapView(trip) → rows of cells { c, r, visible, visited, revealed, here, reachable, type|null, word, enemyId|null, siteId|null }
               // fogged cells: type/enemyId/siteId null, word = CONFIG.map.words.FOG; word of visible tiles is DOG / HEAP / FIRE / EMPTY / START / GATE …
site = { siteId, name, word, at:{c,r}|null, faces:[{content:'ITEM'|'JUNK'|'NOTHING'|'RATS'|'TRAP', item:id|null, pips, pipsLeft,
         revealed, opened, brokenItem:id|null}], noise, noiseMax, turn, rerolls, rerollPenalty, rerollBonus, pendingSow, player, target:idx|null,
         gained:[itemIds], guardian:enemyId, over:null|'left'|'guardian'|'lost', log:[] }   // + hidden `trip`
```
`site` has the same dice fields as an encounter, so `E.startTurn(site, rng)` (= `startSiteTurn`) and `E.rerollUnheld(site, rng)` work.

#### Exported API (new, on `SmugEngine`)
| Function | Notes |
|---|---|
| `createTrip(rng, 'm2')` / `createTripM2(rng)` | M2 trip: map generated, daylight 12, stage `'MAP'`, `mode:'m2'` |
| `generateMap(rng)`, `mapHasPath(map)` | rng order: gate row, then each tile row-major (type, then enemy/site id), then the campfire fix |
| `mapView(trip)`, `tileWord(tile)`, `isVisible(map, tile)`, `legalMoves(trip)` → `[{c,r}]` | `legalMoves` is `[]` unless `trip.stage==='MAP'` and not over |
| `moveTo(trip, c, r, rng)` → `{ok, reason, events, entered:{tile,enemyId,siteId}\|null, over, result, encounter, site}` | reasons `no-map, over, not-on-map, out-of-bounds, not-adjacent`. Starts the encounter / site itself |
| `advanceStage(trip)` (M2: = `finishTile`) → `'MAP'` \| `null` | resolved tile → EMPTY, `trip.site/encounter/placement` cleared, stage back to `'MAP'`. Call after reward placement / campfire / site LEAVE |
| `revealTiles(trip, n, rng)` → `[{c,r}]` | reveals n random fogged tiles |
| `claimReward(trip, result, pick, rng?)` → `{ok, added, revealed}` | NEW 4th arg `rng`; M2 + `revealTiles` → reveals fogged tiles (without rng: first fogged tiles in map order). Pass the rng from V1-5! |
| `startSite(trip, siteId, rng, at?)` → site | sets `trip.site`, `trip.stage='SITE'` (also for debug jumps; no map needed) |
| `setSiteTarget(site, idx\|null)` → `{ok,target,reason}` | reason `no-face`, `opened`; target also clears itself when that face opens |
| `sitePreview(site, evaluation)` → `{reveal:0\|n\|'all', prune:{points,quiet,noise}\|null, sow:{points,pips}\|null, text}` | pure; for the live preview; evaluate with `E.evaluateSentence(faces, {site:true})` |
| `startSiteTurn(site, rng)` | = `startTurn` (rolls dice, `rerolls = rerollsPerTurn`) |
| `resolveSiteTurn(site, slotOrder, rng)` → `{ok, reason, events, log, over, guardian:enemyId\|null, evaluation, preview, opened:[faceIdx]}` | reasons `site-over`, `nothing-left`. On `guardian` the encounter is already started (`trip.encounter`, `trip.stage = enemyId`) |
| `leaveSite(trip)` → `{ok, gained:[ids], placement:bool, reason}` | marks the site left; caller opens placement (reward mode) if `placement`, then `advanceStage` |
| `inflictScar(trip, rng, cause, by)` → events | helper (scar + itemDestroyed) used by cold / rats / trap |

**M2 flow for V1-5:** `trip=createTrip(rng,'m2')` → on `stage==='MAP'`: `legalMoves` / `mapView`, click → `moveTo` → play its `events`;
`entered.tile` decides: `CHARACTER` → `trip.encounter` ready (normal fight → `rewardsFor` / `claimReward(trip,res,pick,rng)` →
`beginPlacement('reward')` → `advanceStage`); `SCAVENGE` → `trip.site` (loop: `startSiteTurn` → arrange → `resolveSiteTurn`; `setSiteTarget`
any time; `leaveSite` → placement if `placement` → `advanceStage`; if `resolveSiteTurn().guardian` → fight the encounter, reward, placement,
`advanceStage`); `CAMPFIRE` → campfire screen → `advanceStage`; `GATE` → `trip.over==='won'`. `trip.over==='lost'` anywhere → lose screen.

#### Events
**`moveTo`** (ordered): `move {from, to, daylight, moves, cold:bool}` → (if cold) `cold {daylight:0, coldHits, text}` followed by `scar {dieId,faceIdx,previous,wasCurrent,cause:'cold'}`
and, if the face held an item, `itemDestroyed {dieId,faceIdx,item,cause:'cold',by,wasCurrent}`, then `lose {scars, cause:'cold'}` (terminal: the tile is NOT entered,
`trip.over='lost'`, `trip.stage=null`) → `enter {tile, enemyId, siteId, c, r}` → for the GATE `tripWon {result, daylight}` (`trip.over='won'`).
Cold rule: if `daylight > 0` the move costs 1; at 0 the move scars instead (daylight stays 0). Cold scar picks a random non-scar HAND/HEAD face like a bite.

**`resolveSiteTurn`** (ordered):
1. `sentence {slotOrder, faces, evaluation, text, preview}`, `step {index, step}` per body die (as in fights).
2. Effects in **sentence order** (steps in slot order; each damage verb is applied once, at its first appearance, with its whole total):
   - `siteReveal {faceIdx, content, item, via:'DIG'|'SPADE'}` per newly revealed face (DIG step: `step.total` faces — target first, then by index; a SPADE
     DIG step reveals every unrevealed unopened face). `item` is the specific item id for ITEM faces (UI may show only "ITEM" if it prefers hidden identity).
   - `verb {verb:'PRUNE'|'SOW', total, amount, shears, noise}` — `amount` = points (PRUNE) or pips (SOW = `max(1, floor(total/2))`); `shears` = quiet points;
     `noise` = noise this verb will make at most.
   - `sitePip {faceIdx, pipIdx, verb, shears:bool, pipsLeft}` per pip removed (target → overflow to next unopened face by index, wrapping; SHEARS points first,
     alternating between the first two unopened faces, quiet).
   - `noise {amount, total, cause:'PRUNE'|'RATS'|'turn'}` — after each noisy pip (cause PRUNE, 1 per point except SHEARS points), after RATS, and at the end of the turn.
   - `siteOpen {faceIdx, content, item, by:'PRUNE'|'SOW', overkill:bool, brokenItem:id|null}` when `pipsLeft` hits 0. Overkill (PRUNE only, ITEM face, ≥ `overkill`
     points still unspent) → `content:'JUNK'`, `item:null`, `brokenItem` = the lost item; leftover keeps overflowing.
   - then by content: ITEM → `itemGained {item, faceIdx}` (into `trip.inventory`, `site.gained`); RATS → `noise` (+2) then `scar {…cause:'rats'}` [+ `itemDestroyed`];
     TRAP → `scar {…cause:'trap'}` [+ `itemDestroyed`]; JUNK / NOTHING → nothing.
   - `lose {scars, cause:'rats'|'trap'}` (terminal: remaining effects stop, no turn noise, `site.over='lost'`, `trip.over='lost'`).
3. End of turn (not lost): `noise {amount:1, total, cause:'turn'}`; if `noise ≥ noiseMax`: `guardian {enemyId, name, noise}` (last event; effects of the turn were
   already completed; `site.over='guardian'`, encounter started, results get a `{kind:'site', result:'GUARDIAN'}` entry).
Log: `S1: [DIG] HAND+SPADE HEAD → search: reveals all · …; revealed 1:ITEM, …; PRUNE 3, noise +3; opened face 2: SPADE; noise 4/6[; STRAY DOG arrives]` (also in `site.log`, `trip.log`).

#### Rules as implemented (decisions where the plan left room)
- **Face order is shuffled** when a site is created (`siteRules.shuffleFaces`), else the first faces would always be the items. ITEM faces roll their item from the pool at creation.
- **Target**: `site.target` if that face is unopened, else the first unopened face (index 0 upward). Overflow continues from the face that was just opened (next unopened by index, wrapping).
- **Overkill** uses points still unspent *at the moment the item face opens* (shears' alternating points included), per plan; SOW never breaks items.
- **PRUNE noise** counts points actually applied (wasted points when no face is left make none); SHEARS points make none.
- **Guardian** triggers only after the turn's effects finish; a turn that scars you to the max loses instead of triggering it. Leaving is impossible once `site.over` is set.
- **A site with every face opened** refuses further turns (`nothing-left`) but does not auto-leave; the UI should enable LEAVE (or leave for the player).
- **Cold at lose**: the move itself still happened (position/visited updated), the tile just isn't entered.
- **Tile resolution** happens in `advanceStage` (not at the moment the fight is won), so a lost/abandoned tile stays as it was; CAMPFIRE tiles also become EMPTY after use.
- `site` results are pushed to `trip.results` with `kind:'site'` (no `enemyId`) — the V1-2 end screen reads `results[].enemyId`, so V1-5 must handle that shape.
- **Gate visibility**: fogged like any other tile (`map.gateVisible:false`); flip the flag if the UI wants the gate always shown.

#### Deviations / notes
- `claimReward` gained an optional `rng` (needed for the random dog reveal); without it the reveal is deterministic (first fogged tiles) rather than throwing.
- M2 `advanceStage` ignores `trip.sequence`/`stageIdx`; `createTrip(rng,'m2')` uses an empty sequence. `isCampfire('CAMPFIRE')` works for the M2 campfire stage as before.
- WHISTLE has no effect on a site (`ctx.site`), pruneMod/sowMod do not apply (no enemy) — as already implemented in V1-1.
- A site turn needs no `rerollPenalty` (reset per site); a pending WATERING CAN SOW from a previous *fight* is discarded with that encounter, and watering-can/seed-pouch
  effects are not applied on sites (fields exist only so `startTurn` works).
- Balance (engine-only, random arrangement, no placement, fights ruined by bad play): 200 M2 trips → 190 won / 10 lost, ~1.7 sites per trip, ~0.15 cold hits per trip;
  real balance is for V1-6.

### V1-4b notes (done — PLUMBER, ACCOUNTANT, random fights, intro)

**Built** (CONFIG / ENGINE / UI / FX / DEBUG in `index.html`). `node tests/engine.test.mjs` → **95/95 green** (85 old, updated + 10 new).
Browser (1280×720, 0 console errors, no scrolling): intro → full random M1 trips to TRIP COMPLETE twice with different orders
(PLUMBER>ACCOUNTANT>FIRE>CROWS and CROWS>DOG>FIRE>ACCOUNTANT); each new effect forced via the debug panel and checked
(tax status + preview `(taxed −1)` + `taxed` flash; frozen die badge/outline/tooltip, click refused, reroll skips it; EXPLAINS scars a HEAD face;
BORROW flies the item to the TOOLBOX and logs `KNIFE BORROWED`; plunger turns a pip and is annotated; wrench shows `sturdy` on the net).

**CONFIG**: `GARDENER` removed. New `enemies.PLUMBER`, `enemies.ACCOUNTANT`, `items.PIPE_WRENCH` (special `wrench`), `items.PLUNGER` (special `plunger`),
`itemRules.plungerPips`, `itemRules.wrenchSpecial`, `effectRules.tax`, `headDieId`, `startingInventory ['KNIFE','GLASSES']`, bare `playerDice`,
`trip.enemyPool / m1Fights / campfireAfter / unknownLabel` (`trip.m1` is gone), `notes.plunger/taxed`, `text.site.plunger`, `text.bagLabel.PLUMBER = 'TOOLBOX'`,
UI strings under `text.s` (`placeIntro, sturdy, frozen, …`) and `text` (`tookBy, taxFlash, taxFloat, frozenFloat`). `map.enemyWords` and M2 character tiles use the pool.
OLD WELL guardian = PLUMBER.

**Engine**: `createTrip(rng)` rolls `[e1,e2,'CAMPFIRE',e3]` (3 distinct from the pool; `randomSequence(rng)`), inventory = copy of `startingInventory`.
`createGame` uses the explicit `[singleFight]` sequence. Placement mode `'intro'` = free like campfire (`isLocked` false). New effects in `enemyAct`:
`tax` (sets `state.tax`, consumed by the next `resolveTurn`, evaluation gets `ctx.tax`; result `evaluation.taxed[verb] = {amount,before,after}`, event `taxed`),
`scarHead` (scar on `headDieId`), `freezeDie` (sets `die.frozen`, event `freeze {dieId}`; `toggleHold`/`rerollUnheld` ignore frozen dice; thawed when the next
sentence is committed or the encounter ends). `E.isSturdy(face)`: wrench faces are skipped by scar, scarHead, takeItem and `inflictScar` (cold/rats/trap).
Plunger: `evaluation.plungerPips`; fight → `pip` event with `plunger:true, verb:'DIG'` on the current intent face before the damage verbs;
site → `sitePip` with `verb:'DIG'` on the target face, no noise; `sitePreview` gets `plunger` and text `plunger: −1 pip`.
`enemyAct` events: `scar` now carries `by`; takeItem text supports `{item}`; effect tags `tax`/`scarHead`/`freezeDie`, anims `borrow quote sigh taxes explains bores anecdote files`.

**UI**: `SmugUI.startTrip('m1'|'m2')` (boot + RESTART TRIP) creates the trip and opens `openPlacement('intro')`; DONE in intro does not advance the stage
(`closePlacement`). **V1-5 note:** `enterStage` currently shows the end screen with a console warning when the stage is `MAP`/`SITE` — replace that branch.
`ui.game` is `null` during the intro (debug panel guarded). Stage strip shows `?` for unreached fights (all fights during the intro). Frozen die: `.die.frozen`
icy outline + FROZEN badge + tooltip + popover line, status line `HAND frozen: no hold / reroll`; tax: status line `taxed: every verb −1 this turn` and preview
annotation. Debug: jump list = enemy pool + CAMPFIRE (an id not in the sequence replaces the current/next fight), buttons TAX NEXT SENTENCE / FREEZE HAND / FREEZE HEAD
(`SmugDebug.setTax / freezeDie`). The intent selector forces each enemy face.

**Tests**: legacy tests run on a wrapper `E` that applies the old kit (KNIFE / GLASSES on face 0, empty inventory) and the fixed sequence DOG>PLUMBER>CAMPFIRE>CROWS;
`E0` is the raw engine used by the v1-4b tests (intro, random sequence, bare start).

**Deviations / known issues**
- Plunger on an enemy whose current intent face has no intact pip does nothing (no fallback target).
- Tax is not applied to the watering-can start-of-turn SOW (not a sentence) nor on sites.
- A frozen die is shown frozen as soon as ANECDOTE acts (while dice are still hidden `?`); it thaws visually when the next sentence is committed.
- Balance not re-run for the new enemies (bare start + random order); V1-6.

### V1-4c notes (done — engine + CONFIG + tests; UI minimal, site screen is V1-5)

`node tests/engine.test.mjs` → **99/99 green**. Overrides V1-4b's 3-fight M1 (the V1-4b note about `m1Fights`/`campfireAfter: 2` is superseded).

**CONFIG**: `enemies.BRIDGE` (tags `place`, mods 0, `resultLabels {beaten:'FORCED ACROSS', befriended:'CROSSED SAFELY'}`, faces CREAK×2 / SLIP / DROP(`loseItem`, 3 pips) /
SWAY / CALM WATER, targetPriority DROP, SLIP, CREAK, SWAY, rewards beaten `{give:[]}`, befriended choose LANTERN | WATERING_CAN); `sites.HUT` (ABANDONED HUT, word HUT, guardian ACCOUNTANT);
`trip.m1Pool` (6 ids), `trip.m1Events: 5`, `trip.campfireAfter: 3` (`m1Fights` removed); `trip.enemyPool` now = map CHARACTER pool incl. BRIDGE (HUT is a site: map SCAVENGE picks it
automatically from `CONFIG.sites`); `map.enemyWords.BRIDGE`; `trip.stageLabels` HUT/BRIDGE; `colors.enemy` bridge faces; `text.lostRiver`.
**Engine**: `randomSequence` = 5 distinct from `m1Pool` + `CAMPFIRE` 4th (`[e1,e2,e3,'CAMPFIRE',e4,e5]`). `enemy.resultLabels` (defaults BEATEN / BEFRIENDED); result **codes** stay
`BEATEN`/`BEFRIENDED` (all comparisons unchanged); the player-facing text is `encounter.resultLabel`, `trip.results[].label`, `E.labelFor(enemy, code)`. `loseItem`: random placed non-sturdy
item removed, pushed to `trip.discarded` (not `taken`, never returned), event `itemDestroyed {cause:'river', becomes, previous}`; no item → `T.noItem`, `ev.nothing`.
`rewardsFor(...).empty` = no choose, no give, nothing returned → UI skips reward + placement. `startSite` keeps `trip.stage` (the site id) in M1 mode; M2 still sets `'SITE'`.
**UI (minimal)**: result labels on the overlay / reward heading / end screen; empty reward → straight to the next stage; M1 site stage shows a placeholder `ui.screen='site'`
(`SCREENS.site`, LEAVE button → `E.leaveSite`, placement if items were gained — impossible there — then advance); end screen lists site results (name, LEFT/GUARDIAN, turns, items);
bridge enemy animations; item lost in the river shows `LOST IN THE RIVER` and the die face becomes bare. Debug jump list = `m1Pool` + CAMPFIRE.
**V1-5 must**: replace `SCREENS.site` with the real site screen for M1 HUT stages (engine: `E.startSite(trip, stageId, rng)` is already called by `enterStage`; guardian → `trip.encounter`
is started by `resolveSiteTurn`, `trip.stage` becomes the guardian id, then `advanceStage` returns to the sequence).
**Browser-checked**: BRIDGE DROP removed the knife (log `KNIFE lost for good`, `discarded:['KNIFE']`), forced BEATEN showed `FORCED ACROSS` and skipped reward/placement,
HUT stage showed the placeholder and LEAVE advanced; 0 console errors.

### V1-5 notes (done — M2 UI: start choice, map, site screen, trip flow, debug)

`node tests/engine.test.mjs` → **100/100 green** (99 old + 1 data-consistency test for the V1-5 screens). **No engine change** was needed (no engine bugs found).
All new code is in `index.html` (CONFIG data, UI, FX, DEBUG); screenshots are in the shared notes folder `v1-5-screens/`.

#### What was built
- **Start choice** (`ui.screen='start'`, `SCREENS.start`, `SmugUI.showStart()`): two `.ctile`s, **M1 SEQUENCE** / **M2 MAP**; the boot shows it, then `startTrip(mode)` → intro placement as before.
  RESTART TRIP keeps the mode; the end screen and the debug panel have **MODE SELECT** (back to the start screen) and NEW M1 / NEW M2 TRIP.
- **Map screen** (`ui.screen='map'`, `SCREENS.map`; phase `'map'`): header = daylight as `max` sun tiles (spent ones dark) + scars as `maxScars` scar tiles; 6×4 grid of word
  tiles (colour by type from `CONFIG.colors.map`, a small label FIGHT / SITE / REST / EXIT, the word from `E.mapView`); fog = dark `?` tile; visited = ✓; dog-revealed (not
  visited) = dashed border; the player = `YOU` badge + gold outline; legal moves = white ring + hover lift (red ring when daylight is 0 = the cold); footer = inventory tiles
  and a message line (`ui.mapMsg`). Click a tile → `SmugUI.onMapMove(c, r)` → `E.moveTo` (whole move resolved at once) → `renderAll` (end state) → FX `hooks.onMapMove(info)`:
  marker slides from the old tile (Web Animations `translate`), the spent sun shrinks, on **cold**: red vignette + stage shake + `THE COLD` + scar tile pulse + `X DESTROYED`;
  entering a tile floats its word (`DOG!`) → after 380–1100 ms `enterStage()` (fight / site / campfire) or the end screen (gate won / lost to the cold). Clicks are ignored while `ui.mapBusy`.
  The top bar shows `MAP · MOVES n` and `☀ n` (`THE COLD` at 0) in M2.
- **Site screen** = the encounter layout with `#stage.site` (`ui.screen='encounter'`, `ui.game` = the site object, `isSite()` = `game.siteId !== undefined`).
  Left panel: site name, guardian chip + rules line, **NOISE track** (6 boxes, red when ≥ max−2) in place of the intent tile, `FOUND` item tiles; right: 6 face cards (`.efc.site`):
  `?` hidden / content tile once `revealed` (ITEM shows the item's name in its colour) / opened (dimmed, `TAKEN`, or `X → JUNK` struck through on overkill); pips use the fight pip look
  (broken = PRUNE, turned = SOW / plunger); `FIRST` (dashed) = default target, `TARGET` (solid) = clicked. Click a card = `E.setSiteTarget` (click again clears); allowed in
  `await-roll` and `arranging`. Dice / sentence / ROLL / REROLL / COMMIT are the normal ones; **LEAVE** (`#btnLeave`, only in site mode) → `E.leaveSite` → reward-mode placement if items
  were gained, else `advance()`. When every face is opened ROLL is disabled and LEAVE turns primary. Preview = engine sentence text + `⇒ search: reveals 2 · force 4 (+4 noise)` /
  `coax 2 pips` / `force 4 (no noise)` (verbs coloured) + `(target: n)`. Playback handlers (UI base + FX wrappers): `siteReveal` (card flip + REVEAL), `sitePip` (pip crack / flip,
  card shake), `noise` (box pop; `+2 NOISE` for rats), `siteOpen` (ITEM: name flies to the ITEMS counter; overkill: item tile breaks in two + `BROKE INTO JUNK`; RATS / TRAP: shake + burst;
  JUNK / NOTHING: float), `itemGained`, `guardian`, plus the existing `step / verb / scar / itemDestroyed / lose`. After the commit: lost → overlay (lose) → end screen;
  guardian → overlay `NAME ARRIVES` + **FIGHT** → `enterStage()` reuses the encounter the engine already started (`trip.encounter`, fresh) → normal fight → reward → placement → `advance()`.
- **Trip flow**: `enterStage()` handles `MAP` (screen `map`, `ui.game = null`), `SITE` / a site id (M1 HUT stage: `E.startSite`), campfire, fights (reusing a pending fresh
  `trip.encounter` for M2 character tiles and guardians). New `advance()` = `E.advanceStage` (+ puts a debug-jumped map tile back). Reward screen calls `E.claimReward(t, res, pick,
  Math.random)` so the dog's `revealTiles` works (a note "also reveals 4 fogged map tiles" is shown on the card screen; the map pulses the new tiles once and says so).
  Gate → end screen (dice nets, items, scars, **daylight left**, moves / cold hits, results incl. site lines, log); the lose screen is shared (cold / scars in a fight / rats / trap).
- **M1 HUT** uses the same site screen (no daylight; top bar stage strip as before). The V1-4c placeholder (`SCREENS.site`, `sitePlaceholder`) is gone.
- **Debug panel**: M2 section — reveal whole map (display only, `ui.showMap`), show site contents (`ui.showSite`: hidden faces drawn dashed), daylight / noise / scars number+SET
  (`setScars` can also heal), NEW M1 / NEW M2 TRIP, MODE SELECT. Jump list = enemy pool + all sites + CAMPFIRE + MAP, works in both modes (in M2 a jump from the map leaves the tile
  under the player intact: `ui.jumpRestore`). Fight-only controls are disabled on a site (dice faces / rerolls still work). Console: `SmugDebug.setDaylight / setNoise / setScars / revealMap / showSite`.

#### CONFIG additions (data only)
`colors.map` (START GATE CHARACTER SCAVENGE CAMPFIRE EMPTY FOG sun), `colors.site` (ITEM JUNK NOTHING RATS TRAP hidden), `text.m2` (all start / map / site / end strings, tile
labels, `openedText`). `text.s.sitePlaceholder` removed.

#### Browser verification (1280×720, 0 console errors, `#screen` scrollHeight = clientHeight on map / site / end)
- **Full M2 trips, real clicks** (a DOM bot: map clicks → fights with random arrangements → rewards → placement → gate): 4 trips to TRIP COMPLETE (one with BRIDGE, WELL guardian →
  PLUMBER befriended, HEAP guardian DOG beaten; 0–2 scars; 2–10 moves).
- **Lost to the cold**: daylight 0 → each step scarred (`THE COLD bites.`, vignette, scar tile pulse); at 5 scars the next step → `YOU FLEE, SCARRED` end screen, the tile was not entered.
- **Sites**: HEAP (DIG reveal 3, PRUNE 7 with KNIFE+carry = +6 noise, both SPADEs **overkilled to JUNK**, guardian DOG arrived → fight → BEFRIENDED → reward LANTERN → dog revealed
  4 tiles → map pulse); HUT in M1 (clicked target on face 5 → **SOW 4 → coax 2 pips** opened PLUNGER with no noise; **SPADE DIG revealed all 6**; PRUNE targeted face 6 opened
  SEED POUCH; noise 6/6 → ACCOUNTANT arrives → beaten → reward → placement → next M1 stage DOG); SHED + **LEAVE** with no items → straight to the campfire; WELL guardian (PLUMBER) in a bot run.
- **Site loss**: a TRAP opened at 5 scars → `lose` event → overlay `YOU FLEE, SCARRED` → CONTINUE → end screen.
- **Full M1 trip including a HUT** (bot): HUT → guardian ACCOUNTANT arrived → beaten, a BRIDGE (empty reward skipped), campfire, → TRIP COMPLETE.

#### Known issues / notes
- Daylight / turn counters in the site header lead the playback by one beat (they read engine state); `TURN n` shows the next turn as soon as COMMIT is pressed (same as fights).
- Site preview shows the engine sentence text, so a GLASSES DIG still prints `(sees 2)` on a site (harmless; the site reveals `total` faces).
- Item identity is shown on revealed ITEM faces (name), not just `ITEM`; the engine event carries the item, so this is a UI choice (one line in `renderSite`).
- A site's default target is the first unopened face *by index*, which may be a revealed TRAP: the player has to click another face (the card says `FIRST`).
- The map word tiles use `CONFIG.colors.map`: CHARACTER clay, SCAVENGE sand, CAMPFIRE orange; no verb colours on tiles. Long words shrink (`ACCOUNTANT` 17px).
- `ui.game` is `null` on the map / start / intro; code that assumed a game (debug panel) is guarded. `ui.screen === 'site'` no longer exists (sites are `'encounter'` with `isSite()`).
- Balance observation for V1-6: with the starting KNIFE + a DIG carry a single PRUNE easily makes 6–7 noise (a guardian after turn 1–3) and overkills items; SOW (half rate, no noise)
  is the safe route but slow (≈2 pips/turn). Daylight 12 was not exhausted in the 4 bot trips (2–10 moves to the gate in a 6-column map).

---

### V1-6 report (light final pass, prototype level)

**Checked** (browser, real DOM clicks via a bot; 0 console errors): one full M2 trip start → map → HUT site → guardian ACCOUNTANT (befriended) → reward → placement →
campfire → PLUMBER → gate → end screen (6 moves, 0 cold); one full M1 trip (5 events + campfire incl. HUT with guardian, BRIDGE, reward/placement/heal) → TRIP COMPLETE;
loss via cold at 0 daylight + 5 scars → "YOU FLEE, SCARRED" end screen. M2 items seen working: fog + gate hidden, daylight/scar rows, campfire, site guardian on full noise,
dog reveal pulse. Site targeting / overkill / DIG / SOW half rate / LEAVE were not re-checked one by one (covered by V1-4 tests and V1-5 notes). `node tests/engine.test.mjs` 100/100.

**Bug fixed (1)**: map tiles rendered `data-c=""0"` (stray quote in `renderMap`), so `dataset.c` was `""` → **every map click moved to column 0** (only left-column moves worked, M2 unplayable
by mouse). Fixed in `index.html` (`data-c="' + cell.c + '"`). No engine change, no new test (UI-only).

**Balance** (engine sim, `side-session-notes/…/sim-v1-6.mjs`, N=250–500 per cell; policies play optimal-ish sentences with rerolls, `novice` = random order, no rerolls, random picks):

| Setup | Policy | Win | Scars | Turns | Notes |
|---|---|---|---|---|---|
| **Current** M1 | fighter / talker / scavenger / novice | 100 / 100 / 100 / 100 % | 0.2 / 0.2 / 0.2 / 0.3 | 10.5 / 12.4 / 10.7 / 16.0 | beaten: 100 / 18 / 87 / 69 %; 0.9 sites, 0.2–0.9 guardians per trip |
| **Current** M2 | fighter | 100 % | 0.5 | 7.4 | 6.0 moves, 0 cold, 1.2 sites, 1.0 guardians, 99 % beaten |
| | talker | 100 % | 0.4 | 7.0 | 6.0 moves, 1.2 sites, 0.3 guardians, 17 % beaten |
| | scavenger (detours) | 99.8 % | 1.6 | 13.6 | 8.0 moves, 3.4 sites, **3.3 guardians**, 1.6 site items, 78 % beaten |
| | novice | 100 % | 0.6 | 10.5 | 6.0 moves, 1.4 sites, 65 % beaten |
| pips ×2, maxScars 4, daylight 12 | novice / scavenger | 98.8–99 % | 1.1 / 1.6 | 17.9 / 21.0 | daylight still never runs out (4–6 left) |
| **pips ×2, maxScars 4, daylight 8** | fighter / talker / scav. / novice | 100 / 100 / 97.6 / 95.6 % | 0.5 / 0.6 / 0.9 / 1.0 | 13.0 / 10.9 / 13.6 / 17.3 | ~2 daylight left on a direct route, ~0 on a detour |
| pips ×2.5, maxScars 4, daylight 8 | same | 99 / 98 / 95 / 87 % | 0.8 / 0.8 / 1.1 / 1.5 | 16.9 / 13.7 / 16.7 / 21.0 | novice loses mostly to DOG |
| pips ×3, maxScars 4, daylight 9 | same | 95 / 97 / 90 / 81 % | 1.1 / 1.0 / 1.4 / 1.7 | 18–23 | too swingy: DOG (4 hostile faces ×6 pips) kills novices |
| ×2 + site pips +1, turnNoise 2 | same | 100 / 99 / 99–100 / 97 % | 0.3–0.8 | 11–17 | fewer scars, not harder: sites get *safer* (more turns before guardian) — skip |

**Recommended preset (NOT applied)**: `CONFIG.maxScars: 4`, `CONFIG.map.daylight: 8`, and **double every enemy face's pips**
(DOG 2→4 all faces; PLUMBER 3→6 / 1→2; ACCOUNTANT 2→4 / 3→6 / 1→2; BRIDGE 2→4 / 3→6 / 1→2; CROWS 1→2 / 2→4). Leave `noiseMax: 6`, site pips, item data, map weights.
Result: competent play still ~100 % (as it should, they know the rules) but a sloppy player loses ~5 %/trip, fights take 2× as many turns (so items get used and
enemy intents matter), and the 12 → 8 daylight makes a detour for a second site actually cost. If the user wants real defeats for sloppy play, use ×2.5 (novice 87 %).

**What we want to learn** (from sim + play; no human playtest yet)
1. *Placement choices?* Still weak. Items per trip: 2 kit + 1 per fight win + 0.5 per site, on 12 item faces; bare faces are interchangeable, so only "which die" matters. Stacking
   needs duplicates (only KNIFE is obtainable twice: SHED / crows). Doubling fight length (above) is the cheapest way to give each placed item more rolls.
2. *Different builds?* Only the fighter/talker split is visible (PRUNE vs SOW picks → 99 % vs 13–18 % beaten). Specials (SPADE reveal-all, WHISTLE ×2 vs animal, WRENCH sturdy) are
   seen in few turns because fights end in 2–3 turns. Not measured per item in V1-6.
3. *Noise = push your luck?* Not yet. PRUNE with KNIFE + carry makes 6–7 noise in one turn, so a prune-first player gets the guardian after 1–2 turns (fighter 1.0 guardians / 1.2 sites;
   greedy scavenger 3.3 / 3.4: it essentially always ends in the guardian). SOW-only talkers rarely trigger it (0.3 / 1.2). DIG-before-PRUNE is rational but the sim policies
   don't plan it. Candidate: `noise per PRUNE point` 1 → 0.5 or `turnNoise` 0 so the choice is real.
4. *Map pressure?* Too soft: 12 daylight vs 6 moves on the shortest path, 0 cold hits for every policy; even a 3-site detour left 4. 8 daylight puts detours at the edge.
   Scars rarely persist (0.5–1.6 per trip vs max 6) so "persistent scars" don't bite until maxScars is lowered.
5. *Beat vs befriend by reward?* Yes, by build (see 2). Rewards are good both ways, so there is no cost to either; the reward pick is a real but cheap decision. BRIDGE has no
   beaten reward and is "FORCED ACROSS" either way (skipped screens) — fine.

### Balance preset applied (after V1-6, user-approved)
`maxScars` 6 → 4, `map.daylight` 12 → 8, every enemy face's pips doubled (DOG 4; PLUMBER 6/2; ACCOUNTANT 4/6/2; BRIDGE 4/6/2; CROWS 2/4).
Noise unchanged. `tests/engine.test.mjs` now pins the old tuning (maxScars 6, daylight 12, pips halved) right after loading CONFIG,
so tests check rules and designers can retune CONFIG freely (pip values must stay even for the halving).
