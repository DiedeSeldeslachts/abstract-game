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
  isEdgeTile,
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
  const whiteOccupiedColor = getTileColor(state, 4, 2)!;

  assert.ok(placements.length > 0);
  assert.ok(!placements.some((placement) => placement.to.row === 4 && placement.to.col === 2));
  assert.ok(!placements.some((placement) => placement.to.row === 4 && placement.to.col === 6));
  assert.ok(
    placements.every((placement) => getTileColor(state, placement.to.row, placement.to.col) === whiteOccupiedColor)
  );
})();

(function testApplyPlacementEndsTurnWithoutCommander(): void {
  const state = createInitialState();
  state.tileColors["0,2"] = getTileColor(state, 4, 2)!;
  const nextState = applyPlacement(state, { row: 0, col: 2 }, "horse");

  assert.equal(getPiece(nextState, 0, 2)?.type, "horse");
  assert.equal(getPiece(nextState, 0, 2)?.player, "white");
  assert.equal(nextState.currentPlayer, "black");
  assert.equal(nextState.turnPhase, "action");
  assert.equal(nextState.lastAction?.kind, "place");
})();

(function testCanSkipCommanderGrantedExtraMove(): void {
  const state = createEmptyState("white");

  placePiece(state, 0, 0, "white", "commander", "leader");
  placePiece(state, 4, 3, "white", "horse", "walker");
  placePiece(state, 8, 8, "black", "pawn", "keeper");
  const beforePass = applyMove(state, { row: 4, col: 3 }, { row: 4, col: 2 });

  assert.equal(beforePass.turnPhase, "push");
  assert.equal(beforePass.extraMovesRemaining, 1);
  assert.ok(getLegalMoves(beforePass, 4, 2).length > 0);

  const afterPass = applyPassPush(beforePass);

  assert.equal(afterPass.turnPhase, "action");
  assert.equal(afterPass.currentPlayer, "black");
  assert.equal(afterPass.lastAction?.kind, "pass");
})();

(function testPlacedPieceCanBeCapturedImmediatelyOnNextTurn(): void {
  const state = createEmptyState("black");

  placePiece(state, 5, 5, "white", "pawn", "attacker");
  placePiece(state, 8, 8, "black", "pawn", "anchor");

  // Ensure black can legally place, and white can immediately capture that placed pawn.
  const blackColor = getTileColor(state, 8, 8)!;
  state.tileColors["5,5"] = blackColor;
  state.tileColors["4,5"] = blackColor;

  // Black places pawn in action phase
  const afterPlacement = applyPlacement(state, { row: 4, col: 5 }, "pawn");

  // Now it's white's action phase: white pawn at (5,5) can capture black pawn at (4,5)
  const whiteMoves = getLegalMoves(afterPlacement, 5, 5);

  assert.ok(whiteMoves.some((move) => move.row === 4 && move.col === 5 && move.capture));

  const afterCapture = applyMove(afterPlacement, { row: 5, col: 5 }, { row: 4, col: 5 });

  assert.equal(afterCapture.lastAction?.kind, "capture");
  assert.equal(afterCapture.lastAction?.capturedPiece?.player, "black");
  assert.equal(afterCapture.capturedPieces.white.length, 1);
})();

(function testCannotPlaceOnTownSquare(): void {
  const state = createInitialState();

  assert.throws(() => applyPlacement(state, { row: 4, col: 2 }, "pawn"), /town square/i);
})();

(function testCannotPlaceOnUnoccupiedTileColor(): void {
  const state = createInitialState();
  const whiteColor = getTileColor(state, 4, 2)!;
  let target: Coordinate | null = null;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (!isInsideBoard(row, col)) {
        continue;
      }

      if ((row === 4 && col === 2) || (row === 4 && col === 6) || (row === 4 && col === 4)) {
        continue;
      }

      const color = getTileColor(state, row, col);
      if (color && color !== "white" && color !== whiteColor) {
        target = { row, col };
        break;
      }
    }

    if (target) {
      break;
    }
  }

  assert.ok(target, "expected to find a tile with a different color than white's occupied color");
  assert.throws(() => applyPlacement(state, target!, "pawn"), /tile color you already occupy/i);
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
  const whiteColor = getTileColor(state, 4, 2)!;
  const blackColor = getTileColor(state, 4, 6)!;

  for (const square of whiteSquares) {
    state.tileColors[`${square.row},${square.col}`] = whiteColor;
  }

  for (const square of blackSquares) {
    state.tileColors[`${square.row},${square.col}`] = blackColor;
  }

  for (let index = 0; index < 5; index += 1) {
    state = applyPlacement(state, whiteSquares[index], "pawn");
    state = applyPlacement(state, blackSquares[index], "pawn");
  }

  state.tileColors["2,4"] = whiteColor;

  const whiteReserve = getRemainingReserveCounts(state, "white");
  assert.equal(whiteReserve.pawn, 0);

  assert.throws(
    () => applyPlacement(state, { row: 2, col: 4 }, "pawn"),
    /remaining pawn placements/i
  );
})();

