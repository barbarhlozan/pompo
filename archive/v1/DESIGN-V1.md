# Smuggler prototype v1 — design (from the user)

## Context
There is a working v0 prototype (`index.html`, single file, vanilla JS, a CONFIG object at the top, Baba Is You–inspired word tiles). In v0 you build a 3-die "sentence" (MIND + HAND + HEAD) to fight one STRAY DOG. **Extend that same file. Don't start over.** Keep all v0 rules, visuals and the debug panel unless this task changes them.

v1 turns one fight into a **short trip**: you walk a small map, fight or befriend characters, scavenge places, get items, and **place items onto faces of your dice**. The question we're testing: *does building your dice over a trip create real decisions?*

Deliver in **two milestones**. Each one should be playable on its own.
- **M1:** 3 fights in a row + rewards + item placement (+ one campfire). No map.
- **M2:** add the map, daylight, scavenge sites and noise.

Everything new (items, enemies, sites, map weights, numbers, names) goes into **CONFIG** as data.

---

## Unchanged from v0 (for reference)
- Dice: **MIND** (PRUNE ×2, SOW ×2, DIG ×2), **HAND** (6 hand faces), **HEAD** (3 EYE, 3 MOUTH).
- Favourite verbs: HAND → PRUNE, MOUTH → SOW, EYE → DIG.
- Turn: roll → up to 2 rerolls with holding → arrange 3 dice in the sentence row → live preview → commit.
- Dice **after** MIND use its verb. Dice **before** MIND act on instinct (their favourite verb). MIND scores 0.
- Points per body die: 2 if its verb is its favourite, else 1. +1 for an item. SCAR = 0.
- DIG reveals the enemy's next intent and adds its points to the next body die in the sentence.
- PRUNE removes pips as *broken*, SOW removes pips as *turned*. A face is broken or turned by majority (ties count as turned).

## Changes to v0
- **Starting kit:** 1 KNIFE on one HAND face, 1 GLASSES on one EYE face. Nothing else.
- **Scars persist across the whole trip.** Lose when total scars ≥ `CONFIG.maxScars` (default **6**).
- **A scar destroys the item on that face** (show a little break animation and a log line).

---

## M1: rewards, item placement, more items and enemies

### Items
Every item has: `part` (hand / eye / mouth), a name for each verb (shown in the preview), and **one special rule**. All items also give the normal +1.

| Item | Part | PRUNE name | SOW name | DIG name | Special |
|---|---|---|---|---|---|
| KNIFE | hand | Stab | Threaten | Pry | **PRUNE:** +1 extra point |
| SHEARS | hand | Snip | Offer to trim | Cut open | **PRUNE:** its points must be split across 2 different faces (alternate pips). On a scavenge site, PRUNE with SHEARS makes no noise |
| SPADE | hand | Whack | Lean and chat | Dig | **DIG on a scavenge site:** reveals all faces |
| WATERING CAN | hand | Splash | Water their plant | Flood out | **SOW:** also applies +1 SOW automatically at the start of your next turn |
| SEED POUCH | hand | Seeds in the eyes | Give seeds | Read the soil | **SOW:** each enemy face fully turned by this sentence gives +1 reroll next turn |
| GLASSES | eye | Glint | Look learned | Read closely | **DIG:** reveals the next **2** enemy intents |
| LANTERN | eye | Dazzle | Warm light | Light up | This eye face counts as matching (2 points) under **any** verb |
| WHISTLE | mouth | Shriek | Call softly | Echo | **SOW vs enemies tagged `animal`:** this die's points ×2 |

The preview must show the item name and mention the special when it triggers, e.g. "Situation: Look 2 → Stab 4+2 (knife +1) → PRUNE 6".

### Enemies (each is one 6-faced die; every face has pips)
Each enemy gets `tags`, `pruneMod` and `sowMod` (added once to the sentence total for that verb, minimum 0), and rewards for both endings.

