/**
 * Core game engine and state management - pure logic, no DOM or side effects.
 * All state transformations are immutable: new state returned for each action.
 */

import type {
  Coordinate,
  GameState,
  Piece,
  PieceType,
  PlaceableType,
  Player,
  TileColor,
  TurnPhase,
  AxialCoordinate,
  MoveDestination,
  PlacementAction,
  MoveAction,
  GameAction,
  LastAction,
  PieceCounter,
  PlacementCounter,
  AIMove,
} from "./types.js";

export const BOARD_ROWS = 9;
export const BOARD_COLS = 9;
export const HEX_RADIUS = 4;

const FILES: readonly string[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
export const TOWN_POSITIONS: readonly Coordinate[] = [
  { row: 4, col: 2 }, // c5
  { row: 4, col: 6 }  // g5
];
export const CENTER_POSITION: Coordinate = { row: HEX_RADIUS, col: HEX_RADIUS }; // e5
const UNIT_TYPES: readonly PieceType[] = ["commander", "horse", "king", "pawn", "sentinel"];
const PLACEABLE_TYPES: readonly PlaceableType[] = ["commander", "pawn", "horse", "king", "sentinel"];
export const PLACEMENT_LIMITS: Record<PlaceableType, number> = {
  commander: 2,
  pawn: 5,
  horse: 2,
  king: 1,
  sentinel: 2
};

const ADJACENT_STEPS: readonly Coordinate[] = [
  { row: 0, col: 1 },
  { row: 0, col: -1 },
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: -1, col: -1 },
  { row: 1, col: 1 }
];

function isPlayableHex(q: number, r: number): boolean {
  return (
    Math.abs(q) <= HEX_RADIUS &&
    Math.abs(r) <= HEX_RADIUS &&
    Math.abs(q + r) <= HEX_RADIUS
  );
}

export function toAxial(square: Coordinate): AxialCoordinate {
  return {
    q: square.col - HEX_RADIUS,
    r: HEX_RADIUS - square.row
  };
}

function createEmptyBoard(): (Piece | null)[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null)
  );
}

function createPlayerPieceCounter(): PieceCounter {
  const counter: Record<string, number> = {};
  for (const type of UNIT_TYPES) {
    counter[type] = 0;
  }
  return counter as unknown as PieceCounter;
}

function createPieceCounters(): Record<Player, PieceCounter> {
  return {
    white: createPlayerPieceCounter(),
    black: createPlayerPieceCounter()
  };
}

function createPlacementCounters(): Record<Player, PlacementCounter> {
  const createCounter = (): PlacementCounter => {
    const counter: Record<string, number> = {};
    for (const type of PLACEABLE_TYPES) {
      counter[type] = 0;
    }
    return counter as unknown as PlacementCounter;
  };
  return {
    white: createCounter(),
    black: createCounter()
  };
}

function makePiece(
  player: Player,
  type: PieceType,
  counters: Record<Player, PieceCounter>
): Piece {
  counters[player][type] += 1;

  return {
    id: `${player}-${type}-${counters[player][type]}`,
    player,
    type
  };
}

function getOpponent(player: Player): Player {
  return player === "white" ? "black" : "white";
}

function cloneBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map((row) => row.slice());
}

function isCapturablePiece(
  state: GameState,
  row: number,
  col: number,
  capturePlayer: Player
): boolean {
  // All pieces are capturable
  const piece = state.board[row][col];

  if (!piece) {
    return false;
  }

  return true;
}

