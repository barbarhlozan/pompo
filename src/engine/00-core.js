// ENGINE: RNG, string helpers, item lookups.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

// ---------- helpers ----------
function makeRng(seed) {                             // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, n) { return Math.min(n - 1, Math.floor(rng() * n)); }
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] !== undefined ? o[k] : m));
const signed = (n) => (n < 0 ? '−' : '+') + Math.abs(n);

const SCAR = CONFIG.text.scar;                       // face key of a scarred face
const RULES = CONFIG.itemRules;
const itemDef = (id) => (id && CONFIG.items[id]) || null;
const specialOf = (id) => { const d = itemDef(id); return d ? d.special : null; };
