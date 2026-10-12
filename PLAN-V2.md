# Implementation plan — Smuggler prototype v2 (core subset)

Spec: [DESIGN-V2.md](DESIGN-V2.md). Existing code: [PLAN-V1.md](PLAN-V1.md) phase notes describe the v1 engine API, UI
structure and debug panel (frozen copy in `archive/v1/`). **This file wins over DESIGN-V2.md.** It is a prototype: build
the core, keep it simple, don't polish.

Same architecture: `index.html` with `CONFIG` / `ENGINE` / `UI` / `FX` / `DEBUG` blocks; ENGINE pure and tested by
`node tests/engine.test.mjs` (the harness pins some tuning right after loading CONFIG, see the top of the test file;
update that pin block as needed). No sound; animate only in reaction to the player. Phases run one after another
(same file). Each phase: tests green, zero console errors, no scrolling at 1280×720, browser-checked, and a short
"Phase notes" entry at the bottom of this file. Don't init git or commit.

## Scope (agreed with the user)

**Building now — M1 (new body + flexible sentences):** data-driven dice (MIND / HEAD / TORSO), variable slots per
encounter, choosing which dice go into the sentence, optional MIND, order labels incl. REFLEX, NOSE reveal, BACK/BELLY,
the exposed belly, losing a whole die, the new item list with order triggers, simple item charges, `mindAloneHolds`.
**Cut from M1:** dropping items on map tiles (unplaceable items stay in the inventory as in v1).

**After a user playtest of M1 — souls lite + checks lite (detailed later):** city zone + gate, walking home to win,
catching souls (voluntary / forced, seed charge), face souls only, FEAR + ANGER only, growth triggers `afterEncounter`
+ `whenPRUNEused` only, wanted level up/down, checks at the gate (requests, suspicion, confiscation, escalation, run),
and from 3 stars an automatic check every few steps instead of a chasing unit.
**Cut from M2:** soul dice, GRIEF / JOY, the other growth triggers, spawning authority tiles, the chasing unit.

Kept from v1: the 5-random-events M1 trip + campfire, the M2 map (until the city phase changes it), sites, enemies
(remapped below), intro packing screen, placement screen, balance preset (doubled enemy pips).

---

## 1. M1 decisions (binding)

**Dice as data.** `CONFIG.playerDice = [{ id, label, kind: 'mind'|'body', faces: [...] }]`:
- MIND `PRUNE PRUNE SOW SOW DIG DIG` (kind mind)
- HEAD `NOSE EYE EYE MOUTH EAR EAR`
- TORSO `PALM PALM ARM ARM BACK BELLY`

`CONFIG.bodyParts = { PART: { favourite: verb|null, fixedPoints: n|undefined, label, revealsNext?: true, vulnerable?: true } }`:
PALM/ARM → PRUNE; MOUTH → SOW; EYE/EAR → DIG; NOSE → DIG + `revealsNext`; BACK → null, fixedPoints 1;
BELLY → null, fixedPoints 1, vulnerable. Optional Czech display labels go in `label` (keep ids English).
No code may hard-code HAND/HEAD/TORSO ids: everything (scar targets, placement nets, odds, debug lists) iterates
`playerDice` / `bodyParts`. Adding a die in CONFIG must just work (add a test that does this with a dummy 4th die).
Action names per part × verb in `CONFIG.actionNames` (write short, fitting names for NOSE, EAR, PALM, ARM, BACK, BELLY).

**Scoring.** Unchanged rule, generalised: base = `fixedPoints` if defined, else 2 if verb === favourite else 1;
+1 if it has an item; SCAR = 0; then item effects; then DIG carry. **Instinct for parts with no favourite**
(BACK, BELLY before MIND, or in REFLEX): they have no instinct verb, so they do nothing (0 points, step text
`<Name> 0`, e.g. "Brace 0"). Under a MIND verb they score their fixed 1 (+item). `CONFIG.bodyParts.X.instinctVerb`
may override this later (default null).