function getSingleStepMovesForPlayer(
  state: GameState,
  row: number,
  col: number,
  player: Player,
  allowCenter = false
): MoveDestination[] {
  const isPushPhase = state.turnPhase === "push";
  const moves: MoveDestination[] = [];

  for (const step of ADJACENT_STEPS) {
    const nextRow = row + step.row;
    const nextCol = col + step.col;

    const enterable = allowCenter
      ? isInsideBoard(nextRow, nextCol)
      : isEnterableSquare(nextRow, nextCol);

    if (!enterable) {
      continue;
    }

    const target = state.board[nextRow][nextCol];

    if (target && target.player === player) {
      continue;
    }

    if (isPushPhase) {
      if (!target) {
        moves.push({ row: nextRow, col: nextCol, capture: false });
      } else {
        // Enemy: legal only if the square behind is empty and on-board
        const pushRow = nextRow + step.row;
        const pushCol = nextCol + step.col;
        if (isEnterableSquare(pushRow, pushCol) && !state.board[pushRow][pushCol]) {
          moves.push({
            row: nextRow,
            col: nextCol,
            capture: false,
            push: true,
            pushTo: { row: pushRow, col: pushCol }
          });
        }
      }
    } else {
      // Check if target exists and is capturable
      if (target && !isCapturablePiece(state, nextRow, nextCol, player)) {
        continue;
      }

      if (target && !isCaptureAllowedByTileColor(state, row, col, nextRow, nextCol, step.row, step.col)) {
        continue;
      }

      moves.push({
        row: nextRow,
        col: nextCol,
        capture: Boolean(target)
      });
    }
  }

  return moves;
}

function countPiecesOfTypeOnBoard(state: GameState, player: Player, pieceType: PieceType): number {
  let count = 0;

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (!isInsideBoard(row, col)) {
        continue;
      }

      const piece = state.board[row][col];
      if (piece && piece.player === player && piece.type === pieceType) {
        count += 1;
      }
    }
  }

  return count;
}

function getHorseMovesForPlayer(
  state: GameState,
  row: number,
  col: number,
  player: Player
): MoveDestination[] {
  const isPushPhase = state.turnPhase === "push";
  const movesBySquare = new Map<string, MoveDestination>();

  for (const step of ADJACENT_STEPS) {
    const middleRow = row + step.row;
    const middleCol = col + step.col;

    if (!isEnterableSquare(middleRow, middleCol)) {
      continue;
    }

    const middlePiece = state.board[middleRow][middleCol];

    if (!middlePiece || middlePiece.player !== player) {
      if (isPushPhase) {
        if (!middlePiece) {
          movesBySquare.set(`${middleRow},${middleCol}`, {
            row: middleRow,
            col: middleCol,
            capture: false
          });
        } else {
          const pushRow = middleRow + step.row;
          const pushCol = middleCol + step.col;
          if (isEnterableSquare(pushRow, pushCol) && !state.board[pushRow][pushCol]) {
            movesBySquare.set(`${middleRow},${middleCol}`, {
              row: middleRow,
              col: middleCol,
              capture: false,
              push: true,
              pushTo: { row: pushRow, col: pushCol }
            });
          }
        }
      } else {
        const canCapture = !middlePiece || isCapturablePiece(state, middleRow, middleCol, player);
        const colorAllowed = !middlePiece || isCaptureAllowedByTileColor(state, row, col, middleRow, middleCol, step.row, step.col);
        if (canCapture && colorAllowed) {
          movesBySquare.set(`${middleRow},${middleCol}`, {
            row: middleRow,
            col: middleCol,
            capture: Boolean(middlePiece)
          });
        }
      }
    }

    if (middlePiece) {
      continue;
    }

    const landingRow = middleRow + step.row;
    const landingCol = middleCol + step.col;

    if (!isEnterableSquare(landingRow, landingCol)) {
      continue;
    }

    const landingPiece = state.board[landingRow][landingCol];

    if (landingPiece && landingPiece.player === player) {
      continue;
    }

    if (isPushPhase) {
      if (!landingPiece) {
        movesBySquare.set(`${landingRow},${landingCol}`, {
          row: landingRow,
          col: landingCol,
          capture: false
        });
      } else {
        const pushRow = landingRow + step.row;
        const pushCol = landingCol + step.col;
        if (isEnterableSquare(pushRow, pushCol) && !state.board[pushRow][pushCol]) {
          movesBySquare.set(`${landingRow},${landingCol}`, {
            row: landingRow,
            col: landingCol,
            capture: false,
            push: true,
            pushTo: { row: pushRow, col: pushCol }
          });
        }
      }
    } else {
      // Check if landing target is capturable
      if (landingPiece && !isCapturablePiece(state, landingRow, landingCol, player)) {
        continue;
      }

      if (landingPiece && !isCaptureAllowedByTileColor(state, row, col, landingRow, landingCol, step.row, step.col)) {
        continue;
      }

      movesBySquare.set(`${landingRow},${landingCol}`, {
        row: landingRow,
        col: landingCol,
        capture: Boolean(landingPiece)
      });
    }
  }

  return Array.from(movesBySquare.values());
}

