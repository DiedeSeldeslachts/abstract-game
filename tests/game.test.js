import assert from "node:assert/strict";

import {
  applyMove,
  createEmptyState,
  createInitialState,
  getLegalMoves,
  getPiece,
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
  assert.equal(getPiece(state, 7, 3)?.type, "commander");
  assert.equal(getPiece(state, 7, 4)?.type, "commander");
  assert.equal(getPiece(state, 0, 3)?.type, "commander");
  assert.equal(getPiece(state, 0, 4)?.type, "commander");
})();

(function testUniversalKingMovement() {
  const state = createInitialState();
  const pawnMoves = getLegalMoves(state, 6, 4).map((square) => toAlgebraic(square)).sort();
  const commanderMoves = getLegalMoves(state, 7, 4);

  assert.deepEqual(pawnMoves, ["d3", "e3", "f3"]);
  assert.equal(commanderMoves.length, 0);
})();

(function testCommanderCanMoveTwoSteps() {
  const state = createEmptyState();

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 2, 4, "black", "pawn");

  const moves = getLegalMoves(state, 4, 4);

  assert.ok(moves.some((move) => move.row === 2 && move.col === 4 && move.capture));
})();

(function testCommanderCannotContinueAfterFirstStepCapture() {
  const state = createEmptyState();

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 3, 3, "white", "pawn");
  placePiece(state, 3, 5, "white", "pawn");
  placePiece(state, 4, 3, "white", "pawn");
  placePiece(state, 4, 5, "white", "pawn");
  placePiece(state, 5, 3, "white", "pawn");
  placePiece(state, 5, 4, "white", "pawn");
  placePiece(state, 5, 5, "white", "pawn");
  placePiece(state, 3, 4, "black", "pawn");
  placePiece(state, 2, 4, "black", "bishop");

  const moves = getLegalMoves(state, 4, 4);

  assert.ok(moves.some((move) => move.row === 3 && move.col === 4 && move.capture));
  assert.ok(!moves.some((move) => move.row === 2 && move.col === 4));
})();

(function testBlockedFriendlySquareAndEnemyCapture() {
  const state = createEmptyState();

  placePiece(state, 4, 3, "white", "queen");
  placePiece(state, 5, 2, "white", "pawn");
  placePiece(state, 3, 4, "black", "bishop");

  const moves = getLegalMoves(state, 4, 3);

  assert.equal(moves.length, 7);
  assert.ok(moves.some((move) => move.row === 3 && move.col === 4 && move.capture));
  assert.ok(!moves.some((move) => move.row === 5 && move.col === 2));
})();

(function testLastCaptureWins() {
  const state = createEmptyState();

  placePiece(state, 7, 0, "white", "rook");
  placePiece(state, 6, 1, "black", "king");

  const nextState = applyMove(state, { row: 7, col: 0 }, { row: 6, col: 1 });
  const counts = getRemainingPieceCounts(nextState);

  assert.equal(nextState.winner, "white");
  assert.equal(counts.black, 0);
  assert.equal(nextState.capturedPieces.white.length, 1);
})();

(function testAISelectsAvailableCapture() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "black", "rook");
  placePiece(state, 3, 3, "white", "pawn");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move.from.row, 4);
  assert.equal(move.from.col, 4);
  assert.equal(move.to.row, 3);
  assert.equal(move.to.col, 3);
  assert.equal(move.capture, true);
})();

(function testAIIsDeterministicForSameState() {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "black", "rook");
  placePiece(state, 1, 1, "white", "pawn");

  const first = chooseAIMove(state, "black");
  const second = chooseAIMove(state, "black");

  assert.deepEqual(first, second);
})();

console.log("Kingstep rules validation passed.");