# Task for Claude Code: Smuggler dice-sentence prototype v0

## Goal

Build a **tiny, playable HTML prototype** of one encounter, so we can feel whether building a "sentence" from dice is fun. It must be simple, readable and **satisfying to fiddle with**. Clarity and juice matter more than features.

Deliver **one self-contained `index.html`** (vanilla JS + CSS, no build step, no external libraries except optionally one Google Font). It opens by double-click.

## Rules to implement (v0)

### Player dice (3)

Each die has 6 faces. The current face is shown; hovering shows all 6.

- **MIND** (verb): PRUNE, PRUNE, SOW, SOW, DIG, DIG

- **HAND**: HAND, HAND, HAND, HAND, HAND+KNIFE, HAND+KNIFE

- **HEAD**: EYE, EYE+GLASSES, EYE+GLASSES... use exactly: EYE, EYE+GLASSES, EYE+GLASSES, MOUTH, MOUTH, MOUTH

### Body parts and favourite verbs

- HAND → PRUNE

- MOUTH → SOW

- EYE → DIG

### Turn

- The enemy die is already rolled and its face is shown as its **intent**.

- Press **ROLL**: all 3 player dice roll.

- Up to **2 rerolls**. Click a die to hold/unhold it, then press REROLL; held dice stay.

- **Arrange** the 3 dice into the SENTENCE row (3 slots, left to right) by drag & drop, with click-to-place as a fallback. All 3 dice must be placed.

- While arranging, a **live preview** shows the sentence name and result (see "Preview text").

- Press **COMMIT** to resolve the sentence left to right, with a short animation per die.

- The enemy acts (its intent face resolves), then rolls its next intent. Next turn.

### Resolving a sentence (left to right)

- Dice **after** the MIND die use the mind's verb.

- Dice **before** the MIND die act on **instinct**, using their body part's favourite verb.

- The MIND die itself scores 0. It only sets the verb.

- **Points per body die:** 2 if the verb it performs equals its favourite verb, otherwise 1. +1 if it has an item (KNIFE or GLASSES). A SCAR face scores 0 and does nothing.

- **DIG:** a DIG die reveals the enemy's **next** intent in advance (show it greyed under the current one), and **adds its points to the next body die in the sentence**. A DIG with no body die after it only reveals.

- **PRUNE X:** break X points' worth of enemy faces. Each enemy face has 2 toughness pips. Remove pips starting with the currently shown intent face, then other hostile faces.

- **SOW X:** turn X points' worth of pips the same way. A face whose pips are all turned becomes **turned** (harmless, green).

- A face can be partly broken and partly turned. When all its pips are gone it counts as broken if most pips were broken, otherwise as turned (ties count as turned).

### Enemy: STRAY DOG (one die, 6 faces, 2 pips each)

BITE, BITE, GROWL, GROWL, SNIFF, WHIMPER

- **BITE:** one random non-scar face on one of your HAND or HEAD dice becomes **SCAR**. Animate it.

- **GROWL:** you get 1 fewer reroll next turn.

- **SNIFF:** nothing (flavour text: "it sniffs your pockets").

- **WHIMPER:** nothing. WHIMPER does **not** count as hostile.

- When rolling its intent, a broken face is rerolled. If it lands on a turned face, it shows the face as "wags its tail" and does nothing.

### Win / lose

- **Win** when no hostile faces (BITE, GROWL, SNIFF) remain unbroken or unturned. Show **"BEATEN"** if more of its faces were broken, or **"BEFRIENDED"** if more were turned.

- **Lose** when you have 4 SCARs.

- A **RESTART** button.

## Preview text (readability is the point)

Generate a short sentence plus the total for every arrangement. For example:

- `[PRUNE] EYE KNIFE` → "Plan: Glare 1 · Stab 3 → PRUNE 4"

- `EYE [PRUNE] KNIFE` → "Situation: Look 2 (reveal) → Stab 3+2 → PRUNE 5"

- `KNIFE EYE [PRUNE]` → "Impulse: Stab 3 · Look 2 (reveal) → PRUNE 3"

Shape names come from the MIND position: first = **Plan**, middle = **Situation**, last = **Impulse**.

Action names by verb × body part:

|  | PRUNE | SOW | DIG |
|---|---|---|---|
| HAND | Hit | Gesture | Search |
| HAND+KNIFE | Stab | Threaten | Pry |
| MOUTH | Insult | Small talk | Ask |
| EYE | Glare | Kind look | Look |
| EYE+GLASSES | Glint | Look learned | Read closely |

Put all names and numbers in **one CONFIG object at the top of the script**, so designers can tweak them without reading the code.

## Visual direction: Baba Is You–inspired, original art

Take the *feel* of Baba Is You, not its assets.

- Dark, flat background (near-black). Chunky, blocky, uppercase **word tiles**: dice faces are shown as bold word blocks (PRUNE, HAND, KNIFE), each verb/body part with its own saturated colour. Verbs share one colour family, body parts another, items a third.

- Tiles **wobble** with a subtle idle wiggle (a 2–3 frame jitter like hand-drawn animation), done with CSS transforms on a timer.

- The SENTENCE row looks like a rule being formed: three tile slots on one line with a small arrow between slots. When the sentence is complete and valid, the tiles **light up** together.

- **Juice:** dice snap into slots with a little squash and stretch; rolling shuffles faces quickly before settling; COMMIT plays each tile in turn with a pop; hits shake the enemy die; SCAR tiles crack; turned faces flip to green. Optional tiny WebAudio blips (no audio files), with a mute toggle.

- Keep the layout on one screen with no scrolling at a 1280×720 laptop size: enemy at the top, sentence row in the middle, your dice and buttons at the bottom, preview text under the sentence row.

- Pixel-ish feel through CSS (hard edges, `image-rendering: pixelated` if using canvas, a chunky display font). Don't copy Baba Is You sprites, fonts or logos.

## Debug / tuning panel (collapsible)

- Toggle "show all enemy faces and pips"

- Buttons: set any player die to a chosen face (to test specific sentences quickly), add or remove rerolls, reset the enemy

- A small **log** of the last turns, e.g. "T3: EYE [PRUNE] KNIFE → PRUNE 5, broke BITE; dog GROWLs"

## Out of scope (don't build)

Map, souls, emotions, thoughts, more enemies, more items, saving, mobile layout, menus, a tutorial beyond one line of help text.

## Acceptance checklist

- [ ] A full fight against the dog can be won both ways ("BEATEN" and "BEFRIENDED") and lost.

- [ ] The three example arrangements above produce exactly the shown numbers.

- [ ] The preview updates instantly whenever the dice order changes.

- [ ] Rerolls and holding work; GROWL reduces next turn's rerolls.

- [ ] DIG reveals the next intent and passes points forward correctly.

- [ ] All tuning values live in CONFIG.

- [ ] It feels nice to drag tiles around (snap, wobble, light-up).

## What we want to learn from playing it

- Is rerolling and arranging fun (Balatro-like), or a chore?

- Do players use Situation / Plan / Impulse on purpose?

- Does putting the MIND last really rescue a bad verb roll?

- Do PRUNE and SOW feel like different approaches?