function getLegalMovesForPlayer(
  state: GameState,
  row: number,
  col: number,
  player: Player
): MoveDestination[] {
  const piece = getPiece(state, row, col);

  if (!piece || piece.player !== player) {
    return [];
  }

  // Sentinels cannot move
  if (piece.type === "sentinel") {
    return [];
  }

  if (piece.type === "commander" || piece.type === "king") {
    return getSingleStepMovesForPlayer(state, row, col, player, piece.type === "king");
  }

  if (piece.type === "horse") {
    return getHorseMovesForPlayer(state, row, col, player);
  }

  if (piece.type !== "pawn") {
    return getSingleStepMovesForPlayer(state, row, col, player);
  }

  const movesBySquare = new Map<string, MoveDestination>();

  if (state.turnPhase === "push") {
    // Push phase: 1 step only, no color restriction
    for (const move of getSingleStepMovesForPlayer(state, row, col, player)) {
      movesBySquare.set(`${move.row},${move.col}`, move);
    }
  } else {
    // Action phase: slide any distance, stop only on same-color tile or first enemy
    for (const move of getPawnSlidingMoves(state, row, col, player)) {
      movesBySquare.set(`${move.row},${move.col}`, move);
    }
  }

  return Array.from(movesBySquare.values());
}

export function createEmptyState(currentPlayer: Player = "white"): GameState {
  return {
    board: createEmptyBoard(),
    tileColors: createRandomTileColors(),
    currentPlayer,
    winner: null,
    moveNumber: 1,
    turnPhase: "action",
    extraMovesRemaining: 0,
    townControlPendingPlayer: null,
    lastAction: null,
    capturedPieces: {
      white: [],
      black: []
    },
    pieceCounters: createPieceCounters(),
    placedPieces: createPlacementCounters()
  };
}

export function createInitialState(): GameState {
  const state = createEmptyState("white");

  state.board[TOWN_POSITIONS[0].row][TOWN_POSITIONS[0].col] = makePiece(
    "white",
    "pawn",
    state.pieceCounters
  );
  state.board[TOWN_POSITIONS[1].row][TOWN_POSITIONS[1].col] = makePiece(
    "black",
    "pawn",
    state.pieceCounters
  );

  return state;
}

export function getPiece(state: GameState, row: number, col: number): Piece | null {
  if (!isInsideBoard(row, col)) {
    return null;
  }

  return state.board[row][col];
}

export function isInsideBoard(row: number, col: number): boolean {
  if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
    return false;
  }

  const square = toAxial({ row, col });
  return isPlayableHex(square.q, square.r);
}

export function getLegalMoves(
  state: GameState,
  row: number,
  col: number
): MoveDestination[] {
  if (state.winner) {
    return [];
  }

  return getLegalMovesForPlayer(state, row, col, state.currentPlayer);
}