(function testCommanderPlacementLimitIsEnforced(): void {
  const state = createInitialState();
  const whiteColor = getTileColor(state, 4, 2)!;
  const blackColor = getTileColor(state, 4, 6)!;

  state.tileColors["0,0"] = whiteColor;
  state.tileColors["0,1"] = whiteColor;
  state.tileColors["0,2"] = whiteColor;
  state.tileColors["8,8"] = blackColor;
  state.tileColors["8,7"] = blackColor;

  const afterFirstCommander = applyPlacement(state, { row: 0, col: 0 }, "commander");
  const afterWhitePass1 = applyPassPush(afterFirstCommander);
  const afterBlackMove1 = applyPlacement(afterWhitePass1, { row: 8, col: 8 }, "pawn");
  const afterSecondCommander = applyPlacement(afterBlackMove1, { row: 0, col: 1 }, "commander");

  const reserve = getRemainingReserveCounts(afterSecondCommander, "white");

  assert.equal(reserve.commander, 0);

  const afterWhitePass2 = applyPassPush(afterSecondCommander);
  const whiteTurnAgain = applyPlacement(afterWhitePass2, { row: 8, col: 7 }, "pawn");

  assert.throws(
    () => applyPlacement(whiteTurnAgain, { row: 0, col: 2 }, "commander"),
    /remaining commander placements/i
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

(function testPawnCanCaptureWhenMatchingColorTileIsBeyondEnemy(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 3, "white", "pawn", "slider");
  placePiece(state, 3, 3, "black", "pawn", "target");

  const startColor = getTileColor(state, 4, 3)!;
  const nonMatchingColor = startColor === "blue" ? "green" : "blue";

  // Enemy tile does not match start color.
  state.tileColors["3,3"] = nonMatchingColor;
  // But a later tile on the same ray does match, so capture should be legal.
  state.tileColors["2,3"] = startColor;

  const moves = getLegalMoves(state, 4, 3);

  assert.ok(moves.some((move) => move.row === 3 && move.col === 3 && move.capture));
})();

(function testHorseMovesOneOrTwoSquaresStraight(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "horse");

  const moves = getLegalMoves(state, 4, 4)
    .map((square) => toAlgebraic(square))
    .sort();

  assert.deepEqual(moves, ["c5", "c7", "d5", "d6", "e3", "e4", "e6", "e7", "f4", "f5", "g3", "g5"]);
})();

(function testCommanderGrantsExtraMoveActionCount(): void {
  const state = createEmptyState("white");

  placePiece(state, 4, 4, "white", "commander");
  placePiece(state, 4, 3, "white", "horse", "mover");
  placePiece(state, 8, 8, "black", "pawn", "alive");

  const afterAction = applyMove(state, { row: 4, col: 3 }, { row: 4, col: 2 });

  assert.equal(afterAction.turnPhase, "push");
  assert.equal(afterAction.currentPlayer, "white");
  assert.equal(afterAction.extraMovesRemaining, 1);
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
  const afterWhiteTurn = whiteAction;
  // Black performs any legal action that does not break white's town control.
  const blackAction = applyMove(afterWhiteTurn, { row: 8, col: 7 }, { row: 7, col: 7 });
  const afterBlackTurn = blackAction;

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
  placePiece(state, 8, 8, "black", "sentinel", "anchor");

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move!.action, "place");
  assert.ok(!(move!.to.row === 4 && move!.to.col === 2));
  assert.ok(!(move!.to.row === 4 && move!.to.col === 6));
})();

(function testAIPrefersSentinelPlacementWhenTownsAreContested(): void {
  const state = createEmptyState("black");

  placePiece(state, 4, 5, "white", "pawn", "town-threat-a");
  placePiece(state, 5, 6, "white", "horse", "town-threat-b");
  placePiece(state, 8, 8, "black", "sentinel", "anchor");

  // Mark the black king as already placed so the AI won't pick it
  state.placedPieces.black.king = 1;

  const move = chooseAIMove(state, "black");

  assert.ok(move);
  assert.equal(move!.action, "place");
  assert.equal(move!.placeType, "sentinel");
})();

