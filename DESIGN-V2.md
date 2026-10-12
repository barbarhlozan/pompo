# Smuggler prototype v2 — design (from the user)

> Scope note: we build a **core subset** of this spec (see PLAN-V2.md "Scope"). PLAN-V2.md decisions win over this file.

## Context
There is a working prototype in `index.html`: a single file, vanilla JS, a CONFIG object at the top, and Baba Is You–inspired word tiles. v0 added dice sentences against one enemy. v1 added loot, placing items on an unfolded die, more enemies, a tile map and scavenging. **Extend that file. Don't start over.** Keep the visuals, the debug panel and everything not changed here.

Since v1 the design has been written down in Notion. v2 brings the prototype in line with it. In order of priority:
1. **M1, new body and flexible sentences.** New dice, a variable number of sentence slots, an optional Mind die, order labels, the nose, the vulnerable belly, and losing a whole die.
2. **M2, souls, the city and checks.** Seeds, catching souls voluntarily or by force, souls on faces and soul dice, growth, the city area, authority checks and wanted level (hledanost).

Everything new goes into **CONFIG** as data. Keep **English** names for verbs and effects (PRUNE, SOW, DIG, REROLL, …). Czech names for body parts are fine as display labels.

---

## M1: new body and flexible sentences

### Dice
| Die | Faces |
|---|---|
| **MIND** | PRUNE ×2, SOW ×2, DIG ×2 |
| **HEAD** | NOSE, EYE, EYE, MOUTH, EAR, EAR |
| **TORSO** | PALM, PALM, ARM, ARM, BACK, BELLY |

Make the dice list data-driven, so later dice (LOWER BODY, INNARDS) can be added in CONFIG without code changes.

### Favourite verbs (all in CONFIG, prototype values)
| Part | Favourite verb | Notes |
|---|---|---|
| PALM, ARM | PRUNE | |
| MOUTH | SOW | |
| EYE, EAR | DIG | |
| NOSE | DIG | Special: when it acts, also **REVEAL the opponent's next intent** (show the next pre-rolled face) |
| BACK | none | Always 1 point, under any verb |
| BELLY | none | Always 1 point. **Vulnerable** (see below) |

### Rolling and the sentence
- **Roll all dice**, then up to **2 rerolls** with hold, as before.
- **Sentence length is set by the encounter:** `slots: 3 | 2 | 1` in CONFIG per enemy or site. Show the right number of slot tiles. Some encounters have fewer slots, e.g. an "ambush" with 1 slot or a "quick chat" with 2.
- The player picks **which** dice go into the sentence. Unused dice do nothing.
- **The MIND die is optional.** Dice after MIND use its verb, dice before it act on instinct, and with no MIND every die acts on instinct.
- Scoring is unchanged: 2 if the die's verb is its favourite verb, else 1, +1 for an item, scar = 0. DIG passes its points to the next die.
- **Order label** in the preview (no rules attached, just a name):
  - MIND first = **PLAN**
  - MIND in the middle = **SITUATION**
  - MIND last = **IMPULSE**
  - no MIND = **REFLEX**

  With 2 slots: MIND first = PLAN, MIND last = IMPULSE.
- **MIND alone in a 1-slot sentence** does nothing. Add a CONFIG flag `mindAloneHolds`: when true, a lone MIND lets you HOLD one die into the next turn. Default false, so we can test it.

### Vulnerable belly
After the final roll, when the player commits: if **BELLY** is showing (in the sentence or not) and it has no covering item, **one random non-scar face on TORSO becomes a SCAR**. Animate it and log "your belly was exposed". The **VEST** item covers it.

### Losing a die = end of run
Replace the "max scars" rule: **the run ends when every face of any single die is a SCAR**. The MIND die counts too. Show which body part failed on the lose screen.

### Items (replace the v1 list)
Each item has `part`, three verb names, an effect written as `trigger → effect`, and optional `uses` and `forbidden`. **Inventory = only what's on the body.** An item that can't be placed is **dropped** on the current map tile and can be picked up again there.

