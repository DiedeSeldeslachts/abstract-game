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
  assert.equal(getPiece(state, 7, 4)?.type, "king");
  assert.equal(getPiece(state, 0, 3)?.type, "queen");
})();

(function testUniversalKingMovement() {
  const state = createInitialState();
  const pawnMoves = getLegalMoves(state, 6, 4).map((square) => toAlgebraic(square)).sort();
  const kingMoves = getLegalMoves(state, 7, 4);

  assert.deepEqual(pawnMoves, ["d3", "e3", "f3"]);
  assert.equal(kingMoves.length, 0);
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

console.log("Kingstep rules validation passed.");