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
  getTileColor,
  isCenterTile,
  isInsideBoard,
  playerControlsBothTowns,
  toAlgebraic,
  toAxial,
  TOWN_POSITIONS
} from "./game.js";

const CAPTURE_VALUES: Record<PieceType, number> = {
  commander: 12,
  horse: 6,
  king: 800,
  pawn: 4,
  sentinel: 8
};

const PLACEMENT_ORDER_VALUES: Record<PieceType, number> = {
  commander: 220,
  horse: 160,
  king: 90,
  pawn: 120,
  sentinel: 200
};

const SEARCH_MAX_DEPTH = 3;
const SEARCH_TIME_BUDGET_MS = 2000;
const QUIESCENCE_DEPTH = 2;
const WIN_SCORE = 1_000_000;

const MATERIAL_WEIGHT = 50;
const MOBILITY_WEIGHT = 2;
const TOWN_CONTROL_SCORE = 2200;
const TOWN_OCCUPATION_SCORE = 180;
const TOWN_DISTANCE_WEIGHT = 12;
const CENTER_CONTROL_WEIGHT = 10;
const PIECE_SAFETY_WEIGHT = 3;
const PUSH_PRESSURE_WEIGHT = 42;
const OPENING_AGGRESSION_WEIGHT = 28;
const ENDGAME_TOWN_WEIGHT = 140;
const CAPTURE_THREAT_WEIGHT = 28;
const SENTINEL_POSITION_WEIGHT = 42;
const KING_CENTER_DISTANCE_WEIGHT = 350;
const DEPLOYMENT_WEIGHT = 16;
const KING_SAFETY_WEIGHT = 40;
const KING_THREAT_WEIGHT = 35;
const CENTER_BLOCKADE_WEIGHT = 25;
const COLOR_DIVERSITY_WEIGHT = 12;

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

function countMobileDefenders(state: GameState, square: Coordinate, player: Player): number {
  let defenders = 0;

  for (const step of ADJACENT_STEPS) {
    const row = square.row + step.row;
    const col = square.col + step.col;

    if (!isInsideBoard(row, col) || isCenterTile(row, col)) {
      continue;
    }

    const piece = state.board[row][col];
    if (piece && piece.player === player && piece.type !== "sentinel") {
      defenders += 1;
    }
  }

  return defenders;
}

function countEnemyAdjacency(state: GameState, square: Coordinate, player: Player): number {
  const opponent = getOpponent(player);
  let enemies = 0;

  for (const step of ADJACENT_STEPS) {
    const row = square.row + step.row;
    const col = square.col + step.col;

    if (!isInsideBoard(row, col) || isCenterTile(row, col)) {
      continue;
    }

    const piece = state.board[row][col];
    if (piece && piece.player === opponent) {
      enemies += 1;
    }
  }

  return enemies;
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
      const defenderCount = countMobileDefenders(state, square, player);
      const pieceScale = getPieceValue(piece);

      if (attackCount > 0) {
        safetyScore -= attackCount * (8 + pieceScale * 2);
      }

      safetyScore += defenderCount * (2 + Math.floor(pieceScale / 3));
    }
  }

  return safetyScore;
}

function getCaptureThreatScore(state: GameState, player: Player): number {
  const strongestThreatBySquare = new Map<string, number>();
  const legalMoves = getAllLegalMoves(state, player);

  for (const move of legalMoves) {
    if (move.action !== "move" || !move.capture) {
      continue;
    }

    const target = getPiece(state, move.to.row, move.to.col);
    if (!target) {
      continue;
    }

    const key = `${move.to.row},${move.to.col}`;
    const targetValue = CAPTURE_VALUES[target.type] ?? 0;
    const currentBest = strongestThreatBySquare.get(key) ?? 0;
    if (targetValue > currentBest) {
      strongestThreatBySquare.set(key, targetValue);
    }
  }

  let score = 0;
  for (const value of strongestThreatBySquare.values()) {
    score += value;
  }

  return score;
}

function getSentinelPositionScore(state: GameState, player: Player): number {
  let score = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player || piece.type !== "sentinel") {
        continue;
      }

      const square = { row, col };
      const nearestTownDistance = Math.min(
        getHexDistance(square, TOWN_POSITIONS[0]),
        getHexDistance(square, TOWN_POSITIONS[1])
      );

      score += Math.max(0, 5 - nearestTownDistance) * 4;
      score += countFriendlyAdjacency(state, square, player) * 3;
      score += countEnemyAdjacency(state, square, player) * 5;
    }
  }

  return score;
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
  const reserveFlexibility = reserve.horse * 2 + reserve.sentinel + reserve.pawn;

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