export function getRemainingReserveCounts(
  state: GameState,
  player: Player = state.currentPlayer
): Record<PlaceableType, number> {
  return {
    commander: PLACEMENT_LIMITS.commander - state.placedPieces[player].commander,
    pawn: PLACEMENT_LIMITS.pawn - state.placedPieces[player].pawn,
    horse: PLACEMENT_LIMITS.horse - state.placedPieces[player].horse,
    king: PLACEMENT_LIMITS.king - state.placedPieces[player].king,
    sentinel: PLACEMENT_LIMITS.sentinel - state.placedPieces[player].sentinel
  };
}

function getOccupiedTileColorsForPlayer(state: GameState, player: Player): Set<TileColor> {
  const occupiedColors = new Set<TileColor>();

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== player) {
        continue;
      }

      const tileColor = getTileColor(state, row, col);
      if (tileColor && tileColor !== "white") {
        occupiedColors.add(tileColor);
      }
    }
  }

  return occupiedColors;
}

export function getLegalPlacements(
  state: GameState,
  player: Player = state.currentPlayer
): PlacementAction[] {
  if (state.winner || state.turnPhase === "push") {
    return [];
  }

  const placements: PlacementAction[] = [];
  const reserve = getRemainingReserveCounts(state, player);
  const occupiedColors = getOccupiedTileColorsForPlayer(state, player);

  if (occupiedColors.size === 0) {
    return [];
  }

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (!isInsideBoard(row, col)) {
        continue;
      }

      if (
        state.board[row][col] ||
        isTownSquare(row, col) ||
        isCenterTile(row, col)
      ) {
        continue;
      }

      const destinationColor = getTileColor(state, row, col);
      if (!destinationColor || !occupiedColors.has(destinationColor)) {
        continue;
      }

      for (const pieceType of PLACEABLE_TYPES) {
        if (reserve[pieceType] <= 0) {
          continue;
        }

        if (pieceType === "king" && !isEdgeTile(row, col)) {
          continue;
        }

        placements.push({
          action: "place",
          to: { row, col },
          placeType: pieceType,
          capture: false
        });
      }
    }
  }

  return placements;
}

export function getAllLegalMoves(
  state: GameState,
  player: Player = state.currentPlayer
): GameAction[] {
  if (state.winner) {
    return [];
  }

  const allMoves: GameAction[] = [];

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (!isInsideBoard(row, col)) {
        continue;
      }

      const piece = state.board[row][col];

      if (!piece || piece.player !== player) {
        continue;
      }

      const moves = getLegalMovesForPlayer(state, row, col, player);

      for (const move of moves) {
        allMoves.push({
          action: "move",
          from: { row, col },
          to: { row: move.row, col: move.col },
          capture: move.capture,
          push: move.push ?? false,
          pushTo: move.pushTo ?? null,
          piece
        });
      }
    }
  }

  for (const placement of getLegalPlacements(state, player)) {
    allMoves.push(placement);
  }

  return allMoves;
}

export function getRemainingPieceCounts(
  state: GameState
): Record<Player, number> {
  const counts: Record<Player, number> = { white: 0, black: 0 };

  for (const row of state.board) {
    for (const piece of row) {
      if (piece) {
        counts[piece.player] += 1;
      }
    }
  }

  return counts;
}

export function playerControlsBothTowns(state: GameState, player: Player): boolean {
  for (const townPos of TOWN_POSITIONS) {
    const piece = state.board[townPos.row][townPos.col];
    if (!piece || piece.player !== player) {
      return false;
    }
  }
  return true;
}

export function isTownSquare(row: number, col: number): boolean {
  return TOWN_POSITIONS.some((town) => town.row === row && town.col === col);
}

export function isCenterTile(row: number, col: number): boolean {
  return row === HEX_RADIUS && col === HEX_RADIUS;
}

export function isEdgeTile(row: number, col: number): boolean {
  if (!isInsideBoard(row, col)) return false;
  const { q, r } = toAxial({ row, col });
  return Math.abs(q) === HEX_RADIUS || Math.abs(r) === HEX_RADIUS || Math.abs(q + r) === HEX_RADIUS;
}

