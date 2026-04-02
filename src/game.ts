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
  MoveApplyOptions,
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
const UNIT_TYPES: readonly PieceType[] = ["commander", "horse", "pawn", "sentinel", "teacher"];
const PLACEABLE_TYPES: readonly PlaceableType[] = ["pawn", "horse", "sentinel", "teacher"];
export const PLACEMENT_LIMITS: Record<PlaceableType, number> = {
  pawn: 5,
  horse: 2,
  sentinel: 2,
  teacher: 1
};
export const TEACHER_TRANSFORM_TARGET_TYPES: readonly PieceType[] = [
  "commander",
  "horse",
  "pawn",
  "sentinel"
];

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
  player: Player
): MoveDestination[] {
  const isPushPhase = state.turnPhase === "push";
  const moves: MoveDestination[] = [];

  for (const step of ADJACENT_STEPS) {
    const nextRow = row + step.row;
    const nextCol = col + step.col;

    if (!isEnterableSquare(nextRow, nextCol)) {
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

      moves.push({
        row: nextRow,
        col: nextCol,
        capture: Boolean(target)
      });
    }
  }

  return moves;
}

function hasAdjacentFriendlyCommander(
  state: GameState,
  row: number,
  col: number,
  player: Player
): boolean {
  for (const step of ADJACENT_STEPS) {
    const commanderRow = row + step.row;
    const commanderCol = col + step.col;

    if (!isInsideBoard(commanderRow, commanderCol)) {
      continue;
    }

    const adjacentPiece = state.board[commanderRow][commanderCol];

    if (
      adjacentPiece &&
      adjacentPiece.player === player &&
      adjacentPiece.type === "commander"
    ) {
      return true;
    }
  }

  return false;
}

function getCommanderAuraHopMovesForPawn(
  state: GameState,
  row: number,
  col: number,
  player: Player
): MoveDestination[] {
  if (!hasAdjacentFriendlyCommander(state, row, col, player)) {
    return [];
  }

  const isPushPhase = state.turnPhase === "push";
  const moves: MoveDestination[] = [];

  for (const step of ADJACENT_STEPS) {
    const blockerRow = row + step.row;
    const blockerCol = col + step.col;

    if (!isInsideBoard(blockerRow, blockerCol)) {
      continue;
    }

    const blocker = state.board[blockerRow][blockerCol];

    if (!blocker || blocker.player !== player) {
      continue;
    }

    const landingRow = blockerRow + step.row;
    const landingCol = blockerCol + step.col;

    if (!isEnterableSquare(landingRow, landingCol)) {
      continue;
    }

    const target = state.board[landingRow][landingCol];

    if (target && target.player === player) {
      continue;
    }

    if (isPushPhase) {
      if (!target) {
        moves.push({ row: landingRow, col: landingCol, capture: false });
      } else {
        const pushRow = landingRow + step.row;
        const pushCol = landingCol + step.col;
        if (isEnterableSquare(pushRow, pushCol) && !state.board[pushRow][pushCol]) {
          moves.push({
            row: landingRow,
            col: landingCol,
            capture: false,
            push: true,
            pushTo: { row: pushRow, col: pushCol }
          });
        }
      }
    } else {
      // Check if target exists and is capturable
      if (target && !isCapturablePiece(state, landingRow, landingCol, player)) {
        continue;
      }

      moves.push({
        row: landingRow,
        col: landingCol,
        capture: Boolean(target)
      });
    }
  }

  return moves;
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
        if (canCapture) {
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

      movesBySquare.set(`${landingRow},${landingCol}`, {
        row: landingRow,
        col: landingCol,
        capture: Boolean(landingPiece)
      });
    }
  }

  return Array.from(movesBySquare.values());
}

