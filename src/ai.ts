/**
 * AI opponent - heuristic move evaluation and selection.
 * No DOM or side effects. Pure scoring logic.
 */

import type {
  GameState,
  Player,
  Coordinate,
  GameAction,
  PlacementAction,
  MoveAction,
  AIMove,
  PieceType
} from "./types.js";
import {
  applyPlacement,
  applyMove,
  getAllLegalMoves,
  getPiece,
  playerControlsBothTowns,
  toAxial,
  TOWN_POSITIONS
} from "./game.js";

const CAPTURE_VALUES: Record<PieceType, number> = {
  commander: 12,
  horse: 6,
  pawn: 4,
  sentinel: 8,
  teacher: 10
};

const TRANSFORM_ACTION_TAX = 6;
const CAPTURE_BASE_SCORE = 90;
const FORWARD_PROGRESS_WEIGHT = 18;
const TOWN_CONTROL_THREAT_SCORE = 1800;
const TOWN_OCCUPATION_SCORE = 260;
const OPPONENT_TOWN_OCCUPATION_PENALTY = 280;
const TOWN_MOVE_BONUS = 90;
const TOWN_CAPTURE_BONUS = 220;
const PLACEMENT_NEAR_ENEMY_WEIGHT = 10;
const PLACEMENT_TOWN_PROXIMITY_WEIGHT = 22;
const PLACEMENT_BASE_SCORES: Record<PieceType, number> = {
  pawn: 62,
  horse: 84,
  sentinel: 92,
  teacher: 102,
  commander: 40
};

function getOpponent(player: Player): Player {
  return player === "white" ? "black" : "white";
}

function getHexDistance(a: Coordinate, b: Coordinate): number {
  const aAxial = toAxial(a);
  const bAxial = toAxial(b);
  const dq = aAxial.q - bAxial.q;
  const dr = aAxial.r - bAxial.r;

  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function getNearestEnemyDistance(state: GameState, square: Coordinate, player: Player): number {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];

      if (!piece || piece.player === player) {
        continue;
      }

      const distance = getHexDistance(square, { row, col });

      if (distance < minDistance) {
        minDistance = distance;
      }
    }
  }

  return minDistance;
}

function countOpponentCapturesOnSquare(
  state: GameState,
  opponent: Player,
  targetSquare: Coordinate
): number {
  const opponentMoves = getAllLegalMoves(state, opponent);

  return opponentMoves.filter(
    (move) =>
      "to" in move &&
      move.capture &&
      move.to.row === targetSquare.row &&
      move.to.col === targetSquare.col
  ).length;
}

function isTownSquare(square: Coordinate): boolean {
  return TOWN_POSITIONS.some(
    (position) => position.row === square.row && position.col === square.col
  );
}

function getForwardProgress(move: GameAction, player: Player): number {
  if (move.action === "place") {
    return 0;
  }

  const moveAction = move as MoveAction;
  if (moveAction.transform) {
    return 0;
  }

  const rowDelta = moveAction.to.row - moveAction.from.row;
  return player === "white" ? rowDelta : -rowDelta;
}