**STRAY DOG** (tags: animal), as in v0. pruneMod 0, sowMod 0.
- BITE ×2 (2 pips, hostile): scar a random non-scar face on HAND or HEAD.
- GROWL ×2 (2 pips, hostile): 1 fewer reroll next turn.
- SNIFF (2 pips, hostile): nothing.
- WHIMPER (2 pips, not hostile).
- **Beaten:** choose 1 of {WHISTLE, SPADE}. **Befriended:** in M1 choose 1 of {WHISTLE, LANTERN}. In M2, it also reveals 4 random fogged map tiles.

**RIVAL GARDENER** (tags: human). pruneMod −1, sowMod +1.
- SNIP ×2 (3 pips, hostile): removes a random item from your dice (no scar). The item goes into the gardener's bag, and you get it back if you **beat** them.
- BOAST ×2 (1 pip, hostile): 1 fewer reroll next turn.
- HAGGLE ×2 (1 pip, not hostile): nothing.
- **Beaten:** SHEARS + any items it snipped. **Befriended:** choose 1 of {SEED POUCH, WATERING CAN}.

**CROW FLOCK** (tags: animal). pruneMod +1, sowMod −2.
- PECK ×2 (1 pip, hostile): scar.
- CAW (1 pip, hostile): 1 fewer reroll.
- STEAL (2 pips, hostile): removes a random item to their nest. You get it back if you **beat** them.
- CIRCLE ×2 (1 pip, not hostile).
- **Beaten:** LANTERN + nest items. **Befriended:** choose 1 of {GLASSES, KNIFE}.

Win and lose work as in v0, per enemy: win when no hostile faces are left. BEATEN vs BEFRIENDED is decided by majority of resolved hostile faces.

### Reward screen
After a won encounter, show "BEATEN" or "BEFRIENDED", then the item(s) as big tiles. If it's a choice, the player picks one. The result goes to the **inventory**. Then go straight to the **placement screen**.

### Placement screen (the important new UI)
- Show HAND and HEAD dice **unfolded as a cross-shaped die net** (6 faces each). Each face shows its body part, scar state and current item.
- The inventory tray holds unplaced items. **Drag an item onto a face**:
  - It can only drop on a face whose body part matches the item's `part` and that isn't a scar. Valid faces highlight while dragging; invalid ones shake.
  - Dropping onto a face that already has an item **replaces** it, and the old item is discarded (confirm with a small "replace? discard X" tile).
- After a **reward**, you may only place new items. Existing placements are locked. Items left in the inventory are kept for later.
- At a **campfire**, you may freely move any placed item between valid faces, or back to the inventory.
- Show the **odds**: under each die, a mini summary like "HAND: 2× knife, 1× shears, 3× bare = 1/3 stab chance".
- Juice: items snap onto faces with a squash, the die net does a little spin preview, and hovering a face shows its 3 verb names.

### M1 flow
DOG → reward + place → RIVAL GARDENER → reward + place → **CAMPFIRE** → CROW FLOCK → reward + place → end screen. The end screen shows the final dice nets, scars and the turn log.

**Campfire:** choose **one**: heal 1 scar (the face returns as a bare body part; its item is not restored) **or** free rearranging of all items. Show the two options as two big tiles.

---

## M2: map, daylight, scavenging

### Map
- Grid **6 columns × 4 rows** (CONFIG). START is in the left column, middle row. GATE is in the right column, random row.
- Tile types (CONFIG weights): **CHARACTER 35%** (random of the 3 enemies), **SCAVENGE 30%** (random site), **CAMPFIRE 10%**, **EMPTY 25%**. Guarantee at least 1 campfire in columns 2–4 and at least one path from start to gate.
- **Fog:** you see the type icon of tiles orthogonally adjacent to any visited tile. Everything else is fog.
- Move one tile orthogonally per step. **Daylight** starts at **12** and each move costs 1. At 0 daylight, each further move gives +1 scar ("the cold").
- A resolved tile becomes EMPTY. The map shows visited tiles, daylight as a row of sun tiles, and scars as a row of scar tiles.
- **Reaching the GATE wins the trip.** The end screen shows the dice nets, items, scars, daylight left and the log.
- Style it in the same word-tile look: each tile is a small word block (DOG, HEAP, FIRE, …).