function isEnterableSquare(row: number, col: number): boolean {
  return isInsideBoard(row, col) && !isCenterTile(row, col);
}

const TILE_COLOR_NAMES: readonly TileColor[] = ["green", "blue", "yellow", "brown"];

function shuffleInPlace<T>(values: T[]): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = temp;
  }
}

function createRandomTileColors(): Record<string, TileColor> {
  const positions: Coordinate[] = [];

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (!isInsideBoard(row, col) || isCenterTile(row, col)) {
        continue;
      }

      positions.push({ row, col });
    }
  }

  const colors: TileColor[] = [];
  for (const color of TILE_COLOR_NAMES) {
    for (let count = 0; count < positions.length / TILE_COLOR_NAMES.length; count += 1) {
      colors.push(color);
    }
  }

  shuffleInPlace(colors);

  const tileColors: Record<string, TileColor> = {};
  for (let index = 0; index < positions.length; index += 1) {
    const { row, col } = positions[index];
    tileColors[`${row},${col}`] = colors[index];
  }

  return tileColors;
}

export function getTileColor(state: GameState, row: number, col: number): TileColor | null {
  if (isCenterTile(row, col)) return "white";
  return state.tileColors?.[`${row},${col}`] ?? null;
}

function isCaptureAllowedByTileColor(
  state: GameState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  stepRow: number,
  stepCol: number
): boolean {
  const startColor = getTileColor(state, fromRow, fromCol);
  if (!startColor || startColor === "white") return false;

  let r = fromRow + stepRow;
  let c = fromCol + stepCol;
  while (isEnterableSquare(r, c)) {
    if (getTileColor(state, r, c) === startColor) return true;
    r += stepRow;
    c += stepCol;
  }
  return false;
}

function getPawnSlidingMoves(
  state: GameState,
  row: number,
  col: number,
  player: Player
): MoveDestination[] {
  const moves: MoveDestination[] = [];
  const startColor = getTileColor(state, row, col);

  for (const step of ADJACENT_STEPS) {
    let dist = 1;
    while (true) {
      const nextRow = row + dist * step.row;
      const nextCol = col + dist * step.col;

      if (!isEnterableSquare(nextRow, nextCol)) break;

      const target = state.board[nextRow][nextCol];

      if (target) {
        if (target.player === player) {
          // Friendly piece: blocked
          break;
        }
        // Enemy piece: capture allowed if any same-color tile exists on this forward ray
        if (isCaptureAllowedByTileColor(state, row, col, nextRow, nextCol, step.row, step.col)) {
          moves.push({ row: nextRow, col: nextCol, capture: true });
        }
        break;
      }

      // Empty tile: can stop only if same color as starting tile
      if (getTileColor(state, nextRow, nextCol) === startColor) {
        moves.push({ row: nextRow, col: nextCol, capture: false });
      }
      dist++;
    }
  }

  return moves;
}

function createNextStateBase(state: GameState): GameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    moveNumber: state.moveNumber,
    currentPlayer: state.currentPlayer,
    turnPhase: state.turnPhase,
    extraMovesRemaining: state.extraMovesRemaining,
    townControlPendingPlayer: state.townControlPendingPlayer,
    lastAction: null,
    capturedPieces: {
      white: [...state.capturedPieces.white],
      black: [...state.capturedPieces.black]
    },
    pieceCounters: {
      white: { ...state.pieceCounters.white },
      black: { ...state.pieceCounters.black }
    },
    placedPieces: {
      white: { ...state.placedPieces.white },
      black: { ...state.placedPieces.black }
    }
  };
}

