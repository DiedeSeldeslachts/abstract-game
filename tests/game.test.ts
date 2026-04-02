/**
 * Node-based test suite for core game.ts logic.
 * Run with: npm test
 */

import assert from "node:assert/strict";

import type { GameState, Piece, Coordinate, PieceType, Player } from "../src/types.js";
import {
  applyMove,
  applyPassPush,
  applyPlacement,
  createEmptyState,
  createInitialState,
  isInsideBoard,
  getLegalMoves,
  getLegalPlacements,
  getPiece,
  getRemainingPieceCounts,
  getRemainingReserveCounts,
  getTileColor,
  playerControlsBothTowns,
  toAlgebraic
} from "../src/game.js";
import { chooseAIMove } from "../src/ai.js";

const ADJACENT_STEPS: readonly Coordinate[] = [
  { row: 0, col: 1 },
  { row: 0, col: -1 },
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: -1, col: -1 },
  { row: 1, col: 1 }
];

function placePiece(
  state: GameState,
  row: number,
  col: number,
  player: Player,
  type: PieceType,
  suffix: string = "manual"
): void {
  state.board[row][col] = {
    id: `${player}-${type}-${suffix}`,
    player,
    type
  };
}

(function testInitialSetupHasOnlyTownPawns(): void {
  const state = createInitialState();
  const counts = getRemainingPieceCounts(state);

  assert.equal(counts.white, 1);
  assert.equal(counts.black, 1);
  assert.equal(state.currentPlayer, "white");
  assert.equal(getPiece(state, 4, 2)?.type, "pawn");
  assert.equal(getPiece(state, 4, 2)?.player, "white");
  assert.equal(getPiece(state, 4, 6)?.type, "pawn");
  assert.equal(getPiece(state, 4, 6)?.player, "black");
})();

(function testLegalPlacementsExcludeTownsAndOccupiedSquares(): void {
  const state = createInitialState();
  const placements = getLegalPlacements(state, "white");

  assert.ok(placements.length > 0);
  assert.ok(!placements.some((placement) => placement.to.row === 4 && placement.to.col === 2));
  assert.ok(!placements.some((placement) => placement.to.row === 4 && placement.to.col === 6));
})();

(function testApplyPlacementAdvancesToPushPhase(): void {
  const state = createInitialState();
  const nextState = applyPlacement(state, { row: 0, col: 2 }, "horse");

  assert.equal(getPiece(nextState, 0, 2)?.type, "horse");
  assert.equal(getPiece(nextState, 0, 2)?.player, "white");
  assert.equal(nextState.currentPlayer, "white"); // still white's turn (push phase)
  assert.equal(nextState.turnPhase, "push");
  assert.equal(nextState.lastAction?.kind, "place");
})();

(function testPlacedPieceCanBeCapturedImmediatelyOnNextTurn(): void {
  const state = createEmptyState("black");

  placePiece(state, 5, 5, "white", "pawn", "attacker");

  // Ensure tile colors allow capture: target tile matches attacker's tile color
  const attackerColor = getTileColor(state, 5, 5)!;
  state.tileColors["4,5"] = attackerColor;

  // Black places pawn in action phase
  const afterPlacement = applyPlacement(state, { row: 4, col: 5 }, "pawn");
  // Pass black's push phase to complete the turn
  const afterBlackTurn = applyPassPush(afterPlacement);

  // Now it's white's action phase: white pawn at (5,5) can capture black pawn at (4,5)
  const whiteMoves = getLegalMoves(afterBlackTurn, 5, 5);

  assert.ok(whiteMoves.some((move) => move.row === 4 && move.col === 5 && move.capture));

  const afterCapture = applyMove(afterBlackTurn, { row: 5, col: 5 }, { row: 4, col: 5 });

  assert.equal(afterCapture.lastAction?.kind, "capture");
  assert.equal(afterCapture.lastAction?.capturedPiece?.player, "black");
  assert.equal(afterCapture.capturedPieces.white.length, 1);
})();

(function testCannotPlaceOnTownSquare(): void {
  const state = createInitialState();

  assert.throws(() => applyPlacement(state, { row: 4, col: 2 }, "pawn"), /town square/i);
})();

(function testPlacementLimitIsEnforced(): void {
  let state = createInitialState();
  const whiteSquares: Coordinate[] = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 0, col: 4 }
  ];
  const blackSquares: Coordinate[] = [
    { row: 8, col: 4 },
    { row: 8, col: 5 },
    { row: 8, col: 6 },
    { row: 8, col: 7 },
    { row: 8, col: 8 }
  ];

  for (let index = 0; index < 5; index += 1) {
    state = applyPlacement(state, whiteSquares[index], "pawn");
    state = applyPassPush(state); // white push phase → black's turn
    state = applyPlacement(state, blackSquares[index], "pawn");
    state = applyPassPush(state); // black push phase → white's turn
  }

  const whiteReserve = getRemainingReserveCounts(state, "white");
  assert.equal(whiteReserve.pawn, 0);

  assert.throws(
    () => applyPlacement(state, { row: 2, col: 4 }, "pawn"),
    /remaining pawn placements/i
  );
})();

