// ENGINE: Public API: globalThis.SmugEngine.
// Classic script: top-level names are shared with the other src/engine/*.js files (formerly one IIFE). No DOM, no timers, RNG injected.

globalThis.SmugEngine = {
  makeRng, parseFace, scoreBodyFace, scoreDetail, evaluateSentence, evaluatePartial, actionName,
  createPlayer, currentFace, rollDie, toggleHold, rerollUnheld, countScars,
  createEnemy, faceStatus, isResolved, isHostile, applyVerb, rollIntent, enemyAct, checkWin, checkLose,
  createGame, startTurn, resolveTurn,
  createTrip, randomSequence, labelFor, tripScars, startEncounter, rewardsFor, claimReward, addToInventory,
  beginPlacement, endPlacement, canPlace, isLocked, placeItem, moveItem, unplaceItem, healScar, oddsSummary,
  isCampfire, advanceStage,
  // v2 (data-driven dice, slots, charges)
  bodyDieIds, mindDieIds, scarTargetIds, dieLabel, favouriteOf, failedDie, loseInfo, holdOver, usesLeft, inventoryUses,
  // M2
  createTripM2, generateMap, mapHasPath, mapView, tileWord, isVisible, legalMoves, moveTo, finishTile, revealTiles,
  startSite, createSite, startSiteTurn, setSiteTarget, sitePreview, resolveSiteTurn, leaveSite, inflictScar,
};