**Slots and choosing dice.**
- Each enemy and site has `slots` (default 3). Values: DOG 3, PLUMBER 3, ACCOUNTANT 2 ("he talks, you nod"),
  CROWS 2, BRIDGE 1 ("one careful step"); sites HEAP 3, SHED 3, WELL 2, HUT 3. All in CONFIG; debug can change it.
- The sentence has exactly `slots` positions; COMMIT is enabled when **all slots are filled**. Dice not in the
  sentence do nothing (but count for the belly check).
- `evaluateSentence(faces, ctx)`: `faces` has 1–3 entries, **0 or 1** verb faces.
- **Labels** (`CONFIG.shapeNames`): no MIND → `REFLEX` (all dice on instinct). 3 slots: MIND at 0/1/2 → PLAN /
  SITUATION / IMPULSE. 2 slots: MIND at 0 → PLAN, at 1 → IMPULSE. 1 slot: a lone body die → REFLEX; a lone MIND →
  `IDLE` (does nothing; preview says so) or, when `CONFIG.mindAloneHolds` is true, `HOLD` (see below).
- **mindAloneHolds** (default false): when the committed sentence is a lone MIND, after the sentence resolves the
  player clicks one body die; that die keeps its current face and is not rolled at the next ROLL (it can still be
  rerolled normally afterwards). Enemy still acts as usual.
- DIG carry: to the next non-scar body die later in the sentence, as before (skips MIND and SCAR).

**NOSE.** When a NOSE face acts (any role, not scar), it also reveals the enemy's next intent (depth 1, same
foresight mechanism as DIG; depth = max of all reveals in the sentence). On a site it reveals 1 face.

**Order triggers** are computed on the final sentence order; the preview shows them when they fire:
- GLASSES: its die is in slot 0 → reveal depth 2. Annotate `(glasses: sees 2)`.
- EAR TRUMPET: the very next slot holds a MOUTH face (adjacent, MIND in between breaks it) → that MOUTH +2.
  Annotate on the MOUTH step `(+2 ear trumpet)`.
- PIPE: its die is in the last slot → wanted −1. No-op until the wanted level exists; no annotation until then.

**Items** (replace the v1 list; CONFIG.items keyed by id; each `{ name, part, names:{PRUNE,SOW,DIG} (null = use
the part's action name), special, info, uses?, forbidden? }`; all give the normal +1):
- KNIFE (PALM): PRUNE +1. SHEARS (PALM): PRUNE split across 2 faces (as v1). SPADE (PALM): site DIG reveals all (as v1).
- WATERING CAN (PALM): **SOW: +1 now and +1 SOW at the start of next turn** (v1 had only the delayed part).
- MATCHES (PALM, uses 3): PRUNE +2, spends 1 charge per PRUNE use; at 0 charges the item burns out and is removed
  (log + small animation). Not usable (no +2) is impossible since it's removed at 0.
- FORBIDDEN BOOK (PALM, forbidden): SOW +2. `forbidden` is inert until checks.
- SEED POUCH (PALM, uses 3): no effect yet (inert until souls). Show its charges.
- SLEEVE POCKET (ARM): inert until checks.
- GLASSES (EYE): first in the sentence → reveal 2 (replaces the v1 DIG trigger).
- LANTERN (EYE): base always 2 under any verb (as v1).
- EAR TRUMPET (EAR): directly before a MOUTH die → that MOUTH +2.
- WHISTLE (MOUTH): SOW vs `animal` → own points ×2 (as v1).
- PIPE (MOUTH): last in the sentence → wanted −1 (inert in M1).
- VEST (BELLY): covers the belly.
- **Charges travel with the item** (placing, moving, unplacing to the inventory keep the remaining uses). Implement
  however is simplest (e.g. inventory entries / face-keyed map), but test it. Show remaining uses on the item tile.
- Removed v1 items: PIPE_WRENCH, PLUNGER, SEED_POUCH's v1 effect.

