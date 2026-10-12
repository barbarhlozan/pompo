// ENGINE: M2 map: generation, visibility, moves, daylight, scars on the map.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- M2: map ----------
// trip.map = { cols, rows, tiles[row][col], start:{c,r}, gate:{c,r}, pos:{c,r} }
// tile = { c, r, type:'START'|'GATE'|'CHARACTER'|'SCAVENGE'|'CAMPFIRE'|'EMPTY', origin, enemyId|null, siteId|null, visited, revealed }
const MAPCFG = CONFIG.map;
const SR = CONFIG.siteRules;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];             // up, right, down, left
const tileAt = (map, c, r) => (r >= 0 && r < map.rows && c >= 0 && c < map.cols ? map.tiles[r][c] : null);
function weightedPick(rng, weights) {
  const keys = Object.keys(weights);
  let sum = 0; keys.forEach(k => { sum += weights[k]; });
  let x = rng() * sum;
  for (const k of keys) { x -= weights[k]; if (x < 0) return k; }
  return keys[keys.length - 1];
}
function neighbours(map, c, r) {
  const out = [];
  DIRS.forEach(d => { const t = tileAt(map, c + d[0], r + d[1]); if (t) out.push(t); });
  return out;
}
// Is there a walkable path (all tiles are walkable) from START to GATE? BFS, used by tests.
function mapHasPath(map) {
  const seen = new Set([map.start.c + ',' + map.start.r]);
  const q = [map.start];
  while (q.length) {
    const p = q.shift();
    if (p.c === map.gate.c && p.r === map.gate.r) return true;
    neighbours(map, p.c, p.r).forEach(t => {
      const k = t.c + ',' + t.r;
      if (!seen.has(k)) { seen.add(k); q.push(t); }
    });
  }
  return false;
}
function generateMap(rng) {
  const cols = MAPCFG.cols, rows = MAPCFG.rows;
  const sr = MAPCFG.startRow != null ? MAPCFG.startRow : Math.floor((rows - 1) / 2);
  const gr = randInt(rng, rows);
  const enemyIds = CONFIG.trip.enemyPool, siteIds = Object.keys(CONFIG.sites);
  const tiles = [];
  const detail = (t) => {
    t.enemyId = t.type === 'CHARACTER' ? enemyIds[randInt(rng, enemyIds.length)] : null;
    t.siteId = t.type === 'SCAVENGE' ? siteIds[randInt(rng, siteIds.length)] : null;
  };
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      let type;
      if (c === 0 && r === sr) type = 'START';
      else if (c === cols - 1 && r === gr) type = 'GATE';
      else type = weightedPick(rng, MAPCFG.weights);
      const t = { c, r, type, origin: type, enemyId: null, siteId: null, visited: false, revealed: false };
      detail(t);
      row.push(t);
    }
    tiles.push(row);
  }
  // guarantee a campfire in the campfire columns
  const [c0, c1] = MAPCFG.campfireCols;
  const band = [];
  let hasFire = false;
  for (let r = 0; r < rows; r++) for (let c = c0; c <= c1 && c < cols; c++) {
    const t = tiles[r][c];
    if (t.type === 'CAMPFIRE') hasFire = true;
    else if (t.type !== 'START' && t.type !== 'GATE') band.push(t);
  }
  if (!hasFire && band.length) {
    const t = band[randInt(rng, band.length)];
    t.type = t.origin = 'CAMPFIRE'; t.enemyId = null; t.siteId = null;
  }
  const map = { cols, rows, tiles, start: { c: 0, r: sr }, gate: { c: cols - 1, r: gr }, pos: { c: 0, r: sr } };
  tiles[sr][0].visited = true;
  return map;
}
// Tile specific word (DOG, HEAP, FIRE, ...), ignoring fog.
function tileWord(t) {
  if (t.type === 'CHARACTER') return MAPCFG.enemyWords[t.enemyId] || t.enemyId;
  if (t.type === 'SCAVENGE') return CONFIG.sites[t.siteId].word;
  return MAPCFG.words[t.type] || t.type;
}
// Visible = visited, revealed (dog), orthogonally adjacent to a visited tile, (optionally) the gate.
function isVisible(map, t) {
  if (t.visited || t.revealed) return true;
  if (MAPCFG.gateVisible && t.type === 'GATE') return true;
  return neighbours(map, t.c, t.r).some(n => n.visited);
}
// Render model: rows of cells. Fogged cells have type/word = null / FOG word and no enemyId/siteId.
function mapView(trip) {
  const map = trip.map;
  const moves = legalMoves(trip);
  return map.tiles.map(row => row.map(t => {
    const vis = isVisible(map, t);
    return { c: t.c, r: t.r, visible: vis, visited: t.visited, revealed: t.revealed, here: map.pos.c === t.c && map.pos.r === t.r,
      reachable: moves.some(m => m.c === t.c && m.r === t.r),
      type: vis ? t.type : null, word: vis ? tileWord(t) : MAPCFG.words.FOG,
      enemyId: vis ? t.enemyId : null, siteId: vis ? t.siteId : null };
  }));
}
function legalMoves(trip) {
  if (!trip.map || trip.over || trip.stage !== CONFIG.trip.mapStage) return [];
  const p = trip.map.pos;
  return neighbours(trip.map, p.c, p.r).map(t => ({ c: t.c, r: t.r }));
}
// Reveal n random fogged tiles (dog befriended). -> [{c,r}]
function revealTiles(trip, n, rng) {
  const map = trip.map;
  const fog = [];
  map.tiles.forEach(row => row.forEach(t => { if (!isVisible(map, t)) fog.push(t); }));
  const out = [];
  while (n > 0 && fog.length) {
    const t = fog.splice(rng ? randInt(rng, fog.length) : 0, 1)[0];
    t.revealed = true; out.push({ c: t.c, r: t.r }); n--;
  }
  return out;
}
// A random non-scar face on the scar-target dice becomes SCAR (its item is destroyed). -> events (empty if no face is left)
function inflictScar(trip, rng, cause, by) {
  const cands = [];
  scarTargetDice(trip.player).forEach(d => {
    d.faces.forEach((f, fi) => { if (f !== SCAR) cands.push({ d, fi }); });
  });
  if (!cands.length) return [];
  const c = cands[randInt(rng, cands.length)];
  const previous = c.d.faces[c.fi];
  c.d.faces[c.fi] = SCAR;
  dropUses(trip, c.d.id, c.fi);
  const events = [{ type: 'scar', dieId: c.d.id, faceIdx: c.fi, previous, wasCurrent: c.d.idx === c.fi, cause }];
  const item = parseFace(previous).item;
  if (item) events.push({ type: 'itemDestroyed', dieId: c.d.id, faceIdx: c.fi, item, cause, by: by || cause, wasCurrent: c.d.idx === c.fi });
  return events;
}
function scarLogText(events, by) {
  const sc = events.find(e => e.type === 'scar');
  if (!sc) return '';
  let t = ' (' + sc.dieId + ' ' + sc.previous + ' → ' + SCAR + ')';
  const it = events.find(e => e.type === 'itemDestroyed');
  if (it) t += ', ' + CONFIG.items[it.item].name + ' destroyed by ' + by;
  return t;
}
// Trip lost when scars reach the maximum. -> true if the trip was just lost
function tripLoseCheck(trip, events, cause) {
  if (!checkLose(trip.player)) return false;
  const info = loseInfo(trip.player);
  trip.over = 'lost'; trip.result = CONFIG.text.lost; trip.lostDie = info.dieId;
  events.push({ type: 'lose', scars: info.scars, dieId: info.dieId, dieLabel: info.dieLabel, rule: info.rule, cause });
  return true;
}
// Move one tile orthogonally. Costs daylight (at 0: the cold scars you), then triggers the tile.
// -> { ok, reason, events, entered:{tile,enemyId?,siteId?}|null, over, result, encounter, site }
function moveTo(trip, c, r, rng) {
  const out = { ok: false, reason: null, events: [], entered: null, over: trip.over, result: trip.result, encounter: null, site: null };
  if (!trip.map) { out.reason = 'no-map'; return out; }
  if (trip.over) { out.reason = 'over'; return out; }
  if (trip.stage !== CONFIG.trip.mapStage) { out.reason = 'not-on-map'; return out; }
  const map = trip.map, from = { c: map.pos.c, r: map.pos.r };
  const t = tileAt(map, c, r);
  if (!t) { out.reason = 'out-of-bounds'; return out; }
  if (Math.abs(c - from.c) + Math.abs(r - from.r) !== 1) { out.reason = 'not-adjacent'; return out; }
  out.ok = true;
  const ev = out.events;
  map.pos = { c, r };
  t.visited = true;
  trip.moves += 1;
  let cold = false;
  if (trip.daylight > 0) trip.daylight = Math.max(0, trip.daylight - MAPCFG.daylightPerMove);
  else cold = true;
  ev.push({ type: 'move', from, to: { c, r }, daylight: trip.daylight, moves: trip.moves, cold });
  trip.log.push('move ' + trip.moves + ': (' + from.c + ',' + from.r + ') → (' + c + ',' + r + '), daylight ' + trip.daylight);
  if (cold) {
    trip.coldHits += 1;
    ev.push({ type: 'cold', daylight: 0, coldHits: trip.coldHits, text: MAPCFG.text.cold });
    for (let k = 0; k < MAPCFG.coldScarsPerMove; k++) {
      const se = inflictScar(trip, rng, 'cold', MAPCFG.text.cold.toLowerCase());
      se.forEach(e => ev.push(e));
      trip.log.push(MAPCFG.text.coldLog + scarLogText(se, 'the cold'));
      if (tripLoseCheck(trip, ev, 'cold')) {
        trip.log.push(CONFIG.text.lost);
        trip.stage = null;
        out.over = trip.over; out.result = trip.result;
        return out;
      }
    }
  }
  // enter the tile
  const entered = { tile: t.type, enemyId: t.enemyId, siteId: t.siteId };
  out.entered = entered;
  ev.push({ type: 'enter', tile: t.type, enemyId: t.enemyId, siteId: t.siteId, c, r });
  if (t.type === 'CHARACTER') {
    trip.stage = t.enemyId;
    out.encounter = startEncounter(trip, t.enemyId, rng);
  } else if (t.type === 'SCAVENGE') {
    out.site = startSite(trip, t.siteId, rng, { c, r });
  } else if (t.type === 'CAMPFIRE') {
    trip.stage = CONFIG.trip.campfireId;
  } else if (t.type === 'GATE') {
    trip.over = 'won'; trip.result = CONFIG.text.tripComplete; trip.stage = null;
    ev.push({ type: 'tripWon', result: trip.result, daylight: trip.daylight });
    trip.log.push('the gate: ' + trip.result);
  }
  out.over = trip.over; out.result = trip.result;
  return out;
}
// The tile the player stands on is resolved: it becomes EMPTY; back to the map. (Called by advanceStage in M2.)
function finishTile(trip) {
  const t = trip.map && tileAt(trip.map, trip.map.pos.c, trip.map.pos.r);
  if (t && (t.type === 'CHARACTER' || t.type === 'SCAVENGE' || t.type === 'CAMPFIRE')) {
    t.type = 'EMPTY'; t.enemyId = null; t.siteId = null;
  }
  trip.site = null; trip.encounter = null; trip.placement = null;
  trip.stage = trip.over ? null : CONFIG.trip.mapStage;
  return trip.stage;
}