| Item | Part | PRUNE | SOW | DIG | Effect |
|---|---|---|---|---|---|
| KNIFE | PALM | Stab | Threaten | Pry | when verb is PRUNE → +1 |
| SHEARS | PALM | Snip | Offer to trim | Cut open | when verb is PRUNE → break points split across 2 faces |
| SPADE | PALM | Whack | Lean and chat | Dig | on a scavenge site, DIG → reveal all faces |
| WATERING CAN | PALM | Splash | Water their plant | Flood out | when verb is SOW → +1 now and +1 next turn |
| MATCHES (3 uses) | PALM | Light up | Offer a light | Shine | when verb is PRUNE → +2. Each use spends 1 charge |
| FORBIDDEN BOOK (forbidden) | PALM | Smack | Quote | Look up | when verb is SOW → +2 |
| SEED POUCH (3 uses) | PALM | – | – | – | needed to catch a soul (M2). One use per soul |
| SLEEVE POCKET | ARM | – | – | – | at a check → the item on a neighbouring face stays hidden |
| GLASSES | EYE | Glint | Look learned | Read the fine print | when first in the sentence → reveal the next 2 intents |
| LANTERN | EYE | Dazzle | Warm light | Light up | this face always scores 2 under any verb |
| EAR TRUMPET | EAR | – | Listen closely | Eavesdrop | when directly before a MOUTH die → that MOUTH +2 |
| WHISTLE | MOUTH | Shriek | Call softly | Echo | when verb is SOW and the enemy has tag `animal` → ×2 |
| PIPE | MOUTH | Blow smoke | Calm chat | Ponder | when last in the sentence → hledanost −1 (M2; no-op in M1) |
| VEST | BELLY | – | – | – | belly is covered (no damage when exposed) |

"–" means the item has no special name for that verb. Use the body part's normal action name instead.

**Order triggers** ("first", "last", "directly before X") must be evaluated on the final sentence order, and the **preview must show them** when they fire.