function getTeacherTransformTargets(
  state: GameState,
  row: number,
  col: number,
  player: Player
): MoveDestination[] {
  const targets: MoveDestination[] = [];

  for (const step of ADJACENT_STEPS) {
    const targetRow = row + step.row;
    const targetCol = col + step.col;

    if (!isInsideBoard(targetRow, targetCol)) {
      continue;
    }

    const piece = state.board[targetRow][targetCol];

    if (!piece || piece.player !== player || piece.type === "teacher") {
      continue;
    }

    const transformOptions = TEACHER_TRANSFORM_TARGET_TYPES.filter(
      (type) => type !== piece.type
    );

    if (transformOptions.length === 0) {
      continue;
    }

    targets.push({
      row: targetRow,
      col: targetCol,
      capture: false,
      transform: true,
      transformOptions: transformOptions as PieceType[]
    });
  }

  return targets;
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

  if (piece.type === "commander") {
    return getSingleStepMovesForPlayer(state, row, col, player);
  }

  if (piece.type === "teacher") {
    const moves = getSingleStepMovesForPlayer(state, row, col, player).filter(
      (move) => !move.capture
    );
    // Teacher cannot transform during push phase
    if (state.turnPhase === "push") {
      return moves;
    }
    return [...moves, ...getTeacherTransformTargets(state, row, col, player)];
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

  for (const move of getCommanderAuraHopMovesForPawn(state, row, col, player)) {
    movesBySquare.set(`${move.row},${move.col}`, move);
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
    pawn: PLACEMENT_LIMITS.pawn - state.placedPieces[player].pawn,
    horse: PLACEMENT_LIMITS.horse - state.placedPieces[player].horse,
    sentinel: PLACEMENT_LIMITS.sentinel - state.placedPieces[player].sentinel,
    teacher: PLACEMENT_LIMITS.teacher - state.placedPieces[player].teacher
  };
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

      for (const pieceType of PLACEABLE_TYPES) {
        if (reserve[pieceType] <= 0) {
          continue;
        }

        placements.push({
          action: "place",
          to: { row, col },
          placeType: pieceType,
          capture: false,
          transform: false
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
        if (move.transform && Array.isArray(move.transformOptions)) {
          for (const transformTo of move.transformOptions) {
            allMoves.push({
              action: "move",
              from: { row, col },
              to: { row: move.row, col: move.col },
              capture: false,
              piece,
              transform: true,
              transformTo,
              push: false,
              pushTo: null
            });
          }

          continue;
        }

        allMoves.push({
          action: "move",
          from: { row, col },
          to: { row: move.row, col: move.col },
          capture: move.capture,
          push: move.push ?? false,
          pushTo: move.pushTo ?? null,
          piece,
          transform: false,
          transformTo: null
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
        // Enemy piece: capture regardless of tile color, then stop
        moves.push({ row: nextRow, col: nextCol, capture: true });
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
  const isEndOfTurn = state.turnPhase === "push";
  return {
    ...state,
    board: cloneBoard(state.board),
    moveNumber: isEndOfTurn ? state.moveNumber + 1 : state.moveNumber,
    currentPlayer: isEndOfTurn ? getOpponent(state.currentPlayer) : state.currentPlayer,
    turnPhase: isEndOfTurn ? "action" : "push",
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

export function applyMove(
  state: GameState,
  from: Coordinate,
  to: Coordinate,
  options: MoveApplyOptions = {}
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

  const transformTo = options.transformTo ?? null;

  if (targetMove.transform) {
    if (!transformTo || !targetMove.transformOptions?.includes(transformTo)) {
      throw new Error("Choose a valid piece type for Teacher transformation.");
    }

    const targetPiece = nextState.board[to.row][to.col];

    if (
      !targetPiece ||
      targetPiece.player !== piece.player ||
      targetPiece.type === "teacher"
    ) {
      throw new Error("Teacher can only transform friendly non-Teacher pieces.");
    }

    nextState.board[to.row][to.col] = {
      ...targetPiece,
      type: transformTo
    };

    nextState.lastAction = {
      kind: "transform",
      player: piece.player,
      piece,
      from: { ...from },
      to: { ...to },
      capturedPiece: null,
      transformedFrom: targetPiece.type,
      transformedTo: transformTo
    };
  } else if (targetMove.push) {
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

  if (state.board[to.row][to.col]) {
    throw new Error("You can only place on an empty square.");
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

  resolveWinConditions(nextState, state, state.currentPlayer);

  return nextState;
}

export function toAlgebraic(square: Coordinate): string {
  return `${FILES[square.col]}${BOARD_ROWS - square.row}`;
}

export function applyPassPush(state: GameState): GameState {
  if (state.turnPhase !== "push") {
    throw new Error("Can only pass during push phase.");
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

  resolveWinConditions(nextState, state, state.currentPlayer);

  return nextState;
}
