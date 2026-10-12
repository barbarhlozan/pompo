# Implementation plan — Smuggler dice-sentence prototype v0

Source spec: [DESIGN.md](DESIGN.md) (read it fully first). This file adds **rule
clarifications, architecture, and phased tasks**. Where this file and DESIGN.md
disagree, this file wins (it resolves ambiguities in the spec).

Phases run **sequentially** (they all edit `index.html`). Each phase ends with:
tests green (`node tests/engine.test.mjs`), the page loads with zero console
errors, and a short "Phase N notes" entry appended to the bottom of this file
(what was done, any deviations, known issues).

---

## 1. Files

| File | Purpose |
|---|---|
| `index.html` | THE deliverable. Single file: `<style>`, markup, one `<script>`. Opens by double-click (file://). No external deps except optionally one Google Font (must degrade gracefully offline). |
| `serve.mjs` | Tiny zero-dependency Node static server on port **8123** serving the project dir (used by `.claude/launch.json` → preview `smug-prototype`). |
| `tests/engine.test.mjs` | Node test of the pure engine (no deps; use `node:assert` + `node:test`). Reads `index.html`, slices the code between `/* ENGINE START */` and `/* ENGINE END */`, evaluates it with `node:vm`, and tests it. |
| `PLAN.md` | This file. Append phase notes at the bottom. |

## 2. Script layout inside `index.html`

```
<script>
/* CONFIG START */  const CONFIG = {...}            /* CONFIG END */
/* ENGINE START */  pure rules: no DOM, no timers, rng injected   /* ENGINE END */
/* UI */            state machine, rendering, input
/* FX */            animations, wobble, audio
/* DEBUG */         debug panel + turn log
</script>
```

The test slices **CONFIG START … ENGINE END** (CONFIG + ENGINE together) and
runs it in a vm context, then reads the exported functions off a
`globalThis.SmugEngine = {...}` object assigned at the end of the ENGINE block.
ENGINE must not touch `document`/`window` (other than that final assignment).

## 3. CONFIG (all designer-tweakable values live here)

Faces are plain strings so designers can edit them:

```js
const CONFIG = {
  rerollsPerTurn: 2,
  scarsToLose: 4,
  pipsPerEnemyFace: 2,
  points: { favourite: 2, other: 1, itemBonus: 1, scar: 0 },
  favouriteVerb: { HAND: 'PRUNE', MOUTH: 'SOW', EYE: 'DIG' },
  verbs: ['PRUNE', 'SOW', 'DIG'],
  items: ['KNIFE', 'GLASSES'],
  playerDice: [
    { id: 'MIND', faces: ['PRUNE','PRUNE','SOW','SOW','DIG','DIG'] },
    { id: 'HAND', faces: ['HAND','HAND','HAND','HAND','HAND+KNIFE','HAND+KNIFE'] },
    { id: 'HEAD', faces: ['EYE','EYE+GLASSES','EYE+GLASSES','MOUTH','MOUTH','MOUTH'] },
  ],
  biteTargets: ['HAND', 'HEAD'],          // dice ids BITE may scar
  shapeNames: ['Plan', 'Situation', 'Impulse'],   // by MIND slot 0/1/2
  actionNames: {                           // [faceKey][verb]
    'HAND':        { PRUNE: 'Hit',    SOW: 'Gesture',      DIG: 'Search' },
    'HAND+KNIFE':  { PRUNE: 'Stab',   SOW: 'Threaten',     DIG: 'Pry' },
    'MOUTH':       { PRUNE: 'Insult', SOW: 'Small talk',   DIG: 'Ask' },
    'EYE':         { PRUNE: 'Glare',  SOW: 'Kind look',    DIG: 'Look' },
    'EYE+GLASSES': { PRUNE: 'Glint',  SOW: 'Look learned', DIG: 'Read closely' },
  },
  enemy: {
    name: 'STRAY DOG',
    faces: ['BITE','BITE','GROWL','GROWL','SNIFF','WHIMPER'],
    hostile: ['BITE','GROWL','SNIFF'],
    targetPriority: ['BITE','GROWL','SNIFF'],  // order for spilling PRUNE/SOW past the current intent
    text: {
      BITE: 'it bites!', GROWL: 'it growls (−1 reroll next turn)',
      SNIFF: 'it sniffs your pockets', WHIMPER: 'it whimpers',
      wag: 'it wags its tail',
    },
  },
  text: {
    help: 'ROLL, hold & reroll, drag dice into the sentence, COMMIT. The MIND die sets the verb for dice after it; dice before it act on instinct.',
    reveal: '(reveal)', noEffect: 'nothing happens', scar: 'SCAR',
    beaten: 'BEATEN', befriended: 'BEFRIENDED', lost: 'YOU FLEE, SCARRED',
  },
  colors: { /* verb family, body family, item family, scar, turned(green), bg, ... */ },
  timing: { rollShuffleMs: 600, resolveStepMs: 450, enemyActMs: 700, wobbleMs: 260 },
  audio:  { enabledByDefault: true, volume: 0.15 },
};
```

Face key = the face string (`'HAND+KNIFE'`), used directly to look up
`actionNames`. Body part = text before `+`; item = text after `+` (or none).
`'SCAR'` is a valid face string for HAND/HEAD dice after a BITE.

## 4. Rule clarifications (decided — implement exactly)

**Sentence evaluation** (`evaluateSentence(faces)`; `faces` = 3 face strings
in slot order, exactly one is a verb — the MIND die's):

1. `mindIndex` = slot of the verb face. `shape = CONFIG.shapeNames[mindIndex]`.
2. Each body die gets a **verb**: slots before MIND → its body part's
   favourite verb (`role: 'instinct'`); slots after MIND → MIND's verb
   (`role: 'directed'`). The MIND die scores 0 and is **not** printed in text.
3. **base points** = `favourite` (2) if verb === favourite verb of its body
   part else `other` (1); `+itemBonus` (1) if it has an item. SCAR face:
   0 points, does nothing, `role: 'scar'`.
4. Process body dice left→right with a running `carry` (starts 0):
   `total = base + carry; carry = 0`.
   - If verb is **DIG**: `reveal = true`; if there is a **later non-scar body
     die** in the sentence (skip MIND and SCAR dice), `carry = total` and the
     step `passesTo` that slot; otherwise the points are lost (reveal only).
     DIG points never appear in the verb totals.
   - If verb is PRUNE/SOW: add `total` to `totals[verb]`.
   - Carry chains through consecutive DIGs (DIG→DIG→Hit adds both).
5. **Text format**: `"<Shape>: <steps> → <totals>"`.
   - Step string: `"<ActionName> <base>"`, or `"<ActionName> <base>+<carry>"`
     if it received carry; DIG steps append `" (reveal)"`; a SCAR step is
     `"SCAR 0"`.
   - Steps joined by `" → "` after a step that `passesTo` the next step, else
     `" · "`.
   - Totals: each PRUNE/SOW with total > 0, in order of first appearance,
     `"PRUNE 5"`, joined `" · "`. If none: `CONFIG.text.noEffect`.
   - Required exact outputs (tests):
     - `PRUNE EYE HAND+KNIFE` → `Plan: Glare 1 · Stab 3 → PRUNE 4`
     - `EYE PRUNE HAND+KNIFE` → `Situation: Look 2 (reveal) → Stab 3+2 → PRUNE 5`
     - `HAND+KNIFE EYE PRUNE` → `Impulse: Stab 3 · Look 2 (reveal) → PRUNE 3`
     - also test: `MOUTH PRUNE HAND` → `Situation: Small talk 2 · Hit 2 → SOW 2 · PRUNE 2`
     - also test: `EYE MOUTH SOW` → `Impulse: Look 2 (reveal) → Small talk 2+2 → SOW 4`
     - also test a SCAR case and a DIG-chain case of your choice.
6. Return value (UI and FX consume this — keep the shape):
   ```js
   { shape, mindIndex, verb,             // verb = MIND's verb
     steps: [ { slot, face, role, verb, base, carryIn, total, reveal, passesTo, name } ], // body dice only, in order
     totals: { PRUNE: n, SOW: n },        // 0 when absent
     reveal: bool, text }
   ```

**Enemy model.** Each enemy face: `{ name, pips: ['intact','intact'] }`;
pip values `'intact' | 'broken' | 'turned'`.
- `faceStatus(face)`: any intact → `'intact'` (if all) or `'damaged'`; no
  intact → `'broken'` if broken > turned, else `'turned'` (ties → turned).
- A face is **resolved** when status is broken or turned.
- **Applying PRUNE X / SOW X** (`applyVerb(enemy, verb, amount)` → array of
  events `{faceIdx, pipIdx, to:'broken'|'turned'}`, plus
  `{faceIdx, resolved:'broken'|'turned'}` when a face finishes): spend one
  point per intact pip. Order: the **current intent face** first (only if it
  is hostile and unresolved), then other unresolved hostile faces ordered by
  `CONFIG.enemy.targetPriority`, ties by face index. WHIMPER is never
  targeted. Leftover points are wasted. Apply PRUNE totals and SOW totals in
  the order they first appear in the sentence (same order as the text).
- **Rolling intent** (`rollIntent(enemy, rng)`): pick a random face index; if
  that face is broken, reroll (guard against infinite loop). If it is turned,
  the intent is the **wag** state (`{faceIdx, wag: true}`): harmless.
- **Enemy acts** on its current intent (skip entirely if wag, or if the
  current face became resolved during this turn's sentence):
  - BITE: pick a random face that is not SCAR among all faces of the dice in
    `CONFIG.biteTargets`; it becomes `'SCAR'` (permanent). Event reports
    `{dieId, faceIdx}` for animation. If the die's current face was hit, its
    shown face is now SCAR.
  - GROWL: next turn's rerolls = `rerollsPerTurn − 1` (min 0). Does not stack
    beyond one turn.
  - SNIFF, WHIMPER: nothing (show flavour text).
- **Reveal / foresight (DIG).** The enemy keeps `next` (pre-rolled next
  intent, or null). When a sentence with `reveal: true` resolves, pre-roll
  `next` now (if not already set) and show it greyed under the current intent
  (re-roll `next` if this sentence broke it; it shows wag if turned). Set
  `foresight = 1`. At the turn transition, `current = next ?? rollIntent()`;
  if `foresight` was set, also pre-roll a new `next` so during the following
  turn the player sees **current + greyed next**, then clear `foresight`.
  Net effect: a DIG lets you see one turn ahead during your next turn. If
  `next` becomes broken before it is used, reroll it at transition.
- **Win** (checked right after the sentence resolves, before the enemy acts):
  every hostile face is resolved. Result `BEATEN` if broken faces > turned
  faces, else `BEFRIENDED` (ties → befriended). A defeated enemy does not act.
- **Lose** (checked after the enemy acts): total SCAR faces ≥ `scarsToLose`.

**Turn flow / UI state machine**: `'await-roll'` → (ROLL) `'arranging'` →
(COMMIT, enabled only when all 3 slots filled) `'resolving'` → `'enemy'` →
`'await-roll'` … terminal `'won'` / `'lost'`. RESTART works in any state.
- On ROLL all 3 dice roll. Rerolls left = `rerollsPerTurn` minus GROWL penalty.
- During `'arranging'`: holding, rerolling and placing are all allowed in any
  order. REROLL rerolls every **un-held** die wherever it sits (tray or slot)
  and decrements rerolls; disabled at 0. Holds clear at the start of each turn.
- Dice return to the tray at the start of each turn.

**Input scheme** (resolves the click conflict in the spec):
- **Click a die** (tray or slot) = toggle HOLD (lock badge + visual drop).
- **Drag & drop** (Pointer Events, works with mouse and touch): drag a die onto
  a slot to place it; onto an occupied slot = swap; drag a placed die back to
  the tray = unplace. Invalid drop = animate back.
- **Click-to-place fallback**: small `▲` button under each tray die places it
  in the leftmost empty slot; small `▼` under each placed die returns it.
  Keys `1`/`2`/`3` while hovering a die place it into that slot.
- A drag that moves < 5px counts as a click (hold toggle), not a drag.
- **Hover a die** = show all 6 faces in a small popover (current face
  highlighted, SCARs visibly cracked).

## 5. Phases

### Phase 1 — Foundation: server, CONFIG, engine, tests
- `serve.mjs` (static, port 8123, correct MIME for html/js/css, `/` → index.html).
- `index.html` skeleton with the script block layout from §2, full CONFIG
  (§3, fill in a colour palette too), and the complete ENGINE:
  `parseFace`, `scoreBodyFace`, `evaluateSentence`, `createPlayer`,
  `rollDie`, `rerollUnheld`, `countScars`, `createEnemy`, `faceStatus`,
  `applyVerb`, `rollIntent`, `enemyAct`, `checkWin`, `checkLose`, and a
  `resolveTurn(state, slotOrder, rng)` that runs sentence → verbs → reveal →
  win check → enemy act → lose check → next intent, returning an ordered
  **event list** the UI will animate (e.g. `{type:'step', step}`,
  `{type:'pip', ...}`, `{type:'faceResolved', ...}`, `{type:'reveal', ...}`,
  `{type:'win', result}`, `{type:'enemyAct', intent, ...}`, `{type:'scar', ...}`,
  `{type:'lose'}`, `{type:'newIntent', ...}`) plus a log line like
  `T3: EYE [PRUNE] HAND+KNIFE → PRUNE 5, broke BITE; dog GROWLs`.
  Engine may mutate the passed state; the UI owns cloning if needed.
- Use a seedable RNG helper in ENGINE (`makeRng(seed)`, e.g. mulberry32) for
  tests; UI uses `Math.random`.
- Body of the page: just a placeholder heading. No UI work yet.
- `tests/engine.test.mjs` covering: all 5 required texts, SCAR, DIG chain,
  pip application order (current intent first, then priority), mixed
  broken/turned status incl. tie → turned, rollIntent never returns a broken
  face, wag on turned face, BITE scars only HAND/HEAD non-scar faces, GROWL
  reduces next turn's rerolls, win BEATEN vs BEFRIENDED, lose at 4 scars,
  a full simulated fight to a result with a fixed seed.

### Phase 2 — Playable UI (no juice yet)
- One-screen layout at 1280×720, no scroll: enemy die + intent (and greyed
  next intent when foreseen) at top with its 6 faces + pips visible as a strip;
  SENTENCE row (3 slots with arrows) in the middle; preview text under it;
  your dice tray + ROLL / REROLL (n left) / COMMIT / RESTART at the bottom;
  one-line help text; scar counter (n/4).
- Word-tile rendering: bold uppercase blocks, colour by family from CONFIG
  (verbs / body parts / items / SCAR / turned green). A body+item face shows
  e.g. `HAND` `KNIFE` as two stuck-together tiles inside one die.
- Implement the full state machine and input scheme from §4 using the ENGINE.
- Live preview: recompute `evaluateSentence` on every placement/reroll; show
  shape + text; when < 3 placed show a dim hint. Instant updates.
- COMMIT: call `resolveTurn`, then play its event list **sequentially with
  simple placeholder timing** (`await sleep(CONFIG.timing.*)`, highlight the
  acting tile, update pips, show enemy action text). Input locked while
  resolving.
- Win/lose overlay with BEATEN / BEFRIENDED / lose text + RESTART.
- Keep an in-memory turn log array (DEBUG panel renders it in Phase 4).

### Phase 3 — Juice (Baba Is You–inspired feel, original art)
- Idle wobble: every `timing.wobbleMs`, each tile jumps between 3 precomputed
  tiny transforms (±1px translate, ±1.5° rotate) — hand-drawn jitter. Respect
  `prefers-reduced-motion`.
- Roll: faces shuffle rapidly then settle (ease-out), small bounce.
- Drag: tile lifts (scale/shadow), slight tilt toward drag direction; snap
  into slot with squash-and-stretch; swap animates.
- Sentence complete → all three tiles + arrows light up together (glow pulse).
- COMMIT: each step pops in turn, a floating number flies to the enemy;
  carry visibly passes along the arrow; hits shake the enemy die; pips crack
  (broken) or flip green (turned); faces resolve with a flourish.
- BITE: the targeted face on your die cracks into SCAR (hover popover shows it).
- WebAudio blips (no files): roll tick, snap, pop, hit, turn, bite, win/lose;
  mute toggle (top-right), remembered in localStorage (wrapped in try/catch).
- Chunky display font (optionally one Google Font with a system fallback);
  hard edges, no gradients-heavy look; dark near-black background.

### Phase 4 — Debug / tuning panel
- Collapsible panel (closed by default, toggle button + `` ` `` key).
- Toggle "show all enemy faces and pips" (when off, the enemy face strip
  shows only partial info — decide: show faces but hide pip states).
- For each player die: a dropdown of its faces → set current face instantly
  (also works on dice already placed; preview updates).
- Buttons: +1 / −1 reroll, reset enemy, set enemy intent (dropdown), clear scars.
- Turn log (last ~10 entries, newest on top), format as in DESIGN.md.

### Phase 5 — QA against the acceptance checklist
- Run the preview (`smug-prototype` in `.claude/launch.json`) and verify every
  item in DESIGN.md's acceptance checklist in the real page (use the debug
  panel to force situations): win BEATEN, win BEFRIENDED, lose; three example
  previews; instant preview updates; holds/rerolls/GROWL; DIG reveal + carry;
  CONFIG-only tuning; drag feel. Check no scrolling at 1280×720, zero console
  errors, works when opened via file:// too.
- Fix bugs found. Write a QA report section at the bottom of this file with a
  checked list and any open design questions observed while playing.

---

## Phase notes
(append below)

### Phase 1 notes (done)

**Built:** `serve.mjs` (port 8123, path-traversal guarded, MIME map), `index.html`
(placeholder body + CONFIG + ENGINE + empty `UI/FX/DEBUG START/END` markers),
`tests/engine.test.mjs` (20 tests, all green: `node tests/engine.test.mjs`). The
script block parses cleanly; ENGINE touches no DOM (only `globalThis.SmugEngine = …`).

**CONFIG additions** beyond §3 (all additive): `revealVerb: 'DIG'`,
`pipResult: {PRUNE:'broken', SOW:'turned'}` (also defines which verbs deal damage),
`mindDieId: 'MIND'`, `enemy.logName: 'dog'`, `enemy.text.broken` ("it is too hurt
to act"), and a full `colors` palette: `bg panel line text textDim`,
`verb{PRUNE,SOW,DIG}` (warm: pink/orange/yellow), `body{HAND,MOUTH,EYE}` (cool
blue/cyan/indigo), `item{KNIFE,GLASSES}` (purple), `tileText scar scarText turned
broken pipIntact hostile glow`.

**API** — `SmugEngine` (everything pure; state is mutated in place):

State shape (from `createGame(rng)`):
```
state = { player:{dice:[{id,faces[6],idx,held}]}, enemy, turn:1, rerolls, rerollPenalty,
          over:null|'won'|'lost', result:null|'BEATEN'|'BEFRIENDED'|CONFIG.text.lost, log:[] }
enemy = { name, faces:[{name, pips:['intact'|'broken'|'turned',…]}],
          current:{faceIdx,wag}, next:{faceIdx,wag}|null, foresight:bool }
```
Current face of a die: `die.faces[die.idx]` (= `currentFace(die)`); `'SCAR'` replaces a face in `faces`.

| Function | Notes |
|---|---|
| `makeRng(seed)` → `() => [0,1)` | mulberry32. UI passes `Math.random`. |
| `parseFace(str)` → `{face, kind:'verb'\|'body'\|'scar', verb, body, item}` | |
| `scoreBodyFace(faceOrParsed, verb)` → number | 0 for scar/verb faces |
| `evaluateSentence(faces[3])` → `{shape, mindIndex, verb, steps[], totals:{PRUNE,SOW}, order[], reveal, totalsText, text}` | extra fields `order` (damage verbs by first appearance) and `totalsText`. Throws unless exactly one verb face. Step = `{slot, face, role:'instinct'\|'directed'\|'scar', verb, base, carryIn, total, reveal, passesTo, name}` |
| `createPlayer()`, `currentFace(die)`, `rollDie(die, rng)`→idx, `toggleHold(die)`→bool, `countScars(player)` | |
| `rerollUnheld(state, rng)` → ids rerolled, or `null` if no rerolls | takes **state** (needs `state.rerolls`), decrements it |
| `createEnemy(rng?)` | rolls initial `current` if rng given |
| `faceStatus(face)` → `'intact'\|'damaged'\|'broken'\|'turned'`; `isResolved(face)`; `isHostile(face)` | |
| `applyVerb(enemy, verb, amount)` → events `{type:'pip',faceIdx,pipIdx,to,verb}` / `{type:'faceResolved',faceIdx,resolved}` | mutates enemy |
| `rollIntent(enemy, rng)` → `{faceIdx, wag}` | uniform over non-broken faces; wag if turned |
| `enemyAct(state, rng)` → `{events, rerollPenalty}` | mutates state (scar / `state.rerollPenalty`) |
| `checkWin(enemy)` → `null\|'BEATEN'\|'BEFRIENDED'`; `checkLose(player)` → bool | |
| `createGame(rng)` | new state (turn 1, no dice rolled yet) |
| `startTurn(state, rng)` → rerolls | clears holds, rolls all 3 dice, `rerolls = rerollsPerTurn − rerollPenalty`, clears penalty |
| `resolveTurn(state, slotOrder, rng)` → `{events, log, over, result, evaluation}` | `slotOrder` = 3 die ids (`'MIND'`…) or indices, left→right |

**`resolveTurn` events, in order:**
1. `{type:'sentence', slotOrder:[ids], faces, evaluation, text}`
2. per body die: `{type:'step', index, step}`
3. per damage verb with total>0: `{type:'verb', verb, amount}` then its
   `{type:'pip', faceIdx, pipIdx, to:'broken'|'turned', verb}` and
   `{type:'faceResolved', faceIdx, resolved:'broken'|'turned'}` events
4. `{type:'reveal', next:{faceIdx,wag}, face, rerolled}` — if sentence has a DIG, or the
   already-shown `next` got broken (then `rerolled:true`)
5. either `{type:'win', result}` (terminal; enemy does not act) **or**
   `{type:'enemyAct', intent, face, skipped, reason:null|'wag'|'broken', effect:null|'bite'|'growl'|'sniff'|'whimper', text, rerollPenalty?}`
   followed by `{type:'scar', dieId, faceIdx, previous, wasCurrent}` for BITE
6. `{type:'lose', scars}` (terminal) **or** `{type:'newIntent', intent, face, next, nextFace}`
   (`next`/`nextFace` are null unless foresight is active)

Log line example: `T1: EYE [PRUNE] HAND+KNIFE → PRUNE 5, broke GROWL, broke BITE; dog it is too hurt to act`
(also pushed onto `state.log`). Tails: `dog BITEs (HAND HAND → SCAR)`, `dog GROWLs`,
`dog it wags its tail`, win → `; BEATEN`/`; BEFRIENDED`, lose → `; YOU FLEE, SCARRED`.

**Behaviour notes / decisions for later phases:**
- `state.enemy.next` non-null ⇒ the UI should show it greyed under the current intent
  (initially it is set by a DIG's `reveal` event during the commit; after the
  `newIntent` event it stays set for the whole following turn).
- Carry flows past SCAR dice to the next non-scar body die; text joins steps with ` → `
  whenever a carry is in flight (including across a SCAR step), else ` · `.
- DIG→DIG chaining: both DIG steps get `reveal:true`; the second one's `carryIn` is the first's total.
- Totals with no damage show `CONFIG.text.noEffect` ("nothing happens"); a sentence is
  still valid and can be committed.
- GROWL sets a flat one-turn penalty (non-stacking). If the GROWL face was broken/turned
  by the same sentence the enemy does not act (`skipped`, `reason:'broken'|'wag'`).
- BITE picks uniformly over non-SCAR faces (by index) of HAND+HEAD dice, so face
  multiplicity weights the choice (HAND has 6 candidates, HEAD 6).
- Tests slice CONFIG START…ENGINE END and run it in `node:vm`; vm-created objects have a
  foreign prototype, so the test helper `deepEq` compares via JSON.

**Deviations:** none from §4. Extras only: `createGame`, `startTurn`, `toggleHold`,
`currentFace`, `isResolved/isHostile`, and the additive CONFIG keys above.
`rerollUnheld` takes `state` rather than `player` (it must decrement `state.rerolls`).
Not exercised in a real browser (placeholder page only; syntax-checked via `new Function`).

### Phase 2 notes (done)

**Built:** full playable UI in `index.html` (`<style>`, markup, and the `UI START/END` block). A fight can be
played start to finish: ROLL → hold/reroll → arrange (drag, ▲/▼, keys 1/2/3) → COMMIT → event playback →
win/lose overlay → RESTART. Zero console errors; `scrollWidth/Height == 1280×720` (no scrolling). Engine
tests: 21 green (`node tests/engine.test.mjs`).

**Engine copy fix:** `CONFIG.enemy.text` entries are now predicates read as `"<name|logName> <text>"`:
`bites`, `growls (−1 reroll next turn)`, `sniffs your pockets`, `whimpers`, `wags its tail`,
`is too hurt to act`. Log tails: `dog bites (HAND HAND → SCAR)`, `dog wags its tail`, `dog is too hurt to act`.
Added a wording test. Additive CONFIG key: `colors.enemy{BITE,GROWL,SNIFF,WHIMPER}`.

**Verified in the browser (1280×720):** the 3 DESIGN.md arrangements show exactly
`Situation: Look 2 (reveal) → Stab 3+2 → PRUNE 5`, `Plan: Glare 1 · Stab 3 → PRUNE 4`,
`Impulse: Stab 3 · Look 2 (reveal) → PRUNE 3`; real pointer drag, swap, hold (+ held die survives reroll),
reroll counter, ▲ button, key `3` while hovering, popover with 6 faces; 12 random full fights reached
BEATEN and BEFRIENDED; forced loss (4 scars) shows the lose overlay; GROWL penalty gave 1 reroll next turn.

**Structure of the UI block** (everything in one IIFE; debug handle `window.SmugUI`):
- `ui` = interaction state `{game, phase, slots[3] (die ids), hover, drag, runId, enemyText, previewOverride, verbFlash, actingSlot}`.
  Phases: `await-roll → arranging → resolving → enemy → await-roll`, terminal `won|lost`.
- `view` = *display* model `{enemy:{faces,current,next}, dice:{id:{faces,idx}}}`. `resolveTurn` mutates the
  engine state instantly, so `syncView()` snapshots the pre-turn picture right before it runs and the event
  handlers advance `view` step by step; `syncView()` again at the end. All renderers read `view`, not `game`.
- Render functions (idempotent, update persistent DOM nodes in place — good animation targets):
  `renderAll`, `renderEnemy` (intent tile `#intentTile`, greyed `#nextWrap`, 6 face cards `dom.efc[i]` with
  `.pip`s, classes `is-current/is-next`, `data-status`), `renderDice` (dice are persistent `dom.dieEls[id]`,
  re-parented into `dom.slotEls[i]` or `dom.cellEls[id]`; face tiles rebuilt only when `data-face` changes),
  `renderSlots` (`.full/.acting`, `#slots.complete` = lit-up hook), `renderPreview`, `renderControls`,
  `renderTopBar` (scar counter), `renderOverlay`; popover `showPopover/hidePopover`.
- **Event player:** `playEvents(events, run)` awaits `EVENT_HANDLERS[ev.type](ev)` in order and aborts if
  `ui.runId` changed (restart). One async handler per engine event type — `sentence, step, verb, pip,
  faceResolved, reveal, win, enemyAct, scar, lose, newIntent` — each updates `view`/`ui`, renders, then
  `await sleep(CONFIG.timing.*)`. Phase 3: wrap/extend these (the whole map is exposed as
  `SmugUI.EVENT_HANDLERS`). Cosmetic hook object `hooks.onRoll(ids)` is called after ROLL and REROLL (roll
  shuffle goes there). Drag code: `onPointerDown/Move/Up`, `dropTarget`, `endDrag` (invalid drop currently
  snaps back with no animation: `// Phase 3: animate back`); placement logic `placeDie/unplaceDie`.
- Turn log: `game.log` (engine pushes a line per turn); previous turn's line is shown in the preview area
  while awaiting ROLL. Debug panel (Phase 4) should render `SmugUI.game.log`.

**Known issues / notes:**
- Console/debug edits to dice must be followed by `SmugUI.syncView(); SmugUI.renderAll()` (Phase 4 panel too).
- Dice show `?` tiles until the first ROLL of each turn (previous faces hidden).
- The hover popover can overlap the preview text line (pointer-events none, so harmless).
- No scaling: stage is a fixed 1280×720 centred box; smaller windows clip.
- Balance observation (not touched): random play beats the dog in ~3–6 turns; losing needs deliberate play
  or bad luck — worth a look in Phase 5.
- Wobble, shuffle, squash, audio, "light up" glow beyond a plain gold slot border: Phase 3. Face strip always
  shows pips (the "show all enemy faces/pips" toggle is Phase 4).

### Phase 3 notes (done)

**Built (all in `index.html`; engine untouched, 21 tests still green):** the `FX START/END` block (own IIFE, wires
itself in at `DOMContentLoaded` after the UI via `SmugUI.hooks` + `SmugUI.EVENT_HANDLERS`; debug handle `window.SmugFX`),
plus a Phase 3 CSS block and a `SFX ON/OFF` button (`#btnMute`, top-right; key `M`).
- **Idle wobble:** every `timing.wobbleMs` each die face row / enemy tile / intent tile steps through the 3 frames in
  `CONFIG.fx.wobble` using the individual `translate`/`rotate` CSS properties (so they never fight `transform` animations).
  Off under `prefers-reduced-motion` (also: no shuffle, tilt, shake, FLIP; flyers just fade; CSS animations ~0 ms).
- **Roll:** one timer shuffles all rolled dice through random faces (tick sound per frame), dice settle one after
  another (`settleStaggerMs`) with a scale/rotate bounce. Preview text updates immediately (not delayed by the shuffle).
- **Drag:** lift (scale 1.07 + bigger shadow, CSS) and tilt toward horizontal velocity (eases back to 0 when stopped).
  Drop = FLIP animation from the lifted position: slide into slot then squash-and-stretch; other dice that moved
  (swap partner, evicted die) slide to their new place; invalid drop = overshoot "boing" back. ▲/▼/keys 1-3 use the same
  FLIP path. Hold toggle has a small badge pop.
- **Sentence complete:** CSS gold flash then pulsing glow on all 3 slots + both arrows at once, plus a chime and a
  simultaneous pop of the 3 dice (MutationObserver on `#slots.complete`).
- **COMMIT:** each step pops its die; damage steps launch a floating `+N` that arcs to the card of the face that will be
  hit; a DIG step's number flies along the arrow to the receiving slot while the arrow(s) swell; SCAR step shows a dim `0`.
  `pip` events: broken pip cracks/spins (shake + hit sound + sparks), turned pip flips to green (turn sound);
  `faceResolved`: card pop + BROKEN/TURNED float text + particle burst (+ tile flip for turned). `reveal`: NEXT slides in.
  `enemyAct`: BITE lunges at you, GROWL rumbles, SNIFF nods, WHIMPER droops. `newIntent`: tile pops in.
- **BITE → SCAR:** die shakes, `SCAR!` floats, a red crack overlay is drawn over the face if it was the shown face, then
  it becomes SCAR with a pop, red burst, and the scar box flashes.
- **Audio:** WebAudio oscillator blips (no files): `tick snap pop hit turn bite growl win lose hold lit`. Context is
  created/resumed lazily on the first pointer/key event. Mute persisted in `localStorage['smug.muted']` (try/catch).
- **Font:** `Bungee` from Google Fonts (`<link>`, display=swap) with `Impact, "Arial Black"` fallback for tiles, buttons,
  title, overlay, flyers; body text stays monospace. Works offline/file:// (falls back).
- **RESTART:** `hooks.onRestart` → `FX.reset()` stops the shuffle/tilt timers, removes flyers/sparks/crack overlays and
  cancels all running Web Animations; in-flight event handlers check `ui.runId` before doing anything else.

**Small UI-block edits (no restructuring):** `hooks` grew `onHold, onRestart, onDragStart/Move/End, snapshot, play`
(no-ops by default); `withFlip()` wraps ▲/▼/key placement; `endDrag` takes a position snapshot while the die is still
lifted and calls `hooks.play` after the render; `SmugUI` now also exposes `dom, faceHTML, tileHTML`.

**New CONFIG keys:** `timing.{shuffleStepMs, settleStaggerMs, settleMs, snapMs, squashMs, returnMs, popMs, flyMs, shakeMs,
pipMs, flourishMs, crackMs, lungeMs}`; `audio.{storageKey, volumes{per sound}}`; `fx.{wobble, shakePx, tiltMaxDeg, particles}`.
Retuned `timing.resolveStepMs` 450→340 and `enemyActMs` 700→560 so a commit stays snappy.

**Verified (1280×720, built-in browser):** no scrollbars (1280×720 scroll size), zero console errors; real pointer drags
(place, swap, invalid drop, ▲); 4 random full fights (2 BEFRIENDED, 2 BEATEN): commit playback avg ≈ 2.4 s, max ≈ 3.0 s;
forced BITE → SCAR 1/4; RESTART at 100/400/900/1500/2200 ms into a commit left no flyers/sparks/crack overlays, no running
animations, enemy pips reset; mute toggle + persistence.

**Known issues / notes:**
- The embedded browser pane throttles `requestAnimationFrame` (~1 fps) when idle, so animation timing was verified via
  logic/WAAPI introspection and on-demand screenshots, not by watching real-time playback. Worth one eyeball in a real browser.
- `Bungee` is wider than the Courier fallback; "EYE+GLASSES" fits a die cell (232 of 256 px) but there is little slack.
  With the `Arial Black` fallback it is wider still — not measured offline.
- Floating `BROKEN`/`TURNED` text spawns over the top of the face strip and can clip against the top bar on the first row.
- Phase 2 quirk left alone: when the intent face is broken the same "is too hurt to act" line shows twice (intent + enemyText).
- Sound is untested by ear (no audio output in the harness); AudioContext state was `running` after a click.

### Phase 4 notes (done)

**Built (`DEBUG START/END` block, own IIFE, wired via `window.SmugUI`; handle `window.SmugDebug`; engine untouched, 21 tests green):**
right-side overlay drawer `#dbg` (300 px wide, below the top bar, scrolls internally, so no page scrolling at 1280×720),
closed by default, opened by the `DEBUG` button in the top bar or the `` ` `` key. Keys typed inside the drawer don't reach
the game's 1/2/3 / M handlers. Drawer re-renders from a cheap state signature polled every 120 ms (only while open).
- **Show all enemy faces and pips** checkbox — default **ON** (normal play unchanged). OFF = `ui.hidePips`: the face strip keeps
  the 6 faces/names but pips render as dashed "unknown" circles and resolved faces look intact (no strike-through / green).
  The intent tile/text and NEXT are unaffected (they are game information).
- **Per-die face dropdown** (`1: HAND … 5: HAND+KNIFE`, SCARs included; index-based because faces repeat): sets `die.idx`
  in place → `syncView()` + `renderAll()`; works on placed dice, preview updates immediately. Enabled only while `arranging`
  (dice are `?` until ROLL, and ROLL re-rolls everything anyway).
- **± reroll** (`arranging` only; floors at 0; GROWL penalty for next turn is shown read-only), **intent dropdown** (sets
  `enemy.current`, `wag` derived from a turned face), **RESET ENEMY** (`createEnemy(Math.random)`; dice, scars, turn untouched),
  **CLEAR SCARS** (restores each die's faces from `CONFIG.playerDice`). Intent/reset/scars work in `await-roll` and `arranging`.
- **Turn log**: last 10 of `game.log`, newest first; the line the engine pushes at commit is hidden until playback ends.
- All state-changing controls are disabled during `resolving`/`enemy` (and after win/lose, where the note says RESTART).
- Console API: `SmugDebug.{toggle, setFace(dieId, idx), addRerolls(n), resetEnemy, setIntent(faceIdx), clearScars, setHidePips(bool)}`.

**Small UI-block edits:** `ui.hidePips` flag read by `renderEnemy`; `.pip.unknown` CSS.

**Phase 3 fixes:** (a) `renderEnemy` blanks `#enemyText` when it equals the intent line, so "is too hurt to act" / "wags its tail"
shows once. (b) `floatText` clamps its centre y to ≥ 121 px so the whole rise stays below the 40 px top bar.

**Verified (1280×720, built-in browser):** the three DESIGN.md arrangements via dropdowns (MIND=PRUNE, HAND=HAND+KNIFE,
HEAD=EYE) give exactly `Plan: Glare 1 · Stab 3 → PRUNE 4`, `Situation: Look 2 (reveal) → Stab 3+2 → PRUNE 5`,
`Impulse: Stab 3 · Look 2 (reveal) → PRUNE 3`; ±reroll, intent set, hide-pips on/off, clear scars (1/4 → 0/4), reset enemy,
controls 8/8 disabled mid-commit, log updates after playback; backtick toggles; zero console errors; document scroll size 1280×720.

**Notes for Phase 5:** while the drawer is open it covers the right ~300 px (slot 3, part of the face strip, hover popover can
sit under it) — close it to play normally. The embedded pane throttles rendering, so screenshots right after a JS edit can be stale.

### Phase 5 QA report

**Method.** Real page at 1280×720 (built-in browser, `http://localhost:8123/`), real pointer drags (`left_click_drag`),
real ▲/▼/COMMIT/RESTART clicks, debug drawer / `SmugDebug` to force situations; plus two Node harnesses (kept out of the repo,
in the session scratchpad): an **independent oracle** re-implementing §4 from scratch that replayed 11,008 random engine turns
(text, pip spill order, win/BEATEN/BEFRIENDED, BITE/GROWL/SNIFF, foresight after DIG, no intent/next on a broken face →
**0 mismatches**), and a policy simulator for balance. `node tests/engine.test.mjs` → 22/22 green (one test added).

#### Acceptance checklist (DESIGN.md)

| | Item | Evidence |
|---|---|---|
| ✅ | Fight won as **BEATEN** | Many fights; e.g. forced via real UI: overlay `BEATEN` (`The dog is done for.`), log tail `; BEATEN`. 25 + 40 + 12 + 3 soak fights in the page all ended in an overlay, 0 stuck states. |
| ✅ | Fight won as **BEFRIENDED** | Seen in every soak run (≈ 1 in 3 with random play); `T2: MOUTH [SOW] HAND+KNIFE → SOW 4, turned GROWL, turned BITE` then `BEFRIENDED` overlay `The dog is yours now.` |
| ✅ | Fight **lost** at 4 scars | In the page: set intent BITE via drawer + commit a 0-damage sentence ×4 → scars 1/4…4/4, overlay `YOU FLEE, SCARRED`, all buttons disabled, RESTART resets. **Not reachable by normal play, see Balance.** |
| ✅ | 3 example previews exact | Real UI: `[PRUNE] EYE HAND+KNIFE` → `Plan: Glare 1 · Stab 3 → PRUNE 4`; `EYE [PRUNE] HAND+KNIFE` → `Situation: Look 2 (reveal) → Stab 3+2 → PRUNE 5`; `HAND+KNIFE EYE [PRUNE]` → `Impulse: Stab 3 · Look 2 (reveal) → PRUNE 3`. |
| ✅ | Preview updates instantly | Drag/swap/▲/▼/key 1-3, REROLL and drawer face change all call `renderAll` synchronously (checked: preview text equals engine evaluation after every placement in 40 soak fights, 0 mismatches). The roll shuffle only animates the die faces, never the preview. |
| ✅ | Hold + reroll | Click toggles HELD badge; held die keeps its face across REROLL (also checked while a shuffle is still running — see bug 1); REROLL disabled at 0 / when all held. |
| ✅ | GROWL reduces next turn's rerolls | `T1 … dog growls (−1 reroll next turn)` → status `GROWL: 1 reroll(s) this turn`, next turn `REROLL (1 left)`, the turn after back to 2. |
| ✅ | DIG reveals next intent | Greyed NEXT tile + `next: …` line appears at commit (`reveal` event) and **persists through the whole following turn** (§4); absent the turn after unless another DIG. 3,867/3,867 DIG turns in the oracle run left a `next`. |
| ✅ | DIG passes points forward | Through MIND (`EYE [PRUNE] HAND+KNIFE` → `Stab 3+2 → PRUNE 5`), DIG chain (`[DIG] EYE HAND+KNIFE` → `Look 2 (reveal) → Pry 2+2 (reveal) → nothing happens`, points lost at the end), past a SCAR (`EYE [DIG] SCAR` → `Look 2 (reveal) · SCAR 0` — reveal only). *Note:* with only two body dice a carry can never skip over a SCAR to a third die; that case is vacuous (engine test covers it anyway). |
| ✅ | All tuning values live in CONFIG | See "CONFIG audit" below. Verified by editing a temp copy (rerolls 3, scarsToLose 2, pips 3, favourite 3, button label, title, `colors.lit`): UI showed 3 rerolls, 2 scar boxes, 3 pips per card, `GO` button, `TUNED` title, green lit colour. |
| ✅ | Drag feels nice | Real mouse drags into slots 1/2/3 worked; lift + tilt, FLIP slide with squash on landing, swap animates, invalid drop boings back, all three slots + arrows glow gold together when complete, idle wobble ticking (3-frame jitter verified on `#intentTile`). Subjective "nice" still needs a human in a real, un-throttled browser. |

**Other requested checks**
- ✅ No scrolling at 1280×720: `innerWidth/Height 1280×720`, `scrollWidth/Height 1280×720`, `overflow:hidden`; stage box 1280×720 at (0,0); debug drawer open adds no scroll.
- ✅ Zero console errors: `read_console_messages(onlyErrors)` empty; `window.onerror` / `unhandledrejection` captured nothing over ~80 full fights (fast timing) + 6 at real speed.
- ✅ RESTART from every state: await-roll, arranging (with a held die and a placed die), mid-resolving (600 ms and 1500 ms into a commit), enemy phase, won (overlay button), lost. After each: phase `await-roll`, turn 1, 0/4 scars, overlay hidden, all pips intact (engine + view + DOM), slots empty, no `.flyer/.spark/.crack` nodes, 0 running animations, log empty, NEXT hidden, no held dice, a new fight plays normally.
- ⚠️ `file://`: the built-in pane cannot navigate to a real `file://` page (it renders it as a static `data:` snapshot). In that snapshot the page booted, `SmugUI/SmugFX/SmugDebug` all present, phase `await-roll`. The code has no `fetch`/module/`src=` dependency (only the optional Google Fonts `<link>`, which degrades to Impact/Arial Black), and `localStorage` is try/catch-wrapped, so a real double-click open should behave the same — but one manual double-click is still worth doing.

#### Bugs found and fixed
1. **Wrong face shown after a quick REROLL (real bug, FX).** If REROLL was pressed while the ROLL shuffle was still running (< ~0.8 s) with a *held* die, that die's shuffle job was dropped by `startShuffle` and its row stayed on a random mid-shuffle face — the tile no longer matched the die's real face or the preview (reproduced 3 of 6 tries). Fixed: shuffle jobs are now persistent across calls (`shuffleJobs`); re-verified 12/12 + 40-fight soak with 0 mismatches. (FX block only; no engine change.)
2. **`CONFIG.text.scar` was only half-honoured.** Engine compared against a literal `'SCAR'` in four places while `parseFace` also accepted `CONFIG.text.scar`; renaming it in CONFIG would have broken scarring/counting. Now one `const SCAR = CONFIG.text.scar` in the engine and `C.text.scar` in the UI. New test: *scar face key follows CONFIG.text.scar*.
3. **Stale enemy line read like a current intent (clarity).** After a commit the previous turn's action ("STRAY DOG wags its tail", "…bites") stayed in yellow under the *new* intent. It is now labelled `last turn: …` while awaiting ROLL (`CONFIG.text.lastAction`).

#### CONFIG audit (stray literals moved)
- **Strings** (`CONFIG.text`): button labels, title, TURN/SCARS/INTENT/NOW/NEXT/`next:`/HELD/`?`, SFX ON/OFF, place-hint, last-turn, press-ROLL, GROWL status, no-rerolls, reveal messages, win/lose subtitles, floating BROKEN/TURNED/REVEAL/SCAR!, `lastAction`. The help line and `{n}` placeholders were already there.
- **Colours**: CSS used ~15 hard-coded hex values duplicating `CONFIG.colors`; CSS now reads custom properties (`--bg --panel --line --text --dim --lit --status --danger --glow --pip --broken --turned --tiletext`) that are set from `CONFIG.colors` at start-up (hex in CSS are only first-paint fallbacks). New keys `colors.lit / status / unknownBg / unknownFg`. FX particle/float colours use `CONFIG.colors` instead of literals.
- **Numbers**: `CONFIG.fx` gained tilt/lift/squash frames, pop & settle scales, hold-badge/tile ms, float distance & duration, burst distance/duration/counts, card pulse, arrow swell, reveal slide, lunge/growl/sniff/whimper, scar shake/pop, lose shake, reduced-motion pause; `CONFIG.ui.{dragThresholdPx, dropSlackPx}`; `CONFIG.debug.{logRows, pollMs}`; the WebAudio recipes moved to `CONFIG.audio.sounds`.
- **Left in code / CSS on purpose** (stylistic, not designer knobs): CSS keyframe/transition durations and layout pixel sizes (1280×720 stage, slot/die sizes), the fractions of `timing.resolveStepMs` used for sub-steps, per-call sound pitch offsets, debug-panel labels.

#### Remaining issues / things I did not change
- **Lose is practically unreachable** (balance, below) — a design call, not a bug.
- Commit playback is ≈ 2.5–3.5 s per turn at default timings; fine for a first look, may feel slow once players know it. Knobs: `timing.resolveStepMs`, `enemyActMs`.
- During the commit the sentence tiles are un-draggable/un-holdable (by design) but the REROLL/COMMIT buttons just grey out — no "skip animation" affordance.
- Dice show `?` tiles between turns even though the sentence preview still shows last turn's sentence text; slightly odd mix but readable.
- The hover popover can sit over the enemy face strip / under the open debug drawer (harmless, pointer-events none).
- Animation timing and audio were only verified structurally (the pane throttles rAF, no audio output): needs one human run in a normal browser.
- Offline font fallback (`Arial Black`) is wider than Bungee; "EYE+GLASSES" fit was not re-measured with the fallback.
- The debug "show all enemy faces and pips" checkbox defaults to ON (everything visible); OFF hides pip state only.

#### Balance (engine simulation, 3–5k fights per row; `turn` = turns taken)
| policy | win | avg turns | BEATEN / BEFRIENDED | notes |
|---|---|---|---|---|
| random arrangement, random rerolls | 100 % (0 losses in 5,000) | 3.7 (2–12) | 62 / 38 | 0.08 scars avg |
| greedy damage, no rerolls | 100 % | 2.6 | 86 / 14 | |
| greedy damage + rerolls toward ≥ 5 | 100 % | **2.1** (86 % end on turn 2) | 89 / 11 | 0.00 scars |
| SOW-first | 100 % | 2.8 | 25 / **75** | |
| PRUNE-first | 100 % | 2.5 | 100 / 0 | |
| deliberately minimising damage | **99.1 %** (0.9 % lose) | 6.0 | 61 / 38 | 0.4 scars avg |

The dog needs 10 points of damage (5 hostile faces × 2 pips) and a sentence averages ≈ 4.7 at best (distribution over all 216 rolls: 4 pts 44 %, 5 pts 44 %, 6 pts 11 %), so fights are **2–4 turns** and BITE can fire at most once per turn → 4 scars is out of reach unless you play to lose. Levers (simulated, CONFIG-only): `scarsToLose` 2 → 1 % random-loss; `pipsPerEnemyFace` 3 → 5.3 turns (random) / 3.2 (greedy), loses still < 0.5 %; pips 4 + scars 3 → 7 turns, 2.6 % loss for random play, 0 % for greedy. Nothing short of pips ≥ 4 *and* fewer scars makes a sensible player lose; pips 3 also makes BEFRIENDED nearly impossible for a greedy player (0 %) because the greedy order finishes faces with PRUNE (check SOW tuning if you go that way).

#### Observations for "What we want to learn"
- **Do players use Situation / Plan / Impulse on purpose?** Exhaustive over all 216 rolls: **Impulse (MIND last) achieves the maximum damage in 100 % of rolls and is the unique best in 50 %; Plan is never better than Impulse and Situation ties in 50 %.** Average best damage is *identical* (4.67) whichever face the MIND die shows. Reason: instinct gives every body die its favourite verb (2 pts) and the MIND die costs nothing in last position. So the verb die's face almost never matters for damage, only for *which verb* (PRUNE vs SOW) and for DIG reveal/carry. Players who simply maximise the number will learn "MIND last" quickly; Plan/Situation are only worth it for DIG carry (+reveal), for SOW/PRUNE steering, or to keep EYE's reveal while still scoring. Watch whether anyone ever picks Plan.
- **Does MIND last rescue a bad verb roll?** Yes, completely — maybe too much: MIND = DIG is as good as PRUNE for expected best damage (4.67 each). "Bad verb roll" is a non-event, which removes the tension the question presupposes.
- **PRUNE vs SOW as different approaches:** in Impulse the split is fixed by the body dice (HAND → PRUNE, MOUTH → SOW), so the *approach* is chosen by which dice you hold/reroll rather than by the verb die; to commit to SOW you need MOUTH in a directed slot after a SOW. With greedy-by-total play 86–89 % of fights are BEATEN; SOW-first play gives 75 % BEFRIENDED at +0.3 turns. Whether the two approaches *feel* different depends on the flavour text and the dog's reaction (currently identical).
- **Is rerolling/arranging fun or a chore?** Fights are 2–4 turns × (≤ 2 rerolls + arrange) — short enough not to be a chore, but because Impulse is dominant and the dog rarely threatens you, arrangement quickly becomes a solved, low-stakes step. DIG/reveal currently has little to react to (the dog's turn after a reveal is rarely avoidable; you only see it). Consider testing with `pipsPerEnemyFace: 3–4` and `scarsToLose: 3` to see if tension appears before adding content.
- Held-die + reroll decisions are the Balatro-like part; with 6 faces per die and favourites on 2/6–4/6 of faces the optimum is usually obvious after one reroll.
