// UI: Scavenge-site panel and cards.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// Scavenge site: the same panel slots as an enemy (label, meta, noise track instead of the intent tile, 6 face cards).
function buildSitePanel() {
  const site = ui.game, cfg = C.sites[site.siteId], M = MT();
  $('enemyLbl').textContent = site.name + ' · ' + M.siteLabel;
  const gd = C.enemies[site.guardian];
  $('enemyMeta').innerHTML = '<span class="chip">' + esc(M.guardian) + ': ' + esc(gd.name) + '</span><span>' + esc(M.rulesLine) + '</span>';
  $('bag').classList.add('hidden');
  $('noiseTrack').innerHTML = Array.from({ length: site.noiseMax }, () => '<span class="nb"></span>').join('');
  const strip = $('faceStrip');
  strip.innerHTML = '';
  dom.efc.length = 0;
  site.faces.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'efc site'; el.dataset.idx = i;
    el.innerHTML = '<div class="tag"></div><span class="tile"></span><div class="pips"></div><div class="sub"></div><span class="sfn">' + (i + 1) + '</span><div class="sel"></div>';
    const pips = el.querySelector('.pips');
    pips.title = C.text.strip.sitePipTip;
    for (let p = 0; p < f.pips; p++) { const sp = document.createElement('span'); sp.className = 'pip'; pips.appendChild(sp); }
    strip.appendChild(el); dom.efc.push(el);
  });
  void cfg;
}
// first unopened face of the (lagging) view; the explicit target wins
function viewTarget() {
  const sv = view.site;
  if (sv.target !== null && sv.faces[sv.target] && !sv.faces[sv.target].opened) return sv.target;
  return sv.faces.findIndex(f => !f.opened);
}
function renderSite() {
  const sv = view.site, M = MT(), SC = C.colors.site;
  const tgt = viewTarget();
  sv.faces.forEach((f, i) => {
    const el = dom.efc[i], tile = el.querySelector('.tile'), sub = el.querySelector('.sub');
    const known = f.opened || f.revealed;
    const ghost = !known && ui.showSite;
    let word, bg, cls = '', note = '';
    if (known || ghost) {
      if (f.content === 'ITEM' && f.item) { word = itemName(f.item); bg = C.colors.item[f.item] || SC.ITEM; }
      else { word = C.siteContents[f.content].label; bg = SC[f.content]; }
      if (f.opened && f.brokenItem) { word = itemName(f.brokenItem); bg = C.colors.item[f.brokenItem] || SC.ITEM; cls = ' strike'; note = M.brokeInto.replace('{item}', itemName(f.brokenItem)); }
      else if (f.opened) note = f.content === 'ITEM' ? M.got : '';
      else if (ghost) { cls = ' ghost'; note = ''; }
      else note = M.seen;
    } else { word = '?'; bg = SC.hidden; }
    tile.className = 'tile' + cls;
    tile.style.background = bg; tile.style.color = (known || ghost) && f.content !== 'NOTHING' ? C.colors.tileText : '#aaa';
    tile.textContent = word;
    sub.textContent = note;
    el.querySelectorAll('.pip').forEach((p, k) => { p.className = 'pip ' + f.pips[k]; });
    el.classList.toggle('opened', f.opened);
    const isCur = !f.opened && tgt === i && sv.target === i;
    el.classList.toggle('is-current', isCur);
    el.classList.toggle('is-next', !f.opened && tgt === i && sv.target !== i);
    el.dataset.status = f.opened ? 'opened' : 'closed';
    el.querySelector('.tag').textContent = f.opened ? '' : (tgt === i ? (sv.target === i ? M.target : M.first) : '');
    el.querySelector('.sel').textContent = !f.opened && tgt === i ? M.selected : '';
    el.title = f.opened ? '' : M.targetTip + (known ? '' : ' ' + M.hiddenTip);
  });
  $('noiseTrack').querySelectorAll('.nb').forEach((b, i) => {
    b.classList.toggle('on', i < sv.noise);
    b.classList.toggle('hot', i < sv.noise && sv.noise >= ui.game.noiseMax - 2);
  });
  $('intentText').textContent = M.noise + ' ' + sv.noise + '/' + ui.game.noiseMax;
  $('enemyText').textContent = ui.enemyText || (nothingLeft() ? M.nothingLeft : ' ');
  const nw = $('nextWrap');
  if (sv.found.length) {
    nw.innerHTML = '<span class="lbl">' + M.found + '</span>' + sv.found.map(id => itemTileHTML(id, 'small')).join('');
    nw.classList.remove('hidden'); nw.querySelectorAll('.tile').forEach(t => { t.style.opacity = 1; });
  } else { nw.classList.add('hidden'); nw.innerHTML = ''; }
  $('verbFlash').textContent = ui.verbFlash || '';
}
const nothingLeft = () => isSite() && ui.game.faces.every(f => f.opened);
function onSiteCardClick(e) {
  if (!isSite() || ui.screen !== 'encounter') return;
  if (ui.phase !== 'await-roll' && ui.phase !== 'arranging') return;
  const el = e.target.closest('.efc.site'); if (!el) return;
  const idx = Number(el.dataset.idx), site = ui.game;
  if (site.faces[idx].opened) return;
  const r = E.setSiteTarget(site, site.target === idx ? null : idx);
  if (!r.ok) return;
  view.site.target = site.target;
  renderSite(); renderPreview();
  hooks.onTarget(dom.efc[idx], site.target === idx);
}
function leaveSiteUI() {
  if (!isSite() || ui.screen !== 'encounter') return;
  if (ui.phase !== 'await-roll' && ui.phase !== 'arranging') return;
  const t = ui.trip, r = E.leaveSite(t);
  if (!r.ok) return;
  ui.runId++;
  if (r.placement) openPlacement('reward');
  else { advance(); enterStage(); }
}
