import assert from "node:assert/strict";

import {
  applyMove,
  applyPassPush,
  applyPlacement,
  createEmptyState,
  createInitialState,
  getLegalMoves,
  getLegalPlacements,
  getPiece,
  getRemainingPieceCounts,
  getRemainingReserveCounts,
  playerControlsBothTowns,
  toAlgebraic
} from "../src/game.js";
import { chooseAIMove } from "../src/ai.js";

function placePiece(state, row, col, player, type, suffix = "manual") {
  state.board[row][col] = {
    id: `${player}-${type}-${suffix}`,
    player,
    type
  };
}

(function testInitialSetupHasOnlyTownPawns() {
  const state = createInitialState();
  const counts = getRemainingPieceCounts(state);

  assert.equal(counts.white, 1);
  assert.equal(counts.black, 1);
  assert.equal(state.currentPlayer, "white");
  assert.equal(getPiece(state, 4, 2)?.type, "pawn");
  assert.equal(getPiece(state, 4, 2)?.player, "white");
  assert.equal(getPiece(state, 4, 5)?.type, "pawn");
  assert.equal(getPiece(state, 4, 5)?.player, "black");
})();

(function testLegalPlacementsExcludeTownsAndOccupiedSquares() {
  const state = createInitialState();
  const placements = getLegalPlacements(state, "white");

  assert.ok(placements.length > 0);
  assert.ok(!placements.some((placement) => placement.to.row === 4 && placement.to.col === 2));
  assert.ok(!placements.some((placement) => placement.to.row === 4 && placement.to.col === 5));
})();

(function testApplyPlacementAdvancesToPushPhase() {
  const state = createInitialState();
  const nextState = applyPlacement(state, { row: 0, col: 2 }, "horse");

  assert.equal(getPiece(nextState, 0, 2)?.type, "horse");
  assert.equal(getPiece(nextState, 0, 2)?.player, "white");
  assert.equal(nextState.currentPlayer, "white");  // still white's turn (push phase)
  assert.equal(nextState.turnPhase, "push");
  assert.equal(nextState.lastAction?.kind, "place");
})();

(function testPlacedPieceCanBeCapturedImmediatelyOnNextTurn() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "pawn", "attacker");

  // Black places pawn in action phase
  const afterPlacement = applyPlacement(state, { row: 3, col: 4 }, "pawn");
  // Pass black's push phase to complete the turn
  const afterBlackTurn = applyPassPush(afterPlacement);

  // Now it's white's action phase: white pawn at (4,4) can capture black pawn at (3,4)
  const whiteMoves = getLegalMoves(afterBlackTurn, 4, 4);

  assert.ok(whiteMoves.some((move) => move.row === 3 && move.col === 4 && move.capture));

  const afterCapture = applyMove(afterBlackTurn, { row: 4, col: 4 }, { row: 3, col: 4 });

  assert.equal(afterCapture.lastAction?.kind, "capture");
  assert.equal(afterCapture.lastAction?.capturedPiece?.player, "black");
  assert.equal(afterCapture.capturedPieces.white.length, 1);
})();

(function testCannotPlaceOnTownSquare() {
  const state = createInitialState();

  assert.throws(() => applyPlacement(state, { row: 4, col: 2 }, "pawn"), /town square/i);
})();

(function testPlacementLimitIsEnforced() {
  let state = createInitialState();
  const whiteSquares = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 0, col: 4 }
  ];
  const blackSquares = [
    { row: 8, col: 4 },
    { row: 8, col: 5 },
    { row: 8, col: 6 },
    { row: 8, col: 7 },
    { row: 8, col: 8 }
  ];

  for (let index = 0; index < 5; index += 1) {
    state = applyPlacement(state, whiteSquares[index], "pawn");
    state = applyPassPush(state);  // white push phase → black's turn
    state = applyPlacement(state, blackSquares[index], "pawn");
    state = applyPassPush(state);  // black push phase → white's turn
  }

  const whiteReserve = getRemainingReserveCounts(state, "white");
  assert.equal(whiteReserve.pawn, 0);

  assert.throws(() => applyPlacement(state, { row: 4, col: 4 }, "pawn"), /remaining pawn placements/i);
})();

(function testUniversalAdjacentMovementStillApplies() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "pawn", "mover");

  const moves = getLegalMoves(state, 4, 4).map((square) => toAlgebraic(square)).sort();

  assert.deepEqual(moves, ["d5", "d6", "e4", "e6", "f4", "f5"]);
})();

(function testHorseMovesOneOrTwoSquaresStraight() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "horse");

  const moves = getLegalMoves(state, 4, 4).map((square) => toAlgebraic(square)).sort();

  assert.deepEqual(moves, ["c5", "c7", "d5", "d6", "e3", "e4", "e6", "e7", "f4", "f5", "g3", "g5"]);
})();

(function testTeacherTransformChangesTypeWithoutMovingTeacher() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "teacher");
  placePiece(state, 4, 5, "white", "pawn");
  placePiece(state, 8, 7, "black", "pawn");

  const nextState = applyMove(
    state,
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { transformTo: "commander" }
  );

  assert.equal(getPiece(nextState, 4, 4)?.type, "teacher");
  assert.equal(getPiece(nextState, 4, 5)?.type, "commander");
  assert.equal(nextState.lastAction?.kind, "transform");
})();