function getNearestTownDistance(square: Coordinate): number {
  let minDistance = Number.POSITIVE_INFINITY;

  for (const town of TOWN_POSITIONS) {
    const distance = getHexDistance(square, town);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function scoreMove(state: GameState, move: GameAction, player: Player): number {
  if (move.action === "place") {
    const placement = move as PlacementAction;
    const opponent = getOpponent(player);
    const nextState = applyPlacement(state, placement.to, placement.placeType);
    const nearEnemyDistance = getNearestEnemyDistance(nextState, placement.to, player);
    const townDistance = getNearestTownDistance(placement.to);
    const placementRiskPenalty = countOpponentCapturesOnSquare(nextState, opponent, placement.to) * 12;
    const winScore = nextState.winner === player ? 10_000 : 0;
    const basePlacement = PLACEMENT_BASE_SCORES[placement.placeType] ?? 40;
    const enemyPressureScore = Number.isFinite(nearEnemyDistance)
      ? (8 - nearEnemyDistance) * PLACEMENT_NEAR_ENEMY_WEIGHT
      : 0;
    const townProximityScore = (8 - townDistance) * PLACEMENT_TOWN_PROXIMITY_WEIGHT;

    return winScore + basePlacement + enemyPressureScore + townProximityScore - placementRiskPenalty;
  }

  const moveAction = move as MoveAction;
  const opponent = getOpponent(player);
  const targetPiece = getPiece(state, moveAction.to.row, moveAction.to.col);
  const captured = targetPiece && targetPiece.player !== player ? targetPiece : null;
  const captureScore = captured ? CAPTURE_BASE_SCORE + CAPTURE_VALUES[captured.type] * 14 : 0;
  const transformedFromType =
    moveAction.transform && targetPiece && targetPiece.player === player
      ? targetPiece.type
      : null;
  const transformedToType = moveAction.transform ? moveAction.transformTo : null;
  const transformValueGain =
    transformedFromType && transformedToType
      ? Math.max(0, CAPTURE_VALUES[transformedToType] - CAPTURE_VALUES[transformedFromType])
      : 0;
  const transformScore = moveAction.transform ? transformValueGain * 2 - TRANSFORM_ACTION_TAX : 0;
  const postActionSquare = moveAction.transform ? moveAction.from : moveAction.to;

  const distanceBefore = getNearestEnemyDistance(state, moveAction.from, player);
  const nextState = applyMove(state, moveAction.from, moveAction.to, {
    transformTo: moveAction.transformTo
  });
  const distanceAfter = getNearestEnemyDistance(nextState, postActionSquare, player);
  const approachScore =
    Number.isFinite(distanceBefore) && Number.isFinite(distanceAfter)
      ? (distanceBefore - distanceAfter) * 2
      : 0;
  const forwardScore = getForwardProgress(moveAction, player) * FORWARD_PROGRESS_WEIGHT;
  const townMoveScore = isTownSquare(moveAction.to) ? TOWN_MOVE_BONUS : 0;
  const townCaptureScore = captured && isTownSquare(moveAction.to) ? TOWN_CAPTURE_BONUS : 0;
  const exposurePenalty = countOpponentCapturesOnSquare(nextState, opponent, postActionSquare) * 10;
  const winScore = nextState.winner === player ? 10_000 : 0;

  // Town control scoring
  const playerOwnsTowns = playerControlsBothTowns(nextState, player);
  const opponentOwnsTowns = playerControlsBothTowns(nextState, opponent);

  let townScore = 0;
  if (playerOwnsTowns) {
    townScore = TOWN_CONTROL_THREAT_SCORE;
  } else {
    // Score individual town occupation
    let townsOccupied = 0;
    for (const townPos of TOWN_POSITIONS) {
      const piece = nextState.board[townPos.row][townPos.col];
      if (piece && piece.player === player) {
        townsOccupied += 1;
      }
    }
    townScore = townsOccupied * TOWN_OCCUPATION_SCORE;
  }

  // Penalty if opponent gets closer to owning both towns
  let opponentTownPenalty = 0;
  if (!playerOwnsTowns && !opponentOwnsTowns) {
    let opponentTownsOccupied = 0;
    for (const townPos of TOWN_POSITIONS) {
      const piece = nextState.board[townPos.row][townPos.col];
      if (piece && piece.player === opponent) {
        opponentTownsOccupied += 1;
      }
    }
    opponentTownPenalty = opponentTownsOccupied * OPPONENT_TOWN_OCCUPATION_PENALTY;
  }

  return (
    winScore +
    captureScore +
    transformScore +
    approachScore +
    forwardScore -
    exposurePenalty +
    townScore -
    opponentTownPenalty +
    townMoveScore +
    townCaptureScore
  );
}

function compareMoveOrder(a: GameAction, b: GameAction): number {
  if (a.action !== b.action) {
    return a.action === "move" ? -1 : 1;
  }

  if (a.action === "place" && b.action === "place") {
    const aPlacement = a as PlacementAction;
    const bPlacement = b as PlacementAction;
    if (aPlacement.placeType !== bPlacement.placeType) {
      return String(aPlacement.placeType).localeCompare(String(bPlacement.placeType));
    }

    if (aPlacement.to.row !== bPlacement.to.row) {
      return aPlacement.to.row - bPlacement.to.row;
    }

    return aPlacement.to.col - bPlacement.to.col;
  }

  const aMove = a as MoveAction;
  const bMove = b as MoveAction;

  if (aMove.from.row !== bMove.from.row) {
    return aMove.from.row - bMove.from.row;
  }

  if (aMove.from.col !== bMove.from.col) {
    return aMove.from.col - bMove.from.col;
  }

  if (aMove.to.row !== bMove.to.row) {
    return aMove.to.row - bMove.to.row;
  }

  return aMove.to.col - bMove.to.col;
}

export function chooseAIMove(state: GameState, player: Player = state.currentPlayer): AIMove | null {
  if (state.winner || player !== state.currentPlayer) {
    return null;
  }

  const moves = getAllLegalMoves(state, player);

  if (moves.length === 0) {
    return null;
  }

  let bestMove = moves[0];
  let bestScore = scoreMove(state, bestMove, player);

  for (let index = 1; index < moves.length; index += 1) {
    const candidate = moves[index];
    const candidateScore = scoreMove(state, candidate, player);

    if (candidateScore > bestScore) {
      bestMove = candidate;
      bestScore = candidateScore;
      continue;
    }

    if (candidateScore === bestScore && compareMoveOrder(candidate, bestMove) < 0) {
      bestMove = candidate;
    }
  }

  if (bestMove.action === "place") {
    const placement = bestMove as PlacementAction;
    return {
      action: "place",
      from: null,
      to: { ...placement.to },
      capture: false,
      piece: null,
      transform: false,
      transformTo: null,
      placeType: placement.placeType
    };
  }

  const moveAction = bestMove as MoveAction;
  return {
    action: "move",
    from: { ...moveAction.from },
    to: { ...moveAction.to },
    capture: moveAction.capture,
    piece: moveAction.piece,
    transform: Boolean(moveAction.transform),
    transformTo: moveAction.transformTo ?? null,
    placeType: null
  };
}