### Starting kit for M1
KNIFE on one PALM, GLASSES on one EYE, SEED POUCH on the other PALM (it's inert until M2).

---

## M2: souls, the city, checks and wanted level

### City area on the map
The map gets a **CITY zone**: the right third of the grid, plus one **GATE** tile between the road and the city. The city has more tiles, and its tiles are mostly **PERSON** encounters. You can stay in the city as long as you like. **Walking back to the START tile ends the run successfully.** The goal is no longer "reach the gate".

### People (soul carriers)
Person encounters use the same enemy-die rules. Each person has a **soul card**:
- `name`, `profession`
- `emotion`: FEAR / ANGER / GRIEF / JOY
- `verb`: the soul's favourite verb
- `growthTrigger`
- `shape`: which neighbouring face it grows onto next, as an ordered list of face indexes on the die net
- `isDie`: true for souls that are their own die

**Catching a soul:** when you win against a person and have a SEED POUCH with charges left, you're offered **"take the soul"**:
- **Won over** (majority turned): a **voluntary** soul with normal values.
- **Beaten** (majority broken): a **forced** soul. Its point value is +1, its emotion side effect fires **twice**, its growth trigger counts double, and it adds +1 suspicion per face at checks.
- Spend 1 seed charge either way.

**Placing a soul:**
- **Face souls:** choose any non-scar face on HEAD or TORSO in the die-net screen. The soul **replaces** that face: the body part and any item on it are gone. A soul face scores like a body part with the soul's verb as its favourite verb, and when it's in the sentence its **emotion package fires**.
- **Soul dice** (`isDie: true`): added as an extra die with their own 6 faces from the soul card. They're rolled and placed like any other die, and count as soul faces at checks.

**Emotion packages** (CONFIG; "must" is forced, "may" is an optional button):
- **FEAR:** when this face lands, you must reroll that die (costs no reroll). If it lands on a soul face again, keep it.
- **ANGER:** after commit, you must reroll one other random die.
- **GRIEF:** after commit, you may heal one scar on another die.
- **JOY:** after commit, you may flip any die to a neighbouring face, before the enemy acts.

**Growth:** each soul has one trigger from CONFIG, e.g. `afterEncounter`, `whenRerolled`, `whenPRUNEused`, `whenYouTurnAFace`. When it fires, the soul grows onto the next face in its `shape`, replacing that body part and destroying any item there. Animate the growth on the die.

**Example souls** for CONFIG:
| Name | Profession | Emotion | Verb | Growth | Die? |
|---|---|---|---|---|---|
| Hedvika | watchmaker | FEAR | DIG | whenRerolled | no |
| Bohouš | butcher | ANGER | PRUNE | whenPRUNEused | no |
| Marta | widow | GRIEF | — (scores 0) | afterEncounter | no |
| Alžběta | teacher | JOY | SOW | whenYouTurnAFace | **yes**: faces SOW, SOW, SOW, DIG, MOUTH, MOUTH |

**On failure** (a whole die scarred), all carried souls are lost. The end screen lists souls brought home or lost.

### Hledanost (wanted level, 0–5 stars)
- **Goes up:** +1 when you beat a person in the city, +1 when a person reports you (CONFIG chance after any city encounter you don't win by turning), +1 on a failed check, +1 per FORBIDDEN item confiscated.
- **Goes down:** −1 for every 3 steps without an encounter, and −1 when you leave the city.
- **Effects:** at each star level, more authority tiles spawn. From 3 stars, an **authority unit moves one tile toward you every 2 steps** on the map. If it reaches you, a check starts.
- Show stars at the top of the screen.

### Authority check
A check is a **test first, a fight only if it escalates.** It happens at the **GATE** and when an authority unit catches you.
1. The authority die shows a **request**: SHOW PALMS, LOOK ME IN THE EYE, EMPTY POCKETS (ARM/BELLY), SAY SOMETHING (MOUTH). Number of requests = 1 + floor(hledanost / 2).
2. You roll with 2 rerolls as normal.
3. You build a sentence (2 slots) that **must contain the requested body part**. If you can't, the request fails.
4. **Suspicion:** +1 per soul face in the sentence (+2 if forced), and +1 per FORBIDDEN item in the sentence unless hidden by SLEEVE POCKET.
5. **Result per request:** suspicion 0–1 passes; 2–3 means a forbidden item is confiscated (or +1 hledanost if you have none); 4 or more **escalates** into a normal fight against an AUTHORITY enemy die. Beating an authority gives +2 hledanost. You can always run (cost: 1 scar + 1 hledanost).

### Debug additions
- Give a soul (pick from the CONFIG list), forced or voluntary
- Set hledanost
- Trigger a check
- Force growth
- Toggle `mindAloneHolds`
- Set slot count for the current encounter

---

## Out of scope
Home and garden screens, planting, cuttings (řízky), healing between runs, lower body and innards dice, trading, other characters building their own sentences, story.

## Acceptance checklist
**M1**
- [ ] HEAD and TORSO dice have the new faces. NOSE reveals the next intent. BACK and BELLY score 1 under any verb.
- [ ] An encounter can be set to 3, 2 or 1 slots. The player picks which dice to use. MIND is optional, and with no MIND the label is REFLEX.
- [ ] Order labels (PLAN / SITUATION / IMPULSE / REFLEX) show in the preview.
- [ ] Order-trigger items (GLASSES first, PIPE last, EAR TRUMPET before MOUTH) work and show in the preview.
- [ ] An exposed belly scars TORSO unless the VEST covers it.
- [ ] The run ends when any single die is fully scarred.
- [ ] Unplaceable items are dropped on the tile and can be picked up again.

**M2**
- [ ] The city zone and gate exist, and walking back home ends the run with a summary.
- [ ] Souls can be caught both ways and cost a seed charge. Forced souls are stronger and louder.
- [ ] Face souls replace body parts and items. The soul die works as an extra die.
- [ ] All four emotion packages and all four growth triggers work and animate.
- [ ] Hledanost rises and falls as specified. The authority unit chases you from 3 stars.
- [ ] Checks: requests, suspicion, confiscation, escalation to a fight, running away.
- [ ] All new content lives in CONFIG.

## What we want to learn
1. Does choosing **which dice** go into a short (1–2 slot) sentence create interesting decisions?
2. Do players use REFLEX (no MIND) on purpose?
3. Is carrying a soul a real trade-off: power vs lost body parts vs checks?
4. Does voluntary vs forced feel different enough to be a moral choice?
5. Does the wanted level produce the "GTA stars" feeling of a run getting hotter?