console.log("Kingstep rules validation passed.");

(function testPushPhaseHasPushMovesAndNoCaptures(): void {
  const state = createEmptyState("white");

  placePiece(state, 0, 0, "white", "commander", "leader");
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

  placePiece(state, 0, 0, "white", "commander", "leader");
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

(function testKingMovesOneStepInAnyDirection(): void {
  const state = createEmptyState("white");

  // Place king at c7 (row 2, col 2) — all 6 adjacent hexes are valid and non-center
  placePiece(state, 2, 2, "white", "king");

  const moves = getLegalMoves(state, 2, 2);

  // Expect exactly 6 adjacent moves (all open, none blocked by center or edge)
  assert.equal(moves.length, 6, "king must have exactly 6 adjacent moves");
})();

(function testKingCanMoveToCenter(): void {
  const state = createEmptyState("white");

  // Place king adjacent to center at (3,4) = f6
  placePiece(state, 3, 4, "white", "king");

  const moves = getLegalMoves(state, 3, 4);

  // King must be able to move onto the center tile (4,4)
  assert.ok(moves.some((m) => m.row === 4 && m.col === 4), "king can move to center tile");
})();

(function testKingOnCenterWinsImmediately(): void {
  const state = createEmptyState("white");

  // Place king adjacent to center at (3,4)
  placePiece(state, 3, 4, "white", "king");
  // Keep black alive
  placePiece(state, 8, 8, "black", "pawn", "alive");

  const afterMove = applyMove(state, { row: 3, col: 4 }, { row: 4, col: 4 });

  assert.equal(afterMove.winner, "white", "white wins when king reaches center");
})();

(function testKingCapturedWinsForOpponent(): void {
  const state = createEmptyState("black");

  // Black pawn adjacent to white king
  placePiece(state, 4, 3, "black", "pawn");
  placePiece(state, 4, 2, "white", "king");

  // Ensure tile color allows the capture
  const attackerColor = getTileColor(state, 4, 3)!;
  state.tileColors["4,2"] = attackerColor;

  // Increment pieceCounters so king capture condition fires
  state.pieceCounters.white.king = 1;

  const afterCapture = applyMove(state, { row: 4, col: 3 }, { row: 4, col: 2 });

  assert.equal(afterCapture.winner, "black", "black wins when white king is captured");
})();

(function testKingPlacementLimitIsOne(): void {
  const state = createInitialState();
  const whiteColor = getTileColor(state, 4, 2)!;
  const blackColor = getTileColor(state, 4, 6)!;

  state.tileColors["0,2"] = whiteColor;
  state.tileColors["0,3"] = whiteColor;
  state.tileColors["8,4"] = blackColor;

  // Place white king on an edge tile
  const afterFirstKing = applyPlacement(state, { row: 0, col: 2 }, "king");
  const afterBlackTurn = applyPlacement(afterFirstKing, { row: 8, col: 4 }, "pawn");

  // White must no longer have king reserves
  const reserve = getRemainingReserveCounts(afterBlackTurn, "white");
  assert.equal(reserve.king, 0, "king reserve must be 0 after placing it");

  // Attempt to place a second king on another edge tile — should throw
  assert.throws(
    () => applyPlacement(afterBlackTurn, { row: 0, col: 3 }, "king"),
    /remaining king placements/i
  );
})();

(function testKingCannotBePlacedOnNonEdgeTile(): void {
  const state = createInitialState();

  // (4, 3) = d5 is not an edge tile
  assert.ok(!isEdgeTile(4, 3), "(4,3) should not be an edge tile");
  assert.throws(
    () => applyPlacement(state, { row: 4, col: 3 }, "king"),
    /edge tile/i
  );
})();

(function testKingLegalPlacementsAreAllEdgeTiles(): void {
  const state = createInitialState();
  const whiteColor = getTileColor(state, 4, 2)!;
  state.tileColors["0,2"] = whiteColor;
  const placements = getLegalPlacements(state, "white").filter((p) => p.placeType === "king");

  assert.ok(placements.length > 0, "king must have legal placements");
  for (const placement of placements) {
    assert.ok(isEdgeTile(placement.to.row, placement.to.col), `king placement at (${placement.to.row},${placement.to.col}) must be an edge tile`);
  }
})();

(function testKingCannotBePlacedOnTown(): void {
  const state = createInitialState();
  assert.throws(() => applyPlacement(state, { row: 4, col: 2 }, "king"), /town square/i);
})();