(function testAdjacentPawnCanHopOverFriendlyPiece() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 4, 3, "white", "pawn");
  placePiece(state, 3, 3, "white", "pawn", "blocker");
  placePiece(state, 2, 3, "black", "pawn", "target");

  const moves = getLegalMoves(state, 4, 3);

  assert.ok(moves.some((move) => move.row === 2 && move.col === 3 && move.capture));
})();

(function testEnemyCanCaptureSentinel() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 3, 4, "black", "pawn");

  const moves = getLegalMoves(state, 3, 4);

  // Black pawn CAN capture the white sentinel
  assert.ok(moves.some((move) => move.row === 4 && move.col === 4 && move.capture));
})();

(function testEnemyCanCapturePawnAdjacentToSentinel() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 4, 5, "white", "pawn");
  placePiece(state, 4, 6, "black", "pawn");

  const moves = getLegalMoves(state, 4, 6);

  // Black pawn CAN capture the white pawn that is adjacent to the sentinel (no longer protected)
  assert.ok(moves.some((move) => move.row === 4 && move.col === 5 && move.capture));
})();

(function testSentinelCannotMove() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "sentinel");

  const moves = getLegalMoves(state, 4, 4);

  // Sentinel has no legal moves
  assert.ok(moves.length === 0);
})();

(function testTownControlSquares() {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 4, 5, "white", "pawn", "b");

  assert.equal(playerControlsBothTowns(state, "white"), true);
  assert.equal(playerControlsBothTowns(state, "black"), false);
})();

(function testTownControlWinsAfterFullRound() {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 5, 5, "white", "pawn", "b");
  placePiece(state, 8, 7, "black", "pawn", "a");

  // White action: move pawn to capture f5 (both towns occupied by white)
  const whiteAction = applyMove(state, { row: 5, col: 5 }, { row: 4, col: 5 });
  // White push phase: pass
  const afterWhiteTurn = applyPassPush(whiteAction);
  // Black action: move pawn away
  const blackAction = applyMove(afterWhiteTurn, { row: 8, col: 7 }, { row: 7, col: 7 });
  // Black push phase: pass (starts white's next turn with both towns)
  const afterBlackTurn = applyPassPush(blackAction);

  assert.equal(afterBlackTurn.currentPlayer, "white");
  assert.equal(afterBlackTurn.winner, "white");
})();

(function testAISelectsAvailableCapture() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "black", "pawn");
  placePiece(state, 3, 3, "white", "pawn");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.action, "move");
  assert.equal(move.from.row, 4);
  assert.equal(move.from.col, 4);
  assert.equal(move.to.row, 3);
  assert.equal(move.to.col, 3);
  assert.equal(move.capture, true);
})();

(function testAICanChoosePlacementAction() {
  const state = createInitialState();
  state.currentPlayer = "black";
  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.action, "place");
  assert.ok(move.placeType);
  assert.equal(move.from, null);
})();

(function testAIPlacementNeverTargetsTownSquares() {
  const state = createEmptyState("black");

  placePiece(state, 8, 7, "white", "pawn", "alive");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.action, "place");
  assert.ok(!(move.to.row === 4 && move.to.col === 2));
  assert.ok(!(move.to.row === 4 && move.to.col === 5));
})();

console.log("Kingstep rules validation passed.");

(function testPushPhaseHasPushMovesAndNoCaptures() {
  const state = createEmptyState("white");

  placePiece(state, 4, 3, "white", "pawn", "mover");
  placePiece(state, 4, 4, "black", "pawn", "target");

  // White action phase: capture black pawn neighbour
  const afterAction = applyMove(state, { row: 4, col: 3 }, { row: 3, col: 3 });

  assert.equal(afterAction.turnPhase, "push");
  assert.equal(afterAction.currentPlayer, "white");

  // In push phase, white pawn at (3,3) is adjacent to black pawn at (4,4)
  // Push should be there (to (5,5)), and no capture moves
  const pushMoves = getLegalMoves(afterAction, 3, 3);

  assert.ok(!pushMoves.some((m) => m.capture), "push phase must not have capture moves");
})();

(function testPushMoveDisplacesEnemyPiece() {
  const state = createEmptyState("white");

  placePiece(state, 4, 3, "white", "pawn", "pusher");
  placePiece(state, 4, 4, "black", "pawn", "pushed");
  placePiece(state, 8, 7, "black", "pawn", "anchor");

  // Advance to push phase via a neutral action move first
  const afterAction = applyMove(state, { row: 4, col: 3 }, { row: 3, col: 3 });

  // White pawn at (3,3) adjacent to black at (4,4) along step (1,1)
  // Push target: (5,5) — must be empty and on-board
  const pushMoves = getLegalMoves(afterAction, 3, 3);
  const pushMove = pushMoves.find((m) => m.push && m.row === 4 && m.col === 4);

  assert.ok(pushMove, "push move to (4,4) must exist");
  assert.deepEqual(pushMove.pushTo, { row: 5, col: 5 });

  const afterPush = applyMove(afterAction, { row: 3, col: 3 }, { row: 4, col: 4 });

  assert.equal(getPiece(afterPush, 4, 4)?.player, "white", "pusher now on (4,4)");
  assert.equal(getPiece(afterPush, 5, 5)?.player, "black", "pushed piece now on (5,5)");
  assert.equal(getPiece(afterPush, 3, 3), null, "origin is empty");
  assert.equal(afterPush.lastAction?.kind, "push");
  assert.equal(afterPush.currentPlayer, "black");  // full turn completed
  assert.equal(afterPush.turnPhase, "action");
})();