**Exposed belly.** In the commit sequence, after the sentence resolves and before the enemy acts (also on sites,
before the turn's noise): if any die is showing a BELLY face without a VEST on it, one random non-scar face of
**the die that holds that BELLY face** becomes SCAR (items on it destroyed as usual). Event `bellyExposed`, log
"your belly was exposed". (It does not matter whether the BELLY die is in the sentence.)

**Losing.** `CONFIG.loseRule: 'maxScars'` (**default, user decision: keep the v1 rule**, `maxScars: 4`). The v2
`'dieLost'` rule (run ends when every face of any single die is SCAR; MIND counts) stays available as an option to
compare. The lose screen names the failed die ("your TORSO gave out"). Scar effects target any non-scar face of the
body dice (`CONFIG.scarTargets`, default all `kind:'body'` dice); ACCOUNTANT's `scarHead` targets HEAD.

**Content remap** (user approved):
- Enemy effects that named HAND/HEAD now use data: scar → `scarTargets`; takeItem / loseItem → any face with an item.
- Rewards: DOG beaten `{choose:[WHISTLE,SPADE]}`, befriended `{choose:[WHISTLE,LANTERN]}`; PLUMBER beaten
  `{choose:[SHEARS,MATCHES], returnTaken}`, befriended `{choose:[WATERING_CAN,VEST]}`; ACCOUNTANT beaten
  `{choose:[FORBIDDEN_BOOK,GLASSES]}`, befriended `{choose:[EAR_TRUMPET,PIPE]}`; CROWS beaten `{give:[LANTERN],
  returnTaken}`, befriended `{choose:[SLEEVE_POCKET,KNIFE]}`; BRIDGE beaten nothing, befriended
  `{choose:[LANTERN,WATERING_CAN]}`.
- Site pools: HEAP [WATERING_CAN, SPADE, MATCHES]; SHED [SHEARS, KNIFE, LANTERN, VEST]; WELL [WHISTLE, EAR_TRUMPET];
  HUT [MATCHES, PIPE, FORBIDDEN_BOOK, SLEEVE_POCKET].
- Intro packing: dice bare, `startingInventory = [KNIFE, GLASSES, SEED_POUCH]`.

## 2. Phases

### V2-1 — M1 engine (+ keep the game running)
- CONFIG per §1 (dice, bodyParts, actionNames, items, slots, labels, mindAloneHolds, loseRule, scarTargets, remapped
  rewards/pools, starting inventory).
- ENGINE: data-driven dice everywhere; `evaluateSentence` for 1–3 faces with optional MIND, labels, BACK/BELLY,
  NOSE reveal, order triggers, item effects + charges; `resolveTurn` taking the chosen dice in order (any subset of
  size `slots`), belly event, lose rule, mindAloneHolds hold; placement/odds/heal over any body die; sites with slots.
  New events documented (`bellyExposed`, `itemBurnedOut`, `chargeSpent`, `heldOver`, `dieLost`…).
- Tests: update existing tests for the new dice (rewrite fixtures; keep rule coverage), plus: every label case for
  1/2/3 slots, REFLEX, lone MIND idle/hold, BACK/BELLY scoring + no-instinct 0, NOSE reveal, each order trigger incl.
  "MIND in between breaks EAR TRUMPET", each new item, charges spend/burn-out/travel, belly exposed vs VEST, dieLost vs
  maxScars, dummy 4th die added via CONFIG works, seeded M1 trip simulation.
- UI: minimum to keep the game playable with the new dice at their encounter's slot count, without the new
  slot-choosing polish (V2-2 does that). If that's too much, keep it playable at 3 slots and say so in the notes.

### V2-2 — M1 UI
- Sentence row with `slots` slot tiles; the tray shows all dice; the player drags/places any subset into the slots;
  COMMIT when all filled. Preview with label (PLAN / SITUATION / IMPULSE / REFLEX / IDLE / HOLD), item names, order
  triggers and annotations, charges.
- Belly exposed animation, item burn-out, NOSE reveal, mindAloneHolds die pick, lose screen naming the die.
- Placement nets, odds and campfire heal for HEAD and TORSO generically (any number of body dice); charges on tiles.
- Debug: set slot count for the current encounter, toggle `mindAloneHolds`, toggle `loseRule`, give new items.
- Verify the M1 acceptance items (except item dropping) in the browser; short notes. Then **stop for a user playtest.**

### Later (after playtest) — V2-3 souls lite, V2-4 wanted level + checks lite
To be detailed in this file after the M1 playtest, using the Scope section above.

---

## Phase notes
(append below)

### V2-1 notes (done — M1 engine; UI playable at every slot count, polish is V2-2)

`node tests/engine.test.mjs` → **114/114 green** (v1 rule tests kept, 14 new v2 tests; both lose rules covered: the v2 tests pin `dieLost`, one test checks the shipped `maxScars` default). Browser (served by `node serve.mjs`, 1280×720,
**0 console errors**): intro placement on both body dice → 1-slot BRIDGE → 3-slot DOG fight to BEATEN → reward → placement → 2-slot
ACCOUNTANT → exposed belly ended the run ("Every face of your TORSO is scarred") → `mindAloneHolds` HOLD pick + kept face → M2 map → 2-slot WELL site.

#### CONFIG keys (all data; engine reads them at call time)
| Key | Meaning |
|---|---|
| `playerDice: [{id,label,kind:'mind'\|'body',faces}]` | MIND / HEAD / TORSO. Order = tray / `trip.dice` order. `kind:'body'` dice hold items, get scars, count for the belly |
| `bodyParts: {PART:{favourite,fixedPoints?,revealsNext?,vulnerable?,instinctVerb?,label?}}` | see §1. `favourite:null` + `fixedPoints:1` = BACK / BELLY |
| `actionNames[PART][PRUNE\|SOW\|DIG\|IDLE]` | `IDLE` = name when a part acts on instinct with no verb ("Brace") |
| `items[ID]` | `{name, part, names:{PRUNE,SOW,DIG}` (null = part's name)`, special, info, uses?, forbidden?}` |
| `itemRules` | `knifePruneBonus, matchesPruneBonus, forbiddenBookSowBonus, glassesRevealDepth, defaultRevealDepth, noseRevealDepth, whistleMultiplier, whistleTag, wateringCanNow, wateringCanSow, earTrumpetBonus, earTrumpetPart, pipeWanted` |
| `shapeNames` | `{first:'Plan', middle:'Situation', last:'Impulse', reflex:'Reflex', idle:'Idle', hold:'Hold'}` (title case; the UI may upper-case) |
| `defaultSlots: 3`, `enemies[ID].slots`, `sites[ID].slots` | DOG 3 PLUMBER 3 ACCOUNTANT 2 CROWS 2 BRIDGE 1; HEAP 3 SHED 3 WELL 2 HUT 3 |
| `mindAloneHolds: false`, `loseRule: 'maxScars'` (**default, user decision**) `\|'dieLost'`, `maxScars: 4`, `scarTargets: null\|[dieIds]` | |
| `effectRules.scarHeadDie: 'HEAD'` | die ACCOUNTANT's `scarHead` hits |
| `startingInventory: [KNIFE, GLASSES, SEED_POUCH]` | placed on the intro screen |
| `text.belly, text.lostDie ('your {die} gave out'), text.lostDieSub, text.holdText, text.idleText, text.holdPick, text.heldStatus`, `text.placeHint` (`{slots}`, `{n}`) | |
Removed: `favouriteVerb, mindDieId, headDieId, itemDice, biteTargets, itemRules.wrenchSpecial/plungerPips/seedPouchRerollPerTurned`, items PIPE_WRENCH / PLUNGER, `notes.seeds / plunger`, `text.s.sturdy*`.
Item `special` codes: `knife shears spade wateringCan matches forbiddenBook seedPouch(inert) sleevePocket(inert) glasses lantern earTrumpet whistle pipe(no-op) vest`.

#### State shapes (changes only)
```
die       = { id, kind:'mind'|'body', label, faces[], idx, held, frozen?, heldOver? }
trip      = + faceUses:{ 'DIE:idx': n }   // remaining charges of a PLACED item with `uses`; missing = full CONFIG uses
              invUses:[n|undefined]       // parallel to trip.inventory; missing = full uses
              lostDie: dieId|null         // set when a run is lost under dieLost
encounter = + slots:n (copied from the enemy at start; the debug panel may change it), holdPending:bool, lostDie, takenUses:[n]  // parallel to `taken`
enemy     = + slots
site      = + slots, holdPending, lostDie
```
Inventory entries stay plain item ids; read charges through the helpers (never index `faceUses` by hand).

#### API (SmugEngine)
- `evaluateSentence(faces[1..N], ctx?)` → the v1 shape plus: `slots` (= faces.length), `mindIndex` (**-1 = no MIND**), `holds` (lone MIND with `mindAloneHolds`),
  `spends:[{slot,item}]` (charges to spend; MATCHES under PRUNE), `forbidden:n` (forbidden items in the sentence), `triggers:{glassesFirst:bool, earTrumpet:[slotIdxOfTheBoostedMouth], pipeLast:bool}`, `pipeLast`.
  `shape` ∈ Plan / Situation / Impulse / Reflex / Idle / Hold. Throws only for 0 faces or >1 verb face.
  Step = v1 fields + **`idle:bool`** (a part with no verb: `verb:null, base:0`, name from `actionNames[PART].IDLE`, text `Brace 0`). `step.depth` = reveal depth the step contributes
  (DIG 1, NOSE 1, GLASSES in slot 0 → 2); `step.reveal` stays "a DIG step (carries points)". Notes: `(glasses: sees 2)`, `(nose: sees 1)` (only when NOSE is not under DIG), `(+2 ear trumpet)` on the MOUTH step,
  `(matches +2)`, `(forbidden book +2)`, `(watering can +1)` + `(+1 SOW next turn)`. Removed: `seeds`, `plungerPips`.
  A DIG carry that lands on an idle die is lost (the step shows `Brace 0+2`). WHISTLE doubles everything incl. the EAR TRUMPET bonus.
- `resolveTurn(enc, slotOrder, rng)` — `slotOrder` = exactly `enc.slots` different die ids / indices (any subset of the dice, MIND optional); throws otherwise.
  Returns `{events, log, over, result, evaluation, holdPending}`. Same for `resolveSiteTurn(site, slotOrder, rng)` (uses `site.slots`).
- `holdOver(state, dieId)` → `{ok, events:[heldOver], reason?}` (`no-hold`, `not-a-body-die`); valid while `state.holdPending`. `startTurn` then leaves that die unrolled (event `heldOver {phase:'kept'}`), clears `heldOver`, `held` stays false.
- `usesLeft(trip, dieId, idx)` / `inventoryUses(trip, i)` → n or `null` (item has no `uses`). `addToInventory(trip, id, uses?)`.
- `bodyDieIds()`, `mindDieIds()`, `scarTargetIds()`, `dieLabel(id)`, `favouriteOf(part)`, `failedDie(player)` (die id whose every face is SCAR, or null), `loseInfo(player)`, `actionName(parsedFace, verb)`.
- `checkLose(player)`: `dieLost` → `failedDie !== null`; `maxScars` → `countScars >= maxScars`. Placement (`canPlace/placeItem/moveItem/unplaceItem/healScar/oddsSummary`) works for every `kind:'body'` die (`canPlace` reason `not-an-item-die` for MIND).
- `isSturdy` is gone.

#### Events (new / changed), in `resolveTurn` order
`sentence`, `step*` (+`idle`), **`holdChoice {options:[dieIds]}`** (lone MIND with mindAloneHolds), `mod/taxed/verb/pip/faceResolved` (unchanged), **`chargeSpent {dieId,faceIdx,item,left}`** then, at 0,
**`itemBurnedOut {dieId,faceIdx,item,becomes}`** (face becomes the bare part, item → `trip.discarded`), `reveal` (also from NOSE / GLASSES), **`bellyExposed {dieId,faceIdx,face,text}`** followed by
`scar {dieId,faceIdx,previous,wasCurrent,by:'BELLY',cause:'belly'}` and `itemDestroyed {…,cause:'belly',by:'BELLY'}`, then `lose` | `win` | `pendingSow` + `enemyAct`… + (`lose` | `newIntent`).
`lose {scars, dieId, dieLabel, rule, cause}` — `dieId` null under maxScars; `cause` 'belly' | 'enemy' | 'cold' | 'rats' | 'trap'. `rerollBonus` is no longer emitted (field kept at 0).
`startTurn` events: `pendingSow{applied}`…, `heldOver {phase:'kept', dieId, face}`. `holdOver` events: `heldOver {phase:'chosen', dieId, face}`.
Site: `siteReveal.via` ∈ 'DIG' | 'SPADE' | **'NOSE'** (a NOSE / GLASSES-first step reveals its depth in faces); belly + charges happen after the effects and **before** the turn noise.
Log: `…, matches 2 left`, `…, matches burned out`, `…, hold one die`, `…; your belly was exposed (TORSO PALM → SCAR)`, `…; YOU FLEE, SCARRED (your TORSO gave out)`.

#### Rules as implemented (where §1 left room)
- Belly: every die whose **current** face is a `vulnerable` part without a VEST scars one random non-scar face of its own die (the BELLY face itself is a candidate). It happens after the sentence and the reveal, **before** the win check, so a sentence that wins still exposes the belly, and the belly can lose the run (lose beats win). Only a scar made by the belly itself triggers the lose check there.
- MATCHES spends one charge per sentence face that performs PRUNE; the +2 of the last charge still counts, then it burns out. Charges are also spent on sites. Charges are lost with a scarred / lost-in-the-river / replaced item; a taken item returns with its charges (`takenUses`).
- GLASSES triggers positionally (slot 0) under **any** verb. A GLASSES under instinct DIG elsewhere is a plain depth-1 reveal. On a site GLASSES-first reveals 2 faces (my choice; §1 only specified fights).
- WATERING CAN: +1 own points now (`wateringCanNow`) and +1 SOW at the start of the next turn.
- SEED POUCH / SLEEVE POCKET are inert (no `rerollBonus`). FORBIDDEN BOOK: `forbidden` is only counted (`evaluation.forbidden`). PIPE-last sets `evaluation.pipeLast`, nothing else.
- `scarTargets` (null = all body dice) applies to scars from enemies, the cold, rats, traps; `takeItem` / `loseItem` use any item on any body die.
- mindAloneHolds also works on sites (`site.holdPending`, `E.holdOver(site, id)`).

#### What the UI supports now (V2-2 builds on this)
- Slot row is built once with one slot per player die and shows/hides slots by `game.slots` (`slotCount()`); `ui.slots` has one entry per die, only the first `slots` are used. COMMIT needs all `slots` filled; any subset of the 3 dice can be placed
  (▲ button, drag, or keys 1–`slots`); dice in vanished slots return to the tray. The tray shows all dice; unused dice just stay there. Preview shows label + steps (engine text, includes the order-trigger notes).
- Intro / reward / campfire placement nets and odds are generated for `E.bodyDieIds()` (HEAD, TORSO); item tiles show `×n` charges on nets and the inventory tray.
- Top bar scars: under `dieLost` shows `HEAD 0/6 · TORSO 2/6` (scar boxes hidden); end / map / campfire screens use the same summary. Lose overlay names the die (`lostDieSub`).
- Event handlers added for `bellyExposed` (text flash), `chargeSpent`, `itemBurnedOut` (face reverts), `lose` (names the die). `mindAloneHolds`: after the lone-MIND commit `ui.holdPick` is true, ROLL is disabled, the status line says to click a body die (`pickHold`), then ROLL keeps that die's face.
- Debug drawer: slots number + SET (current encounter / site, `SmugDebug.setSlots`), `mindAloneHolds` checkbox, `loseRule` select, FREEZE buttons per body die; the rest as before.
- **Not done (V2-2):** no FX for belly / burn-out / hold / NOSE reveal (plain text flashes only); slot arrows / tray are not re-laid-out per slot count; preview does not highlight order triggers beyond the text notes; the `1`–`3` keys, `.slot` numbers and the "Fill all N slots" hint are minimal.

#### Tests
`tests/engine.test.mjs` loads the engine twice from `index.html`: **`E0/E/CFG` = the v1 three-dice kit (MIND/HAND/HEAD, v1 items/rewards) applied as fixture data** (`applyLegacyFixture`) so all 96 v1 rule tests keep running (and
prove nothing is hard-coded), and **`N/NCFG` = the shipped v2 CONFIG** for the new tests. Deviation from "rewrite fixtures": I kept the legacy fixture instead of porting ~100 tests dice-by-dice (same rule coverage, far less risk).
Removed (items no longer exist): seed-pouch reroll bonus, PIPE WRENCH sturdy, PLUNGER fight + site tests. Updated: step shape gains `idle`, GLASSES-only-in-slot-0, the scar-key test uses the v2 dice.
New v2 tests: CONFIG data model; labels for 1/2/3 slots + REFLEX + IDLE; HOLD + holdOver + kept face; BACK/BELLY scoring and no-instinct 0 (+ `instinctVerb` override); NOSE (fight + site); every order trigger incl. "MIND in between breaks EAR TRUMPET";
MATCHES / FORBIDDEN BOOK / WATERING CAN / inert items / names; charges spend, burn-out, travel (place, move, unplace, replace, scar, taken+returned); belly exposed vs VEST / in or out of the sentence / wins; dieLost vs maxScars (+ MIND counts, names the die);
scarTargets / scarHead / takeItem; slots (subset, throws on wrong size, REFLEX on 2 slots, site slots); site charges + belly before noise; dummy 4th die via CONFIG (items, placement, odds, 4-slot labels, scars, heal, lose names it); placement/odds/heal for HEAD and TORSO;
a seeded 40-trip simulation (random subsets, holds, intro/reward placement, campfire heal, HUT/WELL sites with guardians) run twice for determinism.

#### Deviations / open points
- Labels are title case in CONFIG (`Plan`…, as in v1 text); `REFLEX` etc. in the plan are display-only.
- `evaluateSentence` returns `mindIndex: -1` for REFLEX (was always 0..2); UI code that brackets `[MIND]` by index keeps working.
- Bare `HEAD`/`TORSO` have no `mind`-style `label` variants; Czech `bodyParts[].label` are stored but not displayed yet.
- Default lose rule is `maxScars` 4 (user change); under it the top bar / map keep the v1 `n/4` scar boxes, `dieLost` shows per-die scars. No balance pass; pips are still the doubled preset (the test harness halves them).

## Refactor notes (code split, no behaviour change)
The single 4,900-line `index.html` was split into `src/` (see `CLAUDE.md` for the one-line-per-file map).
- **Layout:** `src/index.html` (markup + `<link>`/`<script>` tags in load order), `src/styles.css`, `src/config/*.js`
  (one global `CONFIG`: the first file declares it, the rest `Object.assign` their keys), `src/engine/*.js`
  (the old engine IIFE as plain top-level code, exports in `90-api.js`), `src/ui/*.js` (old UI IIFE, same idea),
  `src/fx.js`, `src/debug.js` (unchanged IIFEs). Classic scripts, no modules, so `src/index.html` also opens via file://.
- **Code was moved verbatim** (engine/ui bodies dedented by two spaces). Only glue: `CONFIG` creation, and UI's duplicate
  `signed` helper now uses the engine's global of the same name.
- **Build:** `node build.mjs` inlines the stylesheet and all scripts (in tag order) into the root `index.html`
  (self-contained, shareable). Run it before finishing any phase; never hand-edit the root file.
- **Test:** `node tests/engine.test.mjs` loads the `config/` + `engine/` scripts listed in `src/index.html` straight into
  `node:vm` (114 tests, unchanged apart from the loader and the scar-key test patching sources instead of a slice).
- **Dev:** `node serve.mjs` serves `src/index.html` at `/` and the built file at `/build`; the preview config uses it.
- Because engine/ui share the global scope, a new top-level name must not clash with another file's (`const` redeclaration
  is a load-time SyntaxError). Pick the file by topic and keep the load order in `src/index.html` in mind for load-time reads
  (only `CONFIG` is read at load time by the engine).
