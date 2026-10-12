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
