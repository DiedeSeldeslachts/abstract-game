import assert from "node:assert/strict";

import {
  applyMove,
  createEmptyState,
  createInitialState,
  getLegalMoves,
  getPiece,
  playerControlsBothTowns,
  getRemainingPieceCounts,
  toAlgebraic
} from "../src/game.js";
import { chooseAIMove } from "../src/ai.js";

function placePiece(state, row, col, player, type, suffix = "1") {
  state.board[row][col] = {
    id: `${player}-${type}-${suffix}`,
    player,
    type
  };
}

(function testInitialSetup() {
  const state = createInitialState();
  const counts = getRemainingPieceCounts(state);

  assert.equal(counts.white, 16);
  assert.equal(counts.black, 16);
  assert.equal(state.currentPlayer, "white");
  assert.equal(getPiece(state, 0, 2)?.type, "commander");
  assert.equal(getPiece(state, 0, 5)?.type, "commander");
  assert.equal(getPiece(state, 0, 1)?.type, "sentinel");
  assert.equal(getPiece(state, 0, 6)?.type, "sentinel");
  assert.equal(getPiece(state, 0, 3)?.type, "teacher");
  assert.equal(getPiece(state, 0, 0)?.type, "horse");
  assert.equal(getPiece(state, 0, 7)?.type, "horse");
  assert.equal(getPiece(state, 0, 4)?.type, "pawn");
  assert.equal(getPiece(state, 8, 2)?.type, "commander");
  assert.equal(getPiece(state, 8, 5)?.type, "commander");
  assert.equal(getPiece(state, 8, 1)?.type, "sentinel");
  assert.equal(getPiece(state, 8, 6)?.type, "sentinel");
  assert.equal(getPiece(state, 8, 4)?.type, "teacher");
  assert.equal(getPiece(state, 8, 0)?.type, "horse");
  assert.equal(getPiece(state, 8, 7)?.type, "horse");
  assert.equal(getPiece(state, 8, 3)?.type, "pawn");
})();

(function testTeacherCanTargetFriendlyNonTeacherPiecesForTransform() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "teacher");
  placePiece(state, 4, 5, "white", "pawn");
  placePiece(state, 3, 3, "white", "sentinel");
  placePiece(state, 5, 5, "white", "commander");
  placePiece(state, 1, 1, "white", "pawn", "far");

  const moves = getLegalMoves(state, 4, 4);
  const transformOnPawn = moves.find((move) => move.row === 4 && move.col === 5 && move.transform);

  assert.ok(transformOnPawn);
  assert.deepEqual(transformOnPawn.transformOptions.sort(), ["commander", "horse", "sentinel"]);
  assert.ok(!moves.some((move) => move.row === 4 && move.col === 4 && move.transform));
  assert.ok(!moves.some((move) => move.row === 1 && move.col === 1 && move.transform));
})();

(function testHorseMovesOneOrTwoSquaresStraight() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "horse");

  const moves = getLegalMoves(state, 4, 4).map((square) => toAlgebraic(square)).sort();

  assert.deepEqual(moves, ["c3", "c5", "c7", "d4", "d5", "d6", "e3", "e4", "e6", "e7", "f4", "f5", "f6", "g3", "g5", "g7"]);
})();

(function testHorseRequiresEmptyIntermediateSquare() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "horse");
  placePiece(state, 3, 4, "black", "pawn", "blocker");

  const moves = getLegalMoves(state, 4, 4);

  assert.ok(!moves.some((move) => move.row === 2 && move.col === 4));
  assert.ok(moves.some((move) => move.row === 3 && move.col === 4 && move.capture));
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
  assert.equal(nextState.lastAction?.transformedFrom, "pawn");
  assert.equal(nextState.lastAction?.transformedTo, "commander");
})();

(function testEnemyCannotEnterSentinelShield() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 2, 4, "black", "pawn");

  const moves = getLegalMoves(state, 2, 4);

  assert.ok(!moves.some((move) => move.row === 3 && move.col === 4));
})();

(function testEnemyCannotLeaveSentinelShield() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 3, 4, "black", "pawn");

  const moves = getLegalMoves(state, 3, 4);

  assert.ok(!moves.some((move) => move.row === 2 && move.col === 4));
  assert.ok(moves.some((move) => move.row === 4 && move.col === 4 && move.capture));
})();

(function testEnemyCanMoveWithinSentinelShield() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 3, 4, "black", "pawn");

  const moves = getLegalMoves(state, 3, 4);

  assert.ok(moves.some((move) => move.row === 3 && move.col === 3));
})();

(function testFriendlyPiecesIgnoreOwnSentinelShield() {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 2, 4, "white", "pawn");

  const moves = getLegalMoves(state, 2, 4);

  assert.ok(moves.some((move) => move.row === 3 && move.col === 4));
})();

(function testUniversalAdjacentMovement() {
  const state = createInitialState();
  const pawnMoves = getLegalMoves(state, 1, 4).map((square) => toAlgebraic(square)).sort();

  assert.deepEqual(pawnMoves, ["d7", "e7", "f7"]);
})();

(function testCommanderMovesSingleStepOnly() {
  const state = createEmptyState();

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 2, 4, "black", "pawn");

  const moves = getLegalMoves(state, 4, 4);

  assert.ok(!moves.some((move) => move.row === 2 && move.col === 4));
  assert.ok(moves.some((move) => move.row === 3 && move.col === 4));
})();

