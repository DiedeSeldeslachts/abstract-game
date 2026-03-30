import {
  applyMove,
  getAllLegalMoves,
  getPiece,
  playerControlsBothTowns,
  TOWN_POSITIONS
} from "./game.js";

const CAPTURE_VALUES = {
  commander: 11,
  pawn: 4,
  sentinel: 7,
  teacher: 9
};

const TRANSFORM_VALUES = {
  commander: 13,
  sentinel: 8,
  pawn: 4
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

function scoreMove(state, move, player) {
  const opponent = getOpponent(player);
  const targetPiece = getPiece(state, move.to.row, move.to.col);
  const captured = targetPiece && targetPiece.player !== player ? targetPiece : null;
  const captureScore = captured ? 40 + CAPTURE_VALUES[captured.type] : 0;
  const transformScore = move.transform ? 24 + TRANSFORM_VALUES[move.transformTo] : 0;
  const postActionSquare = move.transform ? move.from : move.to;

  const distanceBefore = getNearestEnemyDistance(state, move.from, player);
  const nextState = applyMove(state, move.from, move.to, { transformTo: move.transformTo });
  const distanceAfter = getNearestEnemyDistance(nextState, postActionSquare, player);
  const approachScore =
    Number.isFinite(distanceBefore) && Number.isFinite(distanceAfter)
      ? (distanceBefore - distanceAfter) * 2
      : 0;
  const exposurePenalty = countOpponentCapturesOnSquare(nextState, opponent, postActionSquare) * 10;
  const winScore = nextState.winner === player ? 10_000 : 0;

  // Town control scoring
  const playerOwnsTowns = playerControlsBothTowns(nextState, player);
  const opponentOwnsTowns = playerControlsBothTowns(nextState, opponent);
  
  let townScore = 0;
  if (playerOwnsTowns) {
    townScore = 1200; // Strong pressure: creates/maintains a pending town win threat
  } else {
    // Score individual town occupation
    let townsOccupied = 0;
    for (const townPos of TOWN_POSITIONS) {
      const piece = nextState.board[townPos.row][townPos.col];
      if (piece && piece.player === player) {
        townsOccupied += 1;
      }
    }
    townScore = townsOccupied * 150;
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
    opponentTownPenalty = opponentTownsOccupied * 200;
  }

  return winScore + captureScore + transformScore + approachScore - exposurePenalty + townScore - opponentTownPenalty;
}

function compareMoveOrder(a, b) {
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
    from: { ...bestMove.from },
    to: { ...bestMove.to },
    capture: bestMove.capture,
    piece: bestMove.piece,
    transform: Boolean(bestMove.transform),
    transformTo: bestMove.transformTo ?? null
  };
}