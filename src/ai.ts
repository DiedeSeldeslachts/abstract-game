/**
 * AI opponent - minimax with alpha-beta pruning and positional evaluation.
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
  PieceType,
  Piece
} from "./types.js";
import {
  applyPlacement,
  applyMove,
  getAllLegalMoves,
  getPiece,
  getRemainingReserveCounts,
  isCenterTile,
  isInsideBoard,
  playerControlsBothTowns,
  toAxial,
  TOWN_POSITIONS
} from "./game.js";

const CAPTURE_VALUES: Record<PieceType, number> = {
  commander: 12,
  horse: 6,
  pawn: 4,
  sentinel: 8
};

const SEARCH_MAX_DEPTH = 3;
const SEARCH_TIME_BUDGET_MS = 1400;
const QUIESCENCE_DEPTH = 1;
const WIN_SCORE = 1_000_000;

const MATERIAL_WEIGHT = 36;
const MOBILITY_WEIGHT = 4;
const TOWN_CONTROL_SCORE = 2200;
const TOWN_OCCUPATION_SCORE = 360;
const TOWN_DISTANCE_WEIGHT = 20;
const CENTER_CONTROL_WEIGHT = 10;
const PIECE_SAFETY_WEIGHT = 1;
const PUSH_PRESSURE_WEIGHT = 34;
const OPENING_AGGRESSION_WEIGHT = 18;
const ENDGAME_TOWN_WEIGHT = 220;

const ADJACENT_STEPS: readonly Coordinate[] = [
  { row: 0, col: 1 },
  { row: 0, col: -1 },
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: -1, col: -1 },
  { row: 1, col: 1 }
];

interface SearchContext {
  rootPlayer: Player;
  deadlineMs: number;
  nodesVisited: number;
}

interface SearchResult {
  score: number;
  bestMove: GameAction | null;
  completed: boolean;
}

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

function actionKey(action: GameAction): string {
  if (action.action === "place") {
    return `place:${action.placeType}:${action.to.row},${action.to.col}`;
  }

  const move = action as MoveAction;
  return [
    "move",
    `${move.from.row},${move.from.col}`,
    `${move.to.row},${move.to.col}`,
    move.capture ? "capture" : "quiet",
    move.push ? `push:${move.pushTo?.row ?? "x"},${move.pushTo?.col ?? "x"}` : "nopush"
  ].join("|");
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

function isTownSquare(square: Coordinate): boolean {
  return TOWN_POSITIONS.some(
    (position) => position.row === square.row && position.col === square.col
  );
}

function countTownsOccupied(state: GameState, player: Player): number {
  let occupied = 0;
  for (const town of TOWN_POSITIONS) {
    const piece = state.board[town.row][town.col];
    if (piece && piece.player === player) {
      occupied += 1;
    }
  }
  return occupied;
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

function getPieceValue(piece: Piece): number {
  return CAPTURE_VALUES[piece.type] ?? 0;
}

function countMaterial(state: GameState, player: Player): number {
  let score = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      score += getPieceValue(piece);
    }
  }

  return score;
}

function countFriendlyAdjacency(state: GameState, square: Coordinate, player: Player): number {
  let defenders = 0;

  for (const step of ADJACENT_STEPS) {
    const row = square.row + step.row;
    const col = square.col + step.col;

    if (!isInsideBoard(row, col) || isCenterTile(row, col)) {
      continue;
    }

    const piece = state.board[row][col];
    if (piece && piece.player === player) {
      defenders += 1;
    }
  }

  return defenders;
}

function buildAttackMap(state: GameState, player: Player): Map<string, number> {
  const map = new Map<string, number>();
  const moves = getAllLegalMoves(state, player);

  for (const move of moves) {
    if (move.action !== "move") {
      continue;
    }

    if (!move.capture) {
      continue;
    }

    const key = `${move.to.row},${move.to.col}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return map;
}

function getPieceSafetyScore(
  state: GameState,
  player: Player,
  opponentAttackMap: Map<string, number>
): number {
  let safetyScore = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const square = { row, col };
      const attackCount = opponentAttackMap.get(`${row},${col}`) ?? 0;
      const defenderCount = countFriendlyAdjacency(state, square, player);
      const pieceScale = getPieceValue(piece);

      if (attackCount > 0) {
        safetyScore -= attackCount * (8 + pieceScale * 2);
      }

      safetyScore += defenderCount * (2 + Math.floor(pieceScale / 3));
    }
  }

  return safetyScore;
}

function getTownDistanceScore(state: GameState, player: Player): number {
  const opponent = getOpponent(player);
  let score = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const pieceSquare = { row, col };
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const town of TOWN_POSITIONS) {
        const townPiece = state.board[town.row][town.col];
        if (townPiece && townPiece.player === player) {
          continue;
        }

        const distance = getHexDistance(pieceSquare, town);
        if (distance < bestDistance) {
          bestDistance = distance;
        }
      }

      if (!Number.isFinite(bestDistance)) {
        bestDistance = 0;
      }

      score += Math.max(0, 8 - bestDistance) * (piece.type === "commander" ? 1.2 : 1);
    }
  }

  const opponentTownCount = countTownsOccupied(state, opponent);
  score -= opponentTownCount * 10;

  return Math.floor(score);
}

function getCenterControlScore(state: GameState, player: Player): number {
  const center = { row: 4, col: 4 };
  let total = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const distance = getHexDistance({ row, col }, center);
      const pieceScale = Math.max(1, Math.floor(getPieceValue(piece) / 3));
      total += Math.max(0, 6 - distance) * pieceScale;
    }
  }

  return total;
}

function countPushPressure(state: GameState, player: Player): number {
  let pressure = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player || piece.type === "sentinel") {
        continue;
      }

      for (const step of ADJACENT_STEPS) {
        const enemyRow = row + step.row;
        const enemyCol = col + step.col;

        if (!isInsideBoard(enemyRow, enemyCol) || isCenterTile(enemyRow, enemyCol)) {
          continue;
        }

        const enemy = state.board[enemyRow][enemyCol];
        if (!enemy || enemy.player === player) {
          continue;
        }

        const pushRow = enemyRow + step.row;
        const pushCol = enemyCol + step.col;
        if (!isInsideBoard(pushRow, pushCol) || isCenterTile(pushRow, pushCol)) {
          continue;
        }

        if (!state.board[pushRow][pushCol]) {
          pressure += 1;
        }
      }
    }
  }

  return pressure;
}

function getOpeningAggressionScore(state: GameState, player: Player): number {
  const moveBias = Math.max(0, 10 - state.moveNumber);
  if (moveBias === 0) {
    return 0;
  }

  let activity = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const nearestEnemyDistance = getNearestEnemyDistance(state, { row, col }, player);
      if (Number.isFinite(nearestEnemyDistance)) {
        activity += Math.max(0, 7 - nearestEnemyDistance);
      }

      if (isTownSquare({ row, col })) {
        activity += 5;
      }
    }
  }

  const reserve = getRemainingReserveCounts(state, player);
  const reserveFlexibility = reserve.horse * 2 + reserve.sentinel * 2 + reserve.pawn;

  return activity - reserveFlexibility * Math.floor(moveBias / 3);
}

function getEndgameTownDefenseScore(state: GameState, player: Player): number {
  if (state.moveNumber < 16) {
    return 0;
  }

  let score = 0;
  const opponent = getOpponent(player);

  for (const town of TOWN_POSITIONS) {
    const piece = state.board[town.row][town.col];
    if (piece?.player === player) {
      score += 18;
      score += countFriendlyAdjacency(state, town, player) * 3;
    }

    if (piece?.player === opponent) {
      score -= 20;
    }
  }

  return score;
}

function evaluateState(state: GameState, player: Player): number {
  const opponent = getOpponent(player);

  if (state.winner === player) {
    return WIN_SCORE;
  }

  if (state.winner === opponent) {
    return -WIN_SCORE;
  }

  const playerMaterial = countMaterial(state, player);
  const opponentMaterial = countMaterial(state, opponent);

  const playerMoves = getAllLegalMoves(state, player);
  const opponentMoves = getAllLegalMoves(state, opponent);

  const playerAttacks = buildAttackMap(state, player);
  const opponentAttacks = buildAttackMap(state, opponent);

  const materialScore = (playerMaterial - opponentMaterial) * MATERIAL_WEIGHT;
  const mobilityScore = (playerMoves.length - opponentMoves.length) * MOBILITY_WEIGHT;

  const playerTownControl = playerControlsBothTowns(state, player) ? TOWN_CONTROL_SCORE : 0;
  const opponentTownControl = playerControlsBothTowns(state, opponent) ? TOWN_CONTROL_SCORE : 0;
  const townOccupationScore =
    countTownsOccupied(state, player) * TOWN_OCCUPATION_SCORE -
    countTownsOccupied(state, opponent) * TOWN_OCCUPATION_SCORE;
  const townDistanceScore =
    getTownDistanceScore(state, player) * TOWN_DISTANCE_WEIGHT -
    getTownDistanceScore(state, opponent) * TOWN_DISTANCE_WEIGHT;

  const centerControlScore =
    (getCenterControlScore(state, player) - getCenterControlScore(state, opponent)) *
    CENTER_CONTROL_WEIGHT;

  const safetyScore =
    (getPieceSafetyScore(state, player, opponentAttacks) -
      getPieceSafetyScore(state, opponent, playerAttacks)) *
    PIECE_SAFETY_WEIGHT;

  const pushPressureScore =
    (countPushPressure(state, player) - countPushPressure(state, opponent)) *
    PUSH_PRESSURE_WEIGHT;

  const openingScore =
    (getOpeningAggressionScore(state, player) - getOpeningAggressionScore(state, opponent)) *
    OPENING_AGGRESSION_WEIGHT;

  const endgameScore =
    (getEndgameTownDefenseScore(state, player) - getEndgameTownDefenseScore(state, opponent)) *
    ENDGAME_TOWN_WEIGHT;

  return (
    materialScore +
    mobilityScore +
    playerTownControl -
    opponentTownControl +
    townOccupationScore +
    townDistanceScore +
    centerControlScore +
    safetyScore +
    pushPressureScore +
    openingScore +
    endgameScore
  );
}

function applyAction(state: GameState, action: GameAction): GameState {
  if (action.action === "place") {
    const placement = action as PlacementAction;
    return applyPlacement(state, placement.to, placement.placeType);
  }

  const move = action as MoveAction;
  return applyMove(state, move.from, move.to);
}

function evaluateMoveForOrdering(state: GameState, move: GameAction, rootPlayer: Player): number {
  const actingPlayer = state.currentPlayer;
  let score = 0;

  if (move.action === "place") {
    const placement = move as PlacementAction;
    const nearEnemyDistance = getNearestEnemyDistance(state, placement.to, actingPlayer);
    const townDistance = Math.min(
      getHexDistance(placement.to, TOWN_POSITIONS[0]),
      getHexDistance(placement.to, TOWN_POSITIONS[1])
    );

    score += (CAPTURE_VALUES[placement.placeType] ?? 0) * 10;
    if (Number.isFinite(nearEnemyDistance)) {
      score += Math.max(0, 8 - nearEnemyDistance) * 12;
    }
    score += Math.max(0, 8 - townDistance) * 20;
    if (state.moveNumber <= 8 && state.turnPhase === "action") {
      score += 280;
    }
  } else {
    const moveAction = move as MoveAction;

    if (moveAction.capture) {
      const target = getPiece(state, moveAction.to.row, moveAction.to.col);
      if (target) {
        score += 500 + (CAPTURE_VALUES[target.type] ?? 0) * 40;
      } else {
        score += 450;
      }
    }

    if (isTownSquare(moveAction.to)) {
      score += moveAction.capture ? 380 : 220;
    }

    if (moveAction.push) {
      score += 160;
    }
  }

  const nextState = applyAction(state, move);
  if (nextState.winner === actingPlayer) {
    score += WIN_SCORE / 2;
  }

  const perspective = actingPlayer === rootPlayer ? 1 : -1;
  return score * perspective;
}

function orderMoves(state: GameState, moves: GameAction[], rootPlayer: Player): GameAction[] {
  return moves
    .slice()
    .sort((left, right) => {
      const scoreDiff =
        evaluateMoveForOrdering(state, right, rootPlayer) -
        evaluateMoveForOrdering(state, left, rootPlayer);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return compareMoveOrder(left, right);
    });
}

function getForcingMoves(state: GameState, moves: GameAction[]): GameAction[] {
  const forcing: GameAction[] = [];

  for (const move of moves) {
    if (move.action === "place") {
      if (isTownSquare(move.to)) {
        forcing.push(move);
      }
      continue;
    }

    const moveAction = move as MoveAction;
    if (moveAction.capture || moveAction.push || isTownSquare(moveAction.to)) {
      forcing.push(move);
    }
  }

  return forcing;
}

function quiescence(
  state: GameState,
  alpha: number,
  beta: number,
  depth: number,
  context: SearchContext
): SearchResult {
  if (Date.now() >= context.deadlineMs) {
    return {
      score: evaluateState(state, context.rootPlayer),
      bestMove: null,
      completed: false
    };
  }

  const maximizing = state.currentPlayer === context.rootPlayer;
  const standPat = evaluateState(state, context.rootPlayer);

  if (depth <= 0) {
    return { score: standPat, bestMove: null, completed: true };
  }

  if (maximizing) {
    if (standPat >= beta) {
      return { score: beta, bestMove: null, completed: true };
    }

    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) {
      return { score: alpha, bestMove: null, completed: true };
    }

    beta = Math.min(beta, standPat);
  }

  const allMoves = getAllLegalMoves(state, state.currentPlayer);
  const forcingMoves = getForcingMoves(state, allMoves);

  if (forcingMoves.length === 0) {
    return { score: standPat, bestMove: null, completed: true };
  }

  const ordered = orderMoves(state, forcingMoves, context.rootPlayer);
  let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  let bestMove: GameAction | null = null;

  for (const move of ordered) {
    const nextState = applyAction(state, move);
    const child = quiescence(nextState, alpha, beta, depth - 1, context);

    if (!child.completed) {
      return {
        score: bestMove ? bestScore : standPat,
        bestMove,
        completed: false
      };
    }

    if (maximizing) {
      if (child.score > bestScore) {
        bestScore = child.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestScore);
      if (alpha >= beta) {
        break;
      }
    } else {
      if (child.score < bestScore) {
        bestScore = child.score;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
      if (alpha >= beta) {
        break;
      }
    }
  }

  if (!bestMove) {
    return { score: standPat, bestMove: null, completed: true };
  }

  return { score: bestScore, bestMove, completed: true };
}

function alphabeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext
): SearchResult {
  context.nodesVisited += 1;

  if (Date.now() >= context.deadlineMs) {
    return {
      score: evaluateState(state, context.rootPlayer),
      bestMove: null,
      completed: false
    };
  }

  const opponent = getOpponent(context.rootPlayer);
  if (state.winner === context.rootPlayer) {
    return { score: WIN_SCORE + depth, bestMove: null, completed: true };
  }

  if (state.winner === opponent) {
    return { score: -WIN_SCORE - depth, bestMove: null, completed: true };
  }

  if (depth <= 0) {
    return quiescence(state, alpha, beta, QUIESCENCE_DEPTH, context);
  }

  const moves = getAllLegalMoves(state, state.currentPlayer);

  if (moves.length === 0) {
    return {
      score: evaluateState(state, context.rootPlayer),
      bestMove: null,
      completed: true
    };
  }

  const maximizing = state.currentPlayer === context.rootPlayer;
  const orderedMoves = orderMoves(state, moves, context.rootPlayer);

  let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  let bestMove: GameAction | null = null;

  for (const move of orderedMoves) {
    const nextState = applyAction(state, move);
    const result = alphabeta(nextState, depth - 1, alpha, beta, context);

    if (!result.completed) {
      return {
        score: bestMove ? bestScore : evaluateState(state, context.rootPlayer),
        bestMove,
        completed: false
      };
    }

    const candidateScore = result.score;

    if (maximizing) {
      const shouldReplace =
        candidateScore > bestScore ||
        (candidateScore === bestScore && bestMove && compareMoveOrder(move, bestMove) < 0);

      if (shouldReplace || !bestMove) {
        bestScore = candidateScore;
        bestMove = move;
      }

      alpha = Math.max(alpha, bestScore);
      if (alpha >= beta) {
        break;
      }
    } else {
      const shouldReplace =
        candidateScore < bestScore ||
        (candidateScore === bestScore && bestMove && compareMoveOrder(move, bestMove) < 0);

      if (shouldReplace || !bestMove) {
        bestScore = candidateScore;
        bestMove = move;
      }

      beta = Math.min(beta, bestScore);
      if (alpha >= beta) {
        break;
      }
    }
  }

  if (!bestMove) {
    return {
      score: evaluateState(state, context.rootPlayer),
      bestMove: null,
      completed: true
    };
  }

  return { score: bestScore, bestMove, completed: true };
}

function toAIMove(action: GameAction): AIMove {
  if (action.action === "place") {
    const placement = action as PlacementAction;
    return {
      action: "place",
      from: null,
      to: { ...placement.to },
      capture: false,
      piece: null,
      placeType: placement.placeType
    };
  }

  const move = action as MoveAction;
  return {
    action: "move",
    from: { ...move.from },
    to: { ...move.to },
    capture: move.capture,
    piece: move.piece,
    placeType: null
  };
}

export function chooseAIMove(state: GameState, player: Player = state.currentPlayer): AIMove | null {
  if (state.winner || player !== state.currentPlayer) {
    return null;
  }

  const legalMoves = getAllLegalMoves(state, player);
  if (legalMoves.length === 0) {
    return null;
  }

  if (state.turnPhase === "action" && state.moveNumber <= 2) {
    const hasCapture = legalMoves.some((move) => move.action === "move" && move.capture);
    if (!hasCapture) {
      const placements = legalMoves.filter((move) => move.action === "place");
      if (placements.length > 0) {
        const openingPlacement = orderMoves(state, placements, player)[0];
        return toAIMove(openingPlacement);
      }
    }
  }

  const startedMs = Date.now();
  const context: SearchContext = {
    rootPlayer: player,
    deadlineMs: startedMs + SEARCH_TIME_BUDGET_MS,
    nodesVisited: 0
  };

  let bestMove: GameAction | null = null;
  let reachedDepth = 0;

  for (let depth = 1; depth <= SEARCH_MAX_DEPTH; depth += 1) {
    if (Date.now() >= context.deadlineMs) {
      break;
    }

    const result = alphabeta(
      state,
      depth,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      context
    );

    if (!result.completed) {
      break;
    }

    if (result.bestMove) {
      bestMove = result.bestMove;
      reachedDepth = depth;
    }
  }

  if (!bestMove) {
    const fallback = orderMoves(state, legalMoves, player)[0];
    bestMove = fallback;
  }

  const elapsedMs = Date.now() - startedMs;
  // Keep this in console for balancing search depth and weights.
  console.debug(
    `[AI] player=${player} depth=${reachedDepth} nodes=${context.nodesVisited} timeMs=${elapsedMs} move=${actionKey(bestMove)}`
  );

  return toAIMove(bestMove);
}
