import {
  applyPlacement,
  applyMove,
  getAllLegalMoves,
  getPiece,
  playerControlsBothTowns,
  TOWN_POSITIONS
} from "./game.js";

const CAPTURE_VALUES = {
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
const PLACEMENT_BASE_SCORES = {
  pawn: 62,
  horse: 84,
  sentinel: 92,
  teacher: 102
};

function getOpponent(player) {
  return player === "white" ? "black" : "white";
}

function getChebyshevDistance(a, b) {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function getNearestEnemyDistance(state, square, player) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];

      if (!piece || piece.player === player) {
        continue;
      }

      const distance = getChebyshevDistance(square, { row, col });

      if (distance < minDistance) {
        minDistance = distance;
      }
    }
  }

  return minDistance;
}

function countOpponentCapturesOnSquare(state, opponent, targetSquare) {
  const opponentMoves = getAllLegalMoves(state, opponent);

  return opponentMoves.filter(
    (move) =>
      move.capture && move.to.row === targetSquare.row && move.to.col === targetSquare.col
  ).length;
}

function isTownSquare(square) {
  return TOWN_POSITIONS.some((position) => position.row === square.row && position.col === square.col);
}

function getForwardProgress(move, player) {
  if (move.transform || move.action === "place") {
    return 0;
  }

  const rowDelta = move.to.row - move.from.row;
  return player === "white" ? rowDelta : -rowDelta;
}

function getNearestTownDistance(square) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (const town of TOWN_POSITIONS) {
    const distance = getChebyshevDistance(square, town);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function scoreMove(state, move, player) {
  if (move.action === "place") {
    const opponent = getOpponent(player);
    const nextState = applyPlacement(state, move.to, move.placeType);
    const nearEnemyDistance = getNearestEnemyDistance(nextState, move.to, player);
    const townDistance = getNearestTownDistance(move.to);
    const placementRiskPenalty = countOpponentCapturesOnSquare(nextState, opponent, move.to) * 12;
    const winScore = nextState.winner === player ? 10_000 : 0;
    const basePlacement = PLACEMENT_BASE_SCORES[move.placeType] ?? 40;
    const enemyPressureScore = Number.isFinite(nearEnemyDistance)
      ? (8 - nearEnemyDistance) * PLACEMENT_NEAR_ENEMY_WEIGHT
      : 0;
    const townProximityScore = (8 - townDistance) * PLACEMENT_TOWN_PROXIMITY_WEIGHT;

    return winScore + basePlacement + enemyPressureScore + townProximityScore - placementRiskPenalty;
  }

  const opponent = getOpponent(player);
  const targetPiece = getPiece(state, move.to.row, move.to.col);
  const captured = targetPiece && targetPiece.player !== player ? targetPiece : null;
  const captureScore = captured ? CAPTURE_BASE_SCORE + CAPTURE_VALUES[captured.type] * 14 : 0;
  const transformedFromType =
    move.transform && targetPiece && targetPiece.player === player ? targetPiece.type : null;
  const transformedToType = move.transform ? move.transformTo : null;
  const transformValueGain =
    transformedFromType && transformedToType
      ? Math.max(0, CAPTURE_VALUES[transformedToType] - CAPTURE_VALUES[transformedFromType])
      : 0;
  const transformScore = move.transform ? transformValueGain * 2 - TRANSFORM_ACTION_TAX : 0;
  const postActionSquare = move.transform ? move.from : move.to;

  const distanceBefore = getNearestEnemyDistance(state, move.from, player);
  const nextState = applyMove(state, move.from, move.to, { transformTo: move.transformTo });
  const distanceAfter = getNearestEnemyDistance(nextState, postActionSquare, player);
  const approachScore =
    Number.isFinite(distanceBefore) && Number.isFinite(distanceAfter)
      ? (distanceBefore - distanceAfter) * 2
      : 0;
  const forwardScore = getForwardProgress(move, player) * FORWARD_PROGRESS_WEIGHT;
  const townMoveScore = isTownSquare(move.to) ? TOWN_MOVE_BONUS : 0;
  const townCaptureScore = captured && isTownSquare(move.to) ? TOWN_CAPTURE_BONUS : 0;
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

function compareMoveOrder(a, b) {
  if (a.action !== b.action) {
    return a.action === "move" ? -1 : 1;
  }

  if (a.action === "place" && b.action === "place") {
    if (a.placeType !== b.placeType) {
      return String(a.placeType).localeCompare(String(b.placeType));
    }

    if (a.to.row !== b.to.row) {
      return a.to.row - b.to.row;
    }

    return a.to.col - b.to.col;
  }

  if (a.from.row !== b.from.row) {
    return a.from.row - b.from.row;
  }

  if (a.from.col !== b.from.col) {
    return a.from.col - b.from.col;
  }

  if (a.to.row !== b.to.row) {
    return a.to.row - b.to.row;
  }

  return a.to.col - b.to.col;
}

export function chooseAIMove(state, player = state.currentPlayer) {
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

  return {
    action: bestMove.action,
    from: bestMove.from ? { ...bestMove.from } : null,
    to: { ...bestMove.to },
    capture: bestMove.capture,
    piece: bestMove.piece,
    transform: Boolean(bestMove.transform),
    transformTo: bestMove.transformTo ?? null,
    placeType: bestMove.placeType ?? null
  };
}