function advanceTurnAfterAction(nextState: GameState, previousState: GameState, actingPlayer: Player): void {
  if (previousState.turnPhase === "action") {
    const commanderCount = countPiecesOfTypeOnBoard(nextState, actingPlayer, "commander");

    if (commanderCount > 0) {
      nextState.currentPlayer = actingPlayer;
      nextState.turnPhase = "push";
      nextState.extraMovesRemaining = commanderCount;
      return;
    }

    nextState.currentPlayer = getOpponent(actingPlayer);
    nextState.turnPhase = "action";
    nextState.extraMovesRemaining = 0;
    nextState.moveNumber += 1;
    return;
  }

  const remainingMoves = Math.max(0, previousState.extraMovesRemaining - 1);
  if (remainingMoves > 0) {
    nextState.currentPlayer = actingPlayer;
    nextState.turnPhase = "push";
    nextState.extraMovesRemaining = remainingMoves;
    return;
  }

  nextState.currentPlayer = getOpponent(actingPlayer);
  nextState.turnPhase = "action";
  nextState.extraMovesRemaining = 0;
  nextState.moveNumber += 1;
}

function resolveWinConditions(
  nextState: GameState,
  stateBeforeAction: GameState,
  actingPlayer: Player
): void {
  const remaining = getRemainingPieceCounts(nextState);
  const opponent = getOpponent(actingPlayer);

  if (remaining[opponent] === 0) {
    nextState.winner = actingPlayer;
  }

  // King captured: if opponent placed a king but it is no longer on the board, acting player wins
  if (!nextState.winner && nextState.pieceCounters[opponent].king > 0) {
    const opponentKingOnBoard = nextState.board.some(
      (boardRow) => boardRow.some((p) => p !== null && p.player === opponent && p.type === "king")
    );
    if (!opponentKingOnBoard) {
      nextState.winner = actingPlayer;
    }
  }

  // King on center: if a king occupies the center tile, that king's owner wins immediately
  if (!nextState.winner) {
    const centerPiece = nextState.board[CENTER_POSITION.row][CENTER_POSITION.col];
    if (centerPiece?.type === "king") {
      nextState.winner = centerPiece.player;
    }
  }

  // Town win and pending update only at end of a full turn (push phase → action phase)
  if (nextState.turnPhase === "action") {
    if (
      !nextState.winner &&
      stateBeforeAction.townControlPendingPlayer === nextState.currentPlayer &&
      playerControlsBothTowns(nextState, nextState.currentPlayer)
    ) {
      nextState.winner = nextState.currentPlayer;
    }

    nextState.townControlPendingPlayer = playerControlsBothTowns(nextState, actingPlayer)
      ? actingPlayer
      : null;
  }
}

export function getWinReason(state: GameState): string {
  if (!state.winner) return "";

  const winner = state.winner;
  const opponent = getOpponent(winner);

  const centerPiece = state.board[CENTER_POSITION.row][CENTER_POSITION.col];
  if (centerPiece?.player === winner && centerPiece.type === "king") {
    return "king reaching the center";
  }

  if (state.capturedPieces[winner].some((p) => p.type === "king" && p.player === opponent)) {
    return "capturing the opponent's king";
  }

  if (playerControlsBothTowns(state, winner)) {
    return "controlling both towns";
  }

  return "removing every opposing piece from the board";
}