function getKingCenterBonus(state: GameState, player: Player): number {
  const center = { row: 4, col: 4 };
  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (piece?.player === player && piece.type === "king") {
        const dist = getHexDistance({ row, col }, center);
        return Math.max(0, 8 - dist);
      }
    }
  }
  return 0;
}

function findKingSquare(state: GameState, player: Player): Coordinate | null {
  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (piece?.player === player && piece.type === "king") {
        return { row, col };
      }
    }
  }

  return null;
}

function getDeploymentScore(state: GameState, player: Player): number {
  let piecesOnBoard = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (piece?.player === player) {
        piecesOnBoard += 1;
      }
    }
  }

  return piecesOnBoard;
}

function getKingSafetyScale(distanceToCenter: number): number {
  if (distanceToCenter <= 2) {
    return 0.25;
  }

  if (distanceToCenter >= 4) {
    return 1;
  }

  return 0.6;
}

function getKingSafetyScore(state: GameState, player: Player): number {
  const ownKing = findKingSquare(state, player);
  if (!ownKing) {
    return 0;
  }

  const center = { row: 4, col: 4 };
  const distanceToCenter = getHexDistance(ownKing, center);
  const scale = getKingSafetyScale(distanceToCenter);
  const opponent = getOpponent(player);
  let baseScore = 0;

  for (const step of ADJACENT_STEPS) {
    const row = ownKing.row + step.row;
    const col = ownKing.col + step.col;

    if (!isInsideBoard(row, col) || isCenterTile(row, col)) {
      continue;
    }

    const piece = state.board[row][col];
    if (!piece) {
      continue;
    }

    if (piece.player === player) {
      baseScore += piece.type === "sentinel" ? 6 : 3;
    } else if (piece.player === opponent) {
      baseScore -= 4;
    }
  }

  return Math.round(baseScore * scale);
}

function getKingThreatScore(state: GameState, player: Player): number {
  const opponent = getOpponent(player);
  const enemyKing = findKingSquare(state, opponent);
  if (!enemyKing) {
    return 0;
  }

  let score = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const square = { row, col };
      const distance = getHexDistance(square, enemyKing);

      if (distance === 1) {
        const defenders = countMobileDefenders(state, square, player);
        score += defenders > 0 ? 4 : 1;
      } else if (distance === 2) {
        score += 2;
      }
    }
  }

  return score;
}

function getCenterBlockadeScore(state: GameState, player: Player): number {
  const opponent = getOpponent(player);
  const enemyKing = findKingSquare(state, opponent);
  if (!enemyKing) {
    return 0;
  }

  const center = { row: 4, col: 4 };
  const enemyKingDistance = getHexDistance(enemyKing, center);
  let score = 0;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const square = { row, col };
      const pieceDistanceToCenter = getHexDistance(square, center);
      if (pieceDistanceToCenter <= 2 && pieceDistanceToCenter < enemyKingDistance) {
        score += 1;
      }
    }
  }

  return score;
}

function getColorDiversityScore(state: GameState, player: Player): number {
  const occupiedColors = new Set<string>();

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const color = getTileColor(state, row, col);
      if (color) {
        occupiedColors.add(color);
      }
    }
  }

  return occupiedColors.size;
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

  const captureThreatScore =
    (getCaptureThreatScore(state, player) - getCaptureThreatScore(state, opponent)) *
    CAPTURE_THREAT_WEIGHT;

  const sentinelPositionScore =
    (getSentinelPositionScore(state, player) - getSentinelPositionScore(state, opponent)) *
    SENTINEL_POSITION_WEIGHT;

  const kingCenterScore =
    (getKingCenterBonus(state, player) - getKingCenterBonus(state, opponent)) *
    KING_CENTER_DISTANCE_WEIGHT;

  const deploymentScore =
    (getDeploymentScore(state, player) - getDeploymentScore(state, opponent)) * DEPLOYMENT_WEIGHT;

  const kingSafetyScore =
    (getKingSafetyScore(state, player) - getKingSafetyScore(state, opponent)) * KING_SAFETY_WEIGHT;

  const kingThreatScore =
    (getKingThreatScore(state, player) - getKingThreatScore(state, opponent)) * KING_THREAT_WEIGHT;

  const centerBlockadeScore =
    (getCenterBlockadeScore(state, player) - getCenterBlockadeScore(state, opponent)) *
    CENTER_BLOCKADE_WEIGHT;

  const colorDiversityScore =
    (getColorDiversityScore(state, player) - getColorDiversityScore(state, opponent)) *
    COLOR_DIVERSITY_WEIGHT;

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
    captureThreatScore +
    sentinelPositionScore +
    kingCenterScore +
    deploymentScore +
    kingSafetyScore +
    kingThreatScore +
    centerBlockadeScore +
    colorDiversityScore +
    pushPressureScore +
    openingScore +
    endgameScore
  );
}