### Scavenge sites (encounter against a place)
A site is a 6-faced die whose faces hide **contents** under pips. Contents are hidden until revealed or opened. There's no intent; instead there's a **NOISE** track (max `CONFIG.noiseMax` = 6).
- **Targeting:** before committing, the player may click a site face to target it. Points go to that face first, then overflow to the next unopened face.
- **PRUNE (force):** removes pips. **+1 noise per point.** If PRUNE removes 2+ more pips than an ITEM face had left (overkill), the item breaks into JUNK.
- **DIG (search):** reveals the contents of as many faces as its points (it still passes points forward as normal).
- **SOW (coax):** removes pips at half rate (floor of points / 2, minimum 1). No noise.
- **Each turn adds +1 noise** (time passes).
- An opened face gives its content: **ITEM** (random from the site's pool, into inventory), **JUNK** (nothing), **NOTHING**, **RATS** (1 scar, +2 noise), **TRAP** (1 scar).
- **LEAVE** button at any time: you keep what you opened.
- **When noise is full, the site's guardian arrives:** a normal fight starts immediately. Afterwards the site is done.
- After leaving a site with new items, go to the placement screen.

| Site | Faces (contents) | Pips per face | Item pool | Guardian |
|---|---|---|---|---|
| COMPOST HEAP | ITEM, ITEM, JUNK, RATS, NOTHING, NOTHING | 2 | SEED POUCH, WATERING CAN, SPADE | STRAY DOG |
| GARDEN SHED | ITEM, ITEM, ITEM, JUNK, NOTHING, TRAP | 3 | SHEARS, KNIFE, LANTERN, GLASSES | CROW FLOCK |
| OLD WELL | ITEM, NOTHING, NOTHING, NOTHING, JUNK, RATS | 1 | WHISTLE, LANTERN | RIVAL GARDENER |

### Character tiles
Same fights as in M1. The dog's befriend reward reveals 4 fogged tiles.

---

## Debug panel additions
- Give any item to the inventory
- Reveal the whole map
- Set daylight, noise and scars
- Jump straight to any encounter or site
- Toggle "show site contents"

## Out of scope
Souls, emotions, thoughts, developing the MIND die, interrogation at the gate, more than 3 verbs, saving, mobile layout, menus, tutorial beyond one help line.

## Acceptance checklist
**M1**
- [ ] The 3-fight sequence is playable to the end, with reward → placement after each win and one campfire.
- [ ] Items can only be placed on matching, non-scarred faces. Replacing discards the old item with confirmation.
- [ ] A scar destroys the item on that face. SNIP and STEAL remove items, and beating that enemy returns them.
- [ ] Every item special works and shows in the preview.
- [ ] pruneMod and sowMod change totals as configured (e.g. the crows are hard to talk to).
- [ ] The odds summary under each die updates live during placement.

**M2**
- [ ] A random map is generated with fog, a guaranteed path, and at least 1 campfire. Daylight counts down and the cold scars you.
- [ ] Scavenge sites: targeting, PRUNE noise and overkill breaking, DIG reveal, SOW half rate, LEAVE, guardian fight on full noise.
- [ ] Reaching the gate shows the end screen. Hitting max scars shows the lose screen.
- [ ] All new content lives in CONFIG.

## What we want to learn
1. Does placing items create real choices (stack knives vs spread items vs keep bare faces)?
2. Do item specials make different "builds" feel different within one trip?
3. Does scavenging with noise feel like push-your-luck, and do players use DIG before PRUNE?
4. Is the map pressure (daylight + persistent scars) about right for ~10 minutes of play?
5. Do players pick fights to beat vs befriend based on the reward they want?

## Addendum (user, during planning)
- SOW should be **blue** (intellect / persuasion). Verb colours carry meaning; add a tooltip explaining each verb.
- No sound. Animations only react to player interaction (no idle/looping motion).
