// UI: init(): build DOM, show start, expose window.SmugUI.
// Classic script: top-level names are shared with the other src/ui/*.js files (formerly one IIFE).

// ---------- boot ----------
function init() {
  buildDOM();
  ui.trip = E.createTrip(Math.random);       // placeholder behind the start screen
  showStart();
  window.SmugUI = { ui, dom, faceHTML, tileHTML, itemTileHTML, get view() { return view; }, get game() { return ui.game; }, get trip() { return ui.trip; },
    renderAll, syncView, EVENT_HANDLERS, hooks, SCREENS, enterStage, startTrip, showStart, openPlacement, closePlacement, takenText, showEnd, onContinue, buildEnemyPanel,
    jumpTo, giveItem, forceWin, addScars, forceLose, tryPlace, netHTML, setScars, setDaylight, setNoise, setShowMap, setShowSite, isSite, onMapMove, leaveSiteUI, advance,
    render: { renderAll, renderEnemy, renderDice, renderSlots, renderPreview, renderControls, renderOverlay, renderTopBar, renderScreen } };
}
document.addEventListener('DOMContentLoaded', init);