function isSquareAdjacentToEnemyKing(state: GameState, square: Coordinate, player: Player): boolean {
  const enemyKing = findKingSquare(state, getOpponent(player));
  if (!enemyKing) {
    return false;
  }

  return getHexDistance(square, enemyKing) === 1;
}

function hasHighValueFriendlyAdjacent(
  state: GameState,
  square: Coordinate,
  player: Player,
  ignoreSquare?: Coordinate
): boolean {
  for (const step of ADJACENT_STEPS) {
    const row = square.row + step.row;
    const col = square.col + step.col;

    if (!isInsideBoard(row, col) || isCenterTile(row, col)) {
      continue;
    }

    if (ignoreSquare && ignoreSquare.row === row && ignoreSquare.col === col) {
      continue;
    }

    const piece = state.board[row][col];
    if (piece?.player === player && getPieceValue(piece) >= 8) {
      return true;
    }
  }

  return false;
}

function isQuietMove(
  state: GameState,
  move: MoveAction,
  actingPlayer: Player,
  center: Coordinate
): boolean {
  if (move.capture || move.push) {
    return false;
  }

  if (isTownSquare(move.to)) {
    return false;
  }

  const enemyAdjacency = countEnemyAdjacency(state, move.to, actingPlayer);
  const friendlyAdjacency = countFriendlyAdjacency(state, move.to, actingPlayer);
  if (enemyAdjacency > 0 || friendlyAdjacency > 0) {
    return false;
  }

  const fromDistance = getHexDistance(move.from, center);
  const toDistance = getHexDistance(move.to, center);
  return toDistance >= fromDistance;
}

function getImmediateCaptureRiskPenalty(
  state: GameState,
  square: Coordinate,
  player: Player
): number {
  const piece = state.board[square.row][square.col];
  if (!piece || piece.player !== player) {
    return 0;
  }

  const opponent = getOpponent(player);
  const opponentMoves = getAllLegalMoves(state, opponent);
  const captureThreats = opponentMoves.filter(
    (candidate) =>
      candidate.action === "move" &&
      candidate.capture &&
      candidate.to.row === square.row &&
      candidate.to.col === square.col
  ) as MoveAction[];

  if (captureThreats.length === 0) {
    return 0;
  }

  let unretakeableThreats = 0;
  let retakeableThreats = 0;

  for (const threat of captureThreats) {
    const afterCapture = applyAction(state, threat);
    const canRetake = getAllLegalMoves(afterCapture, player).some(
      (reply) =>
        reply.action === "move" &&
        reply.capture &&
        reply.to.row === square.row &&
        reply.to.col === square.col
    );

    if (canRetake) {
      retakeableThreats += 1;
    } else {
      unretakeableThreats += 1;
    }
  }

  if (unretakeableThreats === 0) {
    return 0;
  }

  const mobileDefenders = countMobileDefenders(state, square, player);
  const pieceValue = getPieceValue(piece);

  let penalty = unretakeableThreats * (180 + pieceValue * 30);
  penalty += retakeableThreats * 45;
  penalty -= mobileDefenders * 40;

  if (isTownSquare(square)) {
    penalty += 180;
  }

  if (piece.type === "king") {
    penalty += 360;
  }

  return Math.max(0, penalty);
}