(function testAdjacentPawnCanHopOverFriendlyPiece() {
  const state = createEmptyState();

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 4, 3, "white", "pawn");
  placePiece(state, 3, 3, "white", "pawn", "blocker");
  placePiece(state, 2, 3, "black", "pawn", "target");

  const moves = getLegalMoves(state, 4, 3);

  assert.ok(moves.some((move) => move.row === 2 && move.col === 3 && move.capture));
})();

(function testPawnCannotHopWithoutAdjacentCommander() {
  const state = createEmptyState();

  placePiece(state, 4, 3, "white", "pawn");
  placePiece(state, 3, 3, "white", "pawn", "blocker");
  placePiece(state, 2, 3, "black", "pawn", "target");

  const moves = getLegalMoves(state, 4, 3);

  assert.ok(!moves.some((move) => move.row === 2 && move.col === 3));
})();

(function testBlockedFriendlySquareAndEnemyCapture() {
  const state = createEmptyState();

  placePiece(state, 4, 3, "white", "pawn");
  placePiece(state, 5, 2, "white", "pawn");
  placePiece(state, 3, 4, "black", "pawn");

  const moves = getLegalMoves(state, 4, 3);

  assert.equal(moves.length, 7);
  assert.ok(moves.some((move) => move.row === 3 && move.col === 4 && move.capture));
  assert.ok(!moves.some((move) => move.row === 5 && move.col === 2));
})();

(function testLastCaptureWins() {
  const state = createEmptyState();

  placePiece(state, 7, 0, "white", "pawn");
  placePiece(state, 6, 1, "black", "pawn");

  const nextState = applyMove(state, { row: 7, col: 0 }, { row: 6, col: 1 });
  const counts = getRemainingPieceCounts(nextState);

  assert.equal(nextState.winner, "white");
  assert.equal(counts.black, 0);
  assert.equal(nextState.capturedPieces.white.length, 1);
})();

(function testAISelectsAvailableCapture() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "black", "pawn");
  placePiece(state, 3, 3, "white", "pawn");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.from.row, 4);
  assert.equal(move.from.col, 4);
  assert.equal(move.to.row, 3);
  assert.equal(move.to.col, 3);
  assert.equal(move.capture, true);
})();

(function testAIPrefersCaptureOverTeacherTransformWhenBothAvailable() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "black", "teacher");
  placePiece(state, 4, 5, "black", "pawn");
  placePiece(state, 3, 3, "white", "pawn", "target");
  placePiece(state, 0, 0, "white", "pawn", "extra");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.from.row, 4);
  assert.equal(move.from.col, 4);
  assert.equal(move.to.row, 3);
  assert.equal(move.to.col, 3);
  assert.equal(move.capture, true);
  assert.equal(move.transform, false);
})();

(function testAIIsDeterministicForSameState() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "black", "pawn");
  placePiece(state, 1, 1, "white", "pawn");

  const first = chooseAIMove(state, "black");
  const second = chooseAIMove(state, "black");

  assert.deepEqual(first, second);
})();

(function testAIPrefersCapturingOnTownSquare() {
  const state = createEmptyState("black");

  placePiece(state, 5, 2, "black", "pawn");
  placePiece(state, 4, 2, "white", "pawn", "town-target");
  placePiece(state, 4, 3, "white", "pawn", "regular-target");
  placePiece(state, 0, 0, "white", "pawn", "extra");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.from.row, 5);
  assert.equal(move.from.col, 2);
  assert.equal(move.to.row, 4);
  assert.equal(move.to.col, 2);
  assert.equal(move.capture, true);
})();

(function testAIPrefersForwardProgressWithoutCaptures() {
  const state = createEmptyState("black");

  placePiece(state, 6, 3, "black", "pawn");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.from.row, 6);
  assert.equal(move.from.col, 3);
  assert.equal(move.to.row, 5);
  assert.equal(move.to.col, 2);
  assert.equal(move.capture, false);
})();

(function testTownControlSquares() {
  const state = createEmptyState();

  placePiece(state, 4, 2, "white", "pawn");
  placePiece(state, 4, 5, "white", "pawn");

  assert.equal(playerControlsBothTowns(state, "white"), true);
  assert.equal(playerControlsBothTowns(state, "black"), false);
})();

(function testTownControlDoesNotWinImmediately() {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 5, 5, "white", "pawn", "b");
  placePiece(state, 8, 7, "black", "pawn", "a");

  const nextState = applyMove(state, { row: 5, col: 5 }, { row: 4, col: 5 });

  assert.equal(playerControlsBothTowns(nextState, "white"), true);
  assert.equal(nextState.winner, null);
  assert.equal(nextState.townControlPendingPlayer, "white");
})();

(function testTownControlWinsAfterFullRound() {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 5, 5, "white", "pawn", "b");
  placePiece(state, 8, 7, "black", "pawn", "a");

  const whiteMove = applyMove(state, { row: 5, col: 5 }, { row: 4, col: 5 });
  const blackMove = applyMove(whiteMove, { row: 8, col: 7 }, { row: 7, col: 7 });

  assert.equal(blackMove.currentPlayer, "white");
  assert.equal(blackMove.winner, "white");
})();

(function testTownControlCanBeBrokenBeforeNextTurn() {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 5, 5, "white", "pawn", "b");
  placePiece(state, 5, 6, "black", "pawn", "a");

  const whiteMove = applyMove(state, { row: 5, col: 5 }, { row: 4, col: 5 });
  const blackMove = applyMove(whiteMove, { row: 5, col: 6 }, { row: 4, col: 5 });

  assert.equal(playerControlsBothTowns(blackMove, "white"), false);
  assert.equal(blackMove.winner, null);
  assert.equal(blackMove.townControlPendingPlayer, null);
})();

console.log("Kingstep rules validation passed.");