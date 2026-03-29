import { applyMove, getAllLegalMoves, getPiece } from "./game.js";

const CAPTURE_VALUES = {
  commander: 11,
  rook: 8,
  bishop: 6,
  knight: 6,
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
  const captured = getPiece(state, move.to.row, move.to.col);
  const captureScore = captured ? 40 + CAPTURE_VALUES[captured.type] : 0;

  const distanceBefore = getNearestEnemyDistance(state, move.from, player);
  const nextState = applyMove(state, move.from, move.to);
  const distanceAfter = getNearestEnemyDistance(nextState, move.to, player);
  const approachScore =
    Number.isFinite(distanceBefore) && Number.isFinite(distanceAfter)
      ? (distanceBefore - distanceAfter) * 2
      : 0;
  const exposurePenalty = countOpponentCapturesOnSquare(nextState, opponent, move.to) * 10;
  const winScore = nextState.winner === player ? 10_000 : 0;

  return winScore + captureScore + approachScore - exposurePenalty;
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
    piece: bestMove.piece
  };
}