function getCaptureTradeScore(
  beforeState: GameState,
  afterState: GameState,
  move: MoveAction,
  player: Player
): number {
  if (!move.capture) {
    return 0;
  }

  const capturedPiece = getPiece(beforeState, move.to.row, move.to.col);
  if (!capturedPiece) {
    return 0;
  }

  const capturedValue = getPieceValue(capturedPiece);
  const attackerValue = getPieceValue(move.piece);
  const opponent = getOpponent(player);
  const square = move.to;

  const recaptures = getAllLegalMoves(afterState, opponent).filter(
    (candidate) =>
      candidate.action === "move" &&
      candidate.capture &&
      candidate.to.row === square.row &&
      candidate.to.col === square.col
  ) as MoveAction[];

  if (recaptures.length === 0) {
    return 180 + capturedValue * 16;
  }

  let worstNet = Number.POSITIVE_INFINITY;

  for (const recapture of recaptures) {
    const afterRecapture = applyAction(afterState, recapture);
    const canReplyRecapture = getAllLegalMoves(afterRecapture, player).some(
      (reply) =>
        reply.action === "move" &&
        reply.capture &&
        reply.to.row === square.row &&
        reply.to.col === square.col
    );

    let netMaterial = capturedValue - attackerValue;
    if (canReplyRecapture) {
      netMaterial += getPieceValue(recapture.piece);
    }

    if (netMaterial < worstNet) {
      worstNet = netMaterial;
    }
  }

  if (!Number.isFinite(worstNet)) {
    return 0;
  }

  return worstNet * 75;
}

