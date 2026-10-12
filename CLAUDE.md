# Smuggler — dice-sentence game prototype

Single-page browser game (no deps, no sound). You roll dice, drag them into sentence slots, commit; faces become actions
against an enemy / scavenge site. Trips are an M1 sequence or an M2 fog map with daylight. Source lives in `src/`;
the root `index.html` is the **built**, shareable single file (never edit it by hand).

## Commands
```
node tests/engine.test.mjs   # engine tests (node:test + vm, loads src/config + src/engine)
node build.mjs               # src/ -> root index.html. Run before finishing any phase.
node serve.mjs               # dev server (PORT=8123); `/` = src/index.html, `/build` = built file
```
Preview: launch config `smug-prototype` (.claude/launch.json) serves `src/index.html` (edit, reload, no build).

## Files (classic scripts sharing globals; load order = `<script>` order in src/index.html)
- `src/index.html` markup + ordered `<link>/<script>` tags (source of truth for load order, also read by the tests)
- `src/styles.css` all CSS
- `src/config/` one global `CONFIG`, split by topic: `00-rules` core rules · `10-dice` player dice, body parts, action names ·
  `20-items` items + item rules · `30-enemies` effect rules + enemies · `40-world` trip, map, sites · `50-text` all strings ·
  `60-colors` · `70-timing` timing / fx / ui / debug
- `src/engine/` pure rules, was one IIFE; top-level names are shared: `00-core` rng/helpers · `10-sentence` faces, scoring,
  sentence evaluation · `20-player` dice, scars, charges · `30-enemy` enemy + its turn · `40-encounter` win/lose, trip,
  startTurn / resolveTurn · `50-rewards` rewards, stages · `60-placement` item placement, odds · `70-map` M2 map ·
  `80-site` scavenge sites · `90-api` exports `globalThis.SmugEngine`
- `src/ui/` DOM + view model (`SmugUI`), shared globals: `00-core` state/helpers/tokens · `10-render` static DOM + render fns ·
  `20-site` site panel · `30-encounter` slots/drag/roll/commit · `40-flow` trip flow, placement open/close, heal ·
  `50-map` map move · `60-controls` debug-facing controls · `70-screens` start/reward/campfire/end/map screens ·
  `80-placement` item drag onto faces · `90-events` engine-event player · `99-boot` init
- `src/fx.js` juice layer (`SmugFX`, own IIFE) · `src/debug.js` tuning drawer (`SmugDebug`, own IIFE)
- `tests/engine.test.mjs` engine tests · `build.mjs` · `serve.mjs`
- Docs: `DESIGN-V2.md` + `PLAN-V2.md` are the current spec/plan; `DESIGN*.md` v1/v0 and `PLAN.md`/`PLAN-V1.md` are history.

## Engine API entry points (`SmugEngine`, see src/engine/90-api.js)
`createTrip` / `createTripM2` (trip) → `startEncounter` / `startSite` → `startTurn`, `resolveTurn(state, slotOrder, rng)` /
`resolveSiteTurn` (return events) → `rewardsFor`, `claimReward`, `advanceStage`; placement: `beginPlacement`, `placeItem`,
`moveItem`, `unplaceItem`, `healScar`, `endPlacement`; map: `generateMap`, `legalMoves`, `moveTo`, `finishTile`;
pure helpers `evaluateSentence`, `scoreDetail`, `labelFor`, `oddsSummary`. RNG is always injected (`makeRng(seed)`).

## Conventions
- Everything tunable lives in `CONFIG` (numbers, text, colours, timing); engine reads it at call time. No hard-coded die ids.
- No sound. Animate only in reaction to player input; nothing idles.
- Engine stays pure (no DOM / timers) and tested; UI draws a view model that the event player advances step by step.
- New engine/ui code: add to the right file (or a new file + `<script>` tag in src/index.html). Top-level names in
  `engine/` are global to the page: don't reuse a name across engine, ui or config files (fx/debug are IIFEs).
- Tests slice nothing: they load `src/config/*` + `src/engine/*` listed in src/index.html into `node:vm`.