(function testPawnSlidesAndStopsOnSameColorTile(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 3, "white", "pawn", "slider");
  placePiece(state, 3, 3, "black", "pawn", "enemy-capture-check");

  // Ensure tile colors allow the capture: set enemy tile to match attacker's starting tile
  const startColor = getTileColor(state, 4, 3)!;
  state.tileColors["3,3"] = startColor;

  const moves = getLegalMoves(state, 4, 3);

  // The enemy is capturable because a same-color tile exists on the path.
  assert.ok(moves.some((move) => move.row === 3 && move.col === 3 && move.capture));

  // Every non-capture destination must match the pawn's starting color.
  for (const move of moves.filter((move) => !move.capture)) {
    assert.equal(getTileColor(state, move.row, move.col), startColor);
  }

  // Any same-color tile on an unobstructed ray must be present as a legal destination.
  const expectedEmptyStops = new Set<string>();
  for (const step of ADJACENT_STEPS) {
    let distance = 1;
    while (true) {
      const row = 4 + distance * step.row;
      const col = 3 + distance * step.col;

      if (!isInsideBoard(row, col) || (row === 4 && col === 4)) {
        break;
      }

      const piece = getPiece(state, row, col);

      if (piece) {
        break;
      }

      if (getTileColor(state, row, col) === startColor) {
        expectedEmptyStops.add(`${row},${col}`);
      }

      distance += 1;
    }
  }

  const actualEmptyStops = new Set(
    moves.filter((move) => !move.capture).map((move) => `${move.row},${move.col}`)
  );
  assert.deepEqual(actualEmptyStops, expectedEmptyStops);
})();

(function testHorseMovesOneOrTwoSquaresStraight(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "horse");

  const moves = getLegalMoves(state, 4, 4)
    .map((square) => toAlgebraic(square))
    .sort();

  assert.deepEqual(moves, ["c5", "c7", "d5", "d6", "e3", "e4", "e6", "e7", "f4", "f5", "g3", "g5"]);
})();

(function testTeacherTransformChangesTypeWithoutMovingTeacher(): void {
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

(function testTeacherCannotCaptureEnemyPiece(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "teacher");
  placePiece(state, 4, 5, "black", "pawn", "target");

  const moves = getLegalMoves(state, 4, 4);

  assert.ok(!moves.some((move) => move.row === 4 && move.col === 5));
})();

(function testAdjacentPawnCanHopOverFriendlyPiece(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 4, 3, "white", "pawn");
  placePiece(state, 3, 3, "white", "pawn", "blocker");
  placePiece(state, 2, 3, "black", "pawn", "target");

  // Ensure tile colors allow hop capture: set a path tile to match pawn's starting tile color
  const pawnColor = getTileColor(state, 4, 3)!;
  state.tileColors["3,3"] = pawnColor;

  const moves = getLegalMoves(state, 4, 3);

  assert.ok(moves.some((move) => move.row === 2 && move.col === 3 && move.capture));
})();

(function testEnemyCanCaptureSentinel(): void {
  const state = createEmptyState("black");

  placePiece(state, 4, 3, "white", "sentinel");
  placePiece(state, 3, 3, "black", "pawn");

  // Ensure tile colors allow capture
  const attackerColor = getTileColor(state, 3, 3)!;
  state.tileColors["4,3"] = attackerColor;

  const moves = getLegalMoves(state, 3, 3);

  // Black pawn slides down into (4,3) capturing the white sentinel
  assert.ok(moves.some((move) => move.row === 4 && move.col === 3 && move.capture));
})();

(function testEnemyCanCapturePawnAdjacentToSentinel(): void {
  const state = createEmptyState("black");

  placePiece(state, 4, 4, "white", "sentinel");
  placePiece(state, 4, 5, "white", "pawn");
  placePiece(state, 4, 6, "black", "pawn");

  // Ensure tile colors allow capture
  const attackerColor = getTileColor(state, 4, 6)!;
  state.tileColors["4,5"] = attackerColor;

  const moves = getLegalMoves(state, 4, 6);

  // Black pawn CAN capture the white pawn that is adjacent to the sentinel (no longer protected)
  assert.ok(moves.some((move) => move.row === 4 && move.col === 5 && move.capture));
})();

(function testSentinelCannotMove(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "sentinel");

  const moves = getLegalMoves(state, 4, 4);

  // Sentinel has no legal moves
  assert.ok(moves.length === 0);
})();

(function testTownControlSquares(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 4, 6, "white", "pawn", "b");

  assert.equal(playerControlsBothTowns(state, "white"), true);
  assert.equal(playerControlsBothTowns(state, "black"), false);
})();