function getThreatenedFriendlyTownCount(state: GameState, player: Player): number {
  const opponent = getOpponent(player);
  const opponentMoves = getAllLegalMoves(state, opponent);

  let threatened = 0;
  for (const town of TOWN_POSITIONS) {
    const townPiece = state.board[town.row][town.col];
    if (!townPiece || townPiece.player !== player) {
      continue;
    }

    const isThreatened = opponentMoves.some(
      (candidate) =>
        candidate.action === "move" &&
        candidate.capture &&
        candidate.to.row === town.row &&
        candidate.to.col === town.col
    );

    if (isThreatened) {
      threatened += 1;
    }
  }

  return threatened;
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
  const center = { row: 4, col: 4 };
  let score = 0;

  if (move.action === "place") {
    const placement = move as PlacementAction;
    const nearEnemyDistance = getNearestEnemyDistance(state, placement.to, actingPlayer);
    const townDistance = Math.min(
      getHexDistance(placement.to, TOWN_POSITIONS[0]),
      getHexDistance(placement.to, TOWN_POSITIONS[1])
    );
    const friendlyAdjacency = countFriendlyAdjacency(state, placement.to, actingPlayer);
    const enemyAdjacency = countEnemyAdjacency(state, placement.to, actingPlayer);

    score += PLACEMENT_ORDER_VALUES[placement.placeType] ?? 0;
    if (Number.isFinite(nearEnemyDistance)) {
      score += Math.max(0, 8 - nearEnemyDistance) * 12;
    }
    score += Math.max(0, 8 - townDistance) * 20;
    score += friendlyAdjacency * 6 + enemyAdjacency * 9;

    if (placement.placeType === "sentinel") {
      score += Math.max(0, 7 - townDistance) * 40;
      score += friendlyAdjacency * 16 + enemyAdjacency * 22;
      if (state.moveNumber <= 10) {
        score += 110;
      }
    }

    if (placement.placeType === "king") {
      if (state.moveNumber < 8) {
        score -= 300;
      } else {
        score += 150;
      }

      score += friendlyAdjacency * 20;
      score -= enemyAdjacency * 140;
      if (friendlyAdjacency === 0) {
        score -= 120;
      }
    }

    if (state.turnPhase === "action") {
      score += state.moveNumber <= 12 ? 400 : 200;
    }
  } else {
    const moveAction = move as MoveAction;

    if (moveAction.capture) {
      const target = getPiece(state, moveAction.to.row, moveAction.to.col);
      if (target) {
        score += 560 + (CAPTURE_VALUES[target.type] ?? 0) * 46;
      } else {
        score += 500;
      }
    }

    if (isTownSquare(moveAction.to)) {
      score += moveAction.capture ? 380 : 220;
    }

    if (moveAction.push) {
      score += 160;
    }

    if (isQuietMove(state, moveAction, actingPlayer, center)) {
      score -= 220;
    }
  }

  const threatenedTownsBefore = getThreatenedFriendlyTownCount(state, actingPlayer);

  const destination = move.to;
  const ignoreSquare = move.action === "move" ? (move as MoveAction).from : undefined;
  if (hasHighValueFriendlyAdjacent(state, destination, actingPlayer, ignoreSquare)) {
    score += 120;
  }

  if (isSquareAdjacentToEnemyKing(state, destination, actingPlayer)) {
    score += 200;
  }

  const nextState = applyAction(state, move);

  if (move.action === "move" && move.capture) {
    score += getCaptureTradeScore(state, nextState, move as MoveAction, actingPlayer);
  }

  const immediateRiskPenalty = getImmediateCaptureRiskPenalty(nextState, destination, actingPlayer);
  score -= move.action === "place" ? Math.floor(immediateRiskPenalty * 0.5) : immediateRiskPenalty;

  if (nextState.winner === actingPlayer) {
    score += WIN_SCORE / 2;
  }

  const threatenedTownsAfter = getThreatenedFriendlyTownCount(nextState, actingPlayer);
  score += (threatenedTownsBefore - threatenedTownsAfter) * 520;

  if (move.action === "place" && (move as PlacementAction).placeType === "king" && threatenedTownsBefore > 0) {
    score -= 450;
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

function getCoordinateLabel(square: Coordinate): string {
  return toAlgebraic(square);
}

function getMoveReasons(state: GameState, action: GameAction, player: Player): string[] {
  const reasons: string[] = [];

  if (action.action === "place") {
    reasons.push(`develops a ${action.placeType}`);

    if (action.placeType === "king") {
      const friendlyAdjacency = countFriendlyAdjacency(state, action.to, player);
      if (friendlyAdjacency > 0) {
        reasons.push(`king enters with ${friendlyAdjacency} nearby defender${friendlyAdjacency === 1 ? "" : "s"}`);
      }
    }
  } else {
    if (action.capture) {
      const target = getPiece(state, action.to.row, action.to.col);
      if (target) {
        reasons.push(`captures ${target.player} ${target.type}`);
      } else {
        reasons.push("plays an immediate capture");
      }
    }

    if (action.push) {
      reasons.push("creates push pressure");
    }

    if (isTownSquare(action.to)) {
      reasons.push("reinforces town control");
    }
  }

  if (isSquareAdjacentToEnemyKing(state, action.to, player)) {
    reasons.push("increases pressure on the enemy king");
  }

  const threatenedBefore = getThreatenedFriendlyTownCount(state, player);
  if (threatenedBefore > 0) {
    const afterState = applyAction(state, action);
    const threatenedAfter = getThreatenedFriendlyTownCount(afterState, player);
    if (threatenedAfter < threatenedBefore) {
      reasons.push("reduces immediate town-capture threats");
    }
  }

  return reasons;
}

function buildAIMoveExplanation(
  state: GameState,
  action: GameAction,
  player: Player,
  reachedDepth: number,
  nodesVisited: number,
  elapsedMs: number
): string {
  const reasons = getMoveReasons(state, action, player);
  const destination = getCoordinateLabel(action.to);
  const actionText =
    action.action === "place"
      ? `Place ${action.placeType} on ${destination}`
      : `Move ${action.piece.player} ${action.piece.type} to ${destination}`;

  const reasonText = reasons.length > 0 ? reasons.join("; ") : "best overall score from current search";

  return `${actionText}. Why: ${reasonText}. Search depth ${reachedDepth}, nodes ${nodesVisited}, time ${elapsedMs}ms.`;
}

function toAIMove(action: GameAction, explanation: string): AIMove {
  if (action.action === "place") {
    const placement = action as PlacementAction;
    return {
      action: "place",
      from: null,
      to: { ...placement.to },
      capture: false,
      piece: null,
      placeType: placement.placeType,
      explanation
    };
  }

  const move = action as MoveAction;
  return {
    action: "move",
    from: { ...move.from },
    to: { ...move.to },
    capture: move.capture,
    piece: move.piece,
    placeType: null,
    explanation
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
        const openingExplanation = buildAIMoveExplanation(state, openingPlacement, player, 0, 0, 0);
        return toAIMove(openingPlacement, openingExplanation);
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

  const explanation = buildAIMoveExplanation(
    state,
    bestMove,
    player,
    reachedDepth,
    context.nodesVisited,
    elapsedMs
  );

  return toAIMove(bestMove, explanation);
}