export function applyMove(
  state: GameState,
  from: Coordinate,
  to: Coordinate
): GameState {
  if (state.winner) {
    throw new Error("The game is already finished.");
  }

  const piece = getPiece(state, from.row, from.col);

  if (!piece) {
    throw new Error("There is no piece on the selected square.");
  }

  if (piece.player !== state.currentPlayer) {
    throw new Error("It is not that piece's turn.");
  }

  const legalMoves = getLegalMoves(state, from.row, from.col);
  const targetMove = legalMoves.find((move) => move.row === to.row && move.col === to.col);

  if (!targetMove) {
    throw new Error("That move is not legal.");
  }

  const nextState = createNextStateBase(state);

  if (targetMove.push) {
    const pushedPiece = nextState.board[to.row][to.col];
    const pushTo = targetMove.pushTo!;

    if (!pushedPiece) {
      throw new Error("Push requires a piece to push.");
    }

    nextState.board[from.row][from.col] = null;
    nextState.board[to.row][to.col] = piece;
    nextState.board[pushTo.row][pushTo.col] = pushedPiece;

    nextState.lastAction = {
      kind: "push",
      player: piece.player,
      piece,
      from: { ...from },
      to: { ...to },
      pushedPiece,
      pushTo: { ...pushTo },
      capturedPiece: null
    };
  } else {
    const capturedPiece = nextState.board[to.row][to.col];

    nextState.board[from.row][from.col] = null;
    nextState.board[to.row][to.col] = piece;

    if (capturedPiece) {
      nextState.capturedPieces[piece.player].push(capturedPiece);
    }

    nextState.lastAction = {
      kind: capturedPiece ? "capture" : "move",
      player: piece.player,
      piece,
      from: { ...from },
      to: { ...to },
      capturedPiece: capturedPiece ?? null
    };
  }

  advanceTurnAfterAction(nextState, state, piece.player);
  resolveWinConditions(nextState, state, piece.player);

  return nextState;
}

export function applyPlacement(
  state: GameState,
  to: Coordinate,
  pieceType: PlaceableType
): GameState {
  if (state.winner) {
    throw new Error("The game is already finished.");
  }

  if (!PLACEABLE_TYPES.includes(pieceType)) {
    throw new Error("That piece type cannot be placed.");
  }

  if (!isInsideBoard(to.row, to.col)) {
    throw new Error("Placement must be on the board.");
  }

  if (isTownSquare(to.row, to.col)) {
    throw new Error("You cannot place directly on a town square.");
  }

  if (isCenterTile(to.row, to.col)) {
    throw new Error("You cannot place on the center tile.");
  }

  if (pieceType === "king" && !isEdgeTile(to.row, to.col)) {
    throw new Error("The king can only be placed on an edge tile.");
  }

  if (state.board[to.row][to.col]) {
    throw new Error("You can only place on an empty square.");
  }

  const occupiedColors = getOccupiedTileColorsForPlayer(state, state.currentPlayer);
  const destinationColor = getTileColor(state, to.row, to.col);

  if (!destinationColor || !occupiedColors.has(destinationColor)) {
    throw new Error("You can only place on a tile color you already occupy.");
  }

  const remainingReserve = getRemainingReserveCounts(state, state.currentPlayer);

  if (remainingReserve[pieceType] <= 0) {
    throw new Error(`No remaining ${pieceType} placements.`);
  }

  const nextState = createNextStateBase(state);
  const newPiece = makePiece(state.currentPlayer, pieceType, nextState.pieceCounters);

  nextState.board[to.row][to.col] = newPiece;
  nextState.placedPieces[state.currentPlayer][pieceType] += 1;
  nextState.lastAction = {
    kind: "place",
    player: state.currentPlayer,
    piece: newPiece,
    from: null,
    to: { ...to },
    capturedPiece: null
  };

  advanceTurnAfterAction(nextState, state, state.currentPlayer);
  resolveWinConditions(nextState, state, state.currentPlayer);

  return nextState;
}

export function toAlgebraic(square: Coordinate): string {
  return `${FILES[square.col]}${BOARD_ROWS - square.row}`;
}

export function applyPassPush(state: GameState): GameState {
  if (state.turnPhase !== "push") {
    throw new Error("Can only pass during the extra move phase.");
  }

  const nextState = createNextStateBase(state);

  nextState.lastAction = {
    kind: "pass",
    player: state.currentPlayer,
    piece: null,
    from: null,
    to: null,
    capturedPiece: null
  };

  nextState.currentPlayer = getOpponent(state.currentPlayer);
  nextState.turnPhase = "action";
  nextState.extraMovesRemaining = 0;
  nextState.moveNumber += 1;

  resolveWinConditions(nextState, state, state.currentPlayer);

  return nextState;
}