(function testTownControlWinsAfterFullRound(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "a");
  placePiece(state, 3, 6, "white", "pawn", "b");
  placePiece(state, 4, 6, "black", "pawn", "town-guard");
  placePiece(state, 8, 7, "black", "pawn", "runner");
  placePiece(state, 7, 7, "white", "pawn", "bait");

  // Ensure tile colors allow captures
  const whiteAttackerColor = getTileColor(state, 3, 6)!;
  state.tileColors["4,6"] = whiteAttackerColor;
  const blackAttackerColor = getTileColor(state, 8, 7)!;
  state.tileColors["7,7"] = blackAttackerColor;

  // White captures on g5 to occupy both towns.
  const whiteAction = applyMove(state, { row: 3, col: 6 }, { row: 4, col: 6 });
  // White push phase: pass
  const afterWhiteTurn = applyPassPush(whiteAction);
  // Black performs any legal action that does not break white's town control.
  const blackAction = applyMove(afterWhiteTurn, { row: 8, col: 7 }, { row: 7, col: 7 });
  // Black push phase: pass (starts white's next turn with both towns)
  const afterBlackTurn = applyPassPush(blackAction);

  assert.equal(afterBlackTurn.currentPlayer, "white");
  assert.equal(afterBlackTurn.winner, "white");
})();

(function testAISelectsAvailableCapture(): void {
  const state = createEmptyState("black");

  placePiece(state, 5, 5, "black", "pawn");
  placePiece(state, 4, 5, "white", "pawn");

  // Ensure tile colors allow capture
  const attackerColor = getTileColor(state, 5, 5)!;
  state.tileColors["4,5"] = attackerColor;

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move!.action, "move");
  assert.equal(move!.capture, true);
})();

(function testAICanChoosePlacementAction(): void {
  const state = createInitialState();
  state.currentPlayer = "black";
  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move!.action, "place");
  assert.ok(move!.placeType);
  assert.equal(move!.from, null);
})();

(function testAIPlacementNeverTargetsTownSquares(): void {
  const state = createEmptyState("black");

  placePiece(state, 8, 7, "white", "pawn", "alive");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move!.action, "place");
  assert.ok(!(move!.to.row === 4 && move!.to.col === 2));
  assert.ok(!(move!.to.row === 4 && move!.to.col === 6));
})();

console.log("Kingstep rules validation passed.");

(function testPushPhaseHasPushMovesAndNoCaptures(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "mover");
  placePiece(state, 3, 2, "black", "pawn", "captured");
  placePiece(state, 4, 3, "black", "pawn", "target");

  // Ensure tile colors allow the action-phase capture
  const attackerColor = getTileColor(state, 4, 2)!;
  state.tileColors["3,2"] = attackerColor;

  // White action phase: capture black pawn neighbour
  const afterAction = applyMove(state, { row: 4, col: 2 }, { row: 3, col: 2 });

  assert.equal(afterAction.turnPhase, "push");
  assert.equal(afterAction.currentPlayer, "white");

  // In push phase, white pawn at (3,2) is adjacent to black pawn at (4,3)
  // Push should be there (to (5,4)), and no capture moves
  const pushMoves = getLegalMoves(afterAction, 3, 2);

  assert.ok(!pushMoves.some((m) => m.capture), "push phase must not have capture moves");
})();

(function testPushMoveDisplacesEnemyPiece(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 2, "white", "pawn", "pusher");
  placePiece(state, 3, 2, "black", "pawn", "captured");
  placePiece(state, 4, 3, "black", "pawn", "pushed");
  placePiece(state, 8, 8, "black", "pawn", "anchor");

  // Ensure tile colors allow the action-phase capture
  const attackerColor = getTileColor(state, 4, 2)!;
  state.tileColors["3,2"] = attackerColor;

  // White captures to enter push phase.
  const afterAction = applyMove(state, { row: 4, col: 2 }, { row: 3, col: 2 });

  // White pawn at (3,2) adjacent to black at (4,3) along step (1,1)
  // Push target: (5,4) — must be empty and on-board
  const pushMoves = getLegalMoves(afterAction, 3, 2);
  const pushMove = pushMoves.find((m) => m.push && m.row === 4 && m.col === 3);

  assert.ok(pushMove, "push move to (4,3) must exist");
  assert.deepEqual(pushMove!.pushTo, { row: 5, col: 4 });

  const afterPush = applyMove(afterAction, { row: 3, col: 2 }, { row: 4, col: 3 });

  assert.equal(getPiece(afterPush, 4, 3)?.player, "white", "pusher now on (4,3)");
  assert.equal(getPiece(afterPush, 5, 4)?.player, "black", "pushed piece now on (5,4)");
  assert.equal(getPiece(afterPush, 3, 2), null, "origin is empty");
  assert.equal(afterPush.lastAction?.kind, "push");
  assert.equal(afterPush.currentPlayer, "black"); // full turn completed
  assert.equal(afterPush.turnPhase, "action");
})();
