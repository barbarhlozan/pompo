// UI: in-game dictionary: DICTIONARY button (bottom right, every screen) + overlay panel. Content = CONFIG.text.dictionary.
// Opening it never touches game state; `?` toggles, Esc / click outside / CLOSE closes.

function dictColor(e) {
  const k = e.key || e.term, K = C.colors;
  if (e.kind === 'verb') return K.verb[k];
  if (e.kind === 'body') return K.body[k];
  if (e.kind === 'item') return K.item[k];
  if (k === 'SCAR') return K.scar;
  return (K.site && K.site[k]) || K.lit;
}
function dictEntryHTML(e) {
  const col = dictColor(e) || C.colors.lit;
  const fg = e.key === 'SCAR' ? C.colors.scarText : C.colors.tileText;
  return '<div class="dent' + (e.big ? ' big' : '') + '"><span class="tile' + (e.big ? '' : ' small') + '" style="background:' + col + ';color:' + fg + '">' +
    esc(e.term) + '</span><span class="dtx">' + esc(e.text) + '</span></div>';
}
function dictOpen() { return $('dict').classList.contains('show'); }
function toggleDictionary(on) {
  const el = $('dict');
  const open = on === undefined ? !el.classList.contains('show') : on;
  el.classList.toggle('show', open);
}
function buildDictionary() {
  const U = C.text.dictionaryUi, list = C.text.dictionary;
  const btn = document.createElement('button');
  btn.id = 'btnDict'; btn.textContent = U.button; btn.title = U.buttonTip;
  btn.addEventListener('click', () => toggleDictionary());
  const el = document.createElement('div');
  el.id = 'dict';
  el.innerHTML = '<div class="dpanel"><div class="dhead"><span class="dttl">' + esc(U.title) + '</span><span class="dhint">' + esc(U.hint) + '</span>' +
    '<button class="btn" id="dictClose">' + esc(U.close) + '</button></div>' +
    '<div class="dverbs">' + list.filter(e => e.big).map(dictEntryHTML).join('') + '</div>' +
    '<div class="dcols">' + list.filter(e => !e.big).map(dictEntryHTML).join('') + '</div></div>';
  $('stage').append(btn, el);
  el.addEventListener('pointerdown', (e) => { if (e.target === el) toggleDictionary(false); });
  $('dictClose').addEventListener('click', () => toggleDictionary(false));
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === '?') { e.preventDefault(); toggleDictionary(); }
    else if (e.key === 'Escape' && dictOpen()) { e.preventDefault(); toggleDictionary(false); }
  });
}
