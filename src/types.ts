/**
 * Shared type definitions for the Kingstep game engine.
 */

/**
 * Player identifier - either "white" or "black"
 */
export type Player = "white" | "black";

/**
 * Piece type string
 */
export type PieceType = "commander" | "horse" | "king" | "pawn" | "sentinel";

/**
 * Placeable piece types (subset of PieceType that can be placed from reserve)
 */
export type PlaceableType = "commander" | "pawn" | "horse" | "king" | "sentinel";

/**
 * Turn phase - primary action or commander-granted extra move phase
 */
export type TurnPhase = "action" | "push";

/**
 * Coordinate on the board (row/col in offset coordinates)
 */
export interface Coordinate {
  row: number;
  col: number;
}

/**
 * A piece in play on the board
 */
export interface Piece {
  id: string;
  player: Player;
  type: PieceType;
}

/**
 * Axial coordinate (for hex distance calculations)
 */
export interface AxialCoordinate {
  q: number;
  r: number;
}

/**
 * Tile color used for pawn movement rules
 */
export type TileColor = "green" | "blue" | "yellow" | "brown" | "white";

/**
 * Single-step destination from getLegalMoves (before expansion)
 */
export interface MoveDestination {
  row: number;
  col: number;
  capture: boolean;
  push?: boolean;
  pushTo?: Coordinate;
}

/**
 * Placement action from getLegalPlacements
 */
export interface PlacementAction {
  action: "place";
  to: Coordinate;
  placeType: PlaceableType;
  capture: false;
}

/**
 * Move action from getAllLegalMoves
 */
export interface MoveAction {
  action: "move";
  from: Coordinate;
  to: Coordinate;
  capture: boolean;
  push: boolean;
  pushTo: Coordinate | null;
  piece: Piece;
}

/**
 * Any game action - placement or move
 */
export type GameAction = PlacementAction | MoveAction;

/**
 * Base attributes for all last action records
 */
interface LastActionBase {
  kind: string;
  player: Player;
  piece: Piece | null;
  from: Coordinate | null;
  to: Coordinate | null;
  capturedPiece: Piece | null;
}

/**
 * Action record when a move is executed
 */
export interface LastActionMove extends LastActionBase {
  kind: "move";
}

/**
 * Action record when a capture occurs
 */
export interface LastActionCapture extends LastActionBase {
  kind: "capture";
}

/**
 * Action record when a push occurs
 */
export interface LastActionPush extends LastActionBase {
  kind: "push";
  pushedPiece: Piece;
  pushTo: Coordinate;
}

/**
 * Action record when a piece is placed
 */
export interface LastActionPlace extends LastActionBase {
  kind: "place";
}

/**
 * Action record when a player ends the extra move phase early
 */
export interface LastActionPass extends LastActionBase {
  kind: "pass";
}

/**
 * Union of all last action types
 */
export type LastAction =
  | LastActionMove
  | LastActionCapture
  | LastActionPush
  | LastActionPlace
  | LastActionPass
  | null;

/**
 * Piece counter for a single player (how many pieces of each type exist)
 */
export interface PieceCounter {
  commander: number;
  horse: number;
  king: number;
  pawn: number;
  sentinel: number;
}

/**
 * Placement counter for a single player (how many of each placeable type have been placed)
 */
export interface PlacementCounter {
  commander: number;
  pawn: number;
  horse: number;
  king: number;
  sentinel: number;
}

/**
 * Immutable game state - snapshot of one moment during the game
 */
export interface GameState {
  board: (Piece | null)[][];
  tileColors: Record<string, TileColor>;
  currentPlayer: Player;
  winner: Player | null;
  moveNumber: number;
  turnPhase: TurnPhase;
  extraMovesRemaining: number;
  townControlPendingPlayer: Player | null;
  lastAction: LastAction;
  capturedPieces: {
    white: Piece[];
    black: Piece[];
  };
  pieceCounters: {
    white: PieceCounter;
    black: PieceCounter;
  };
  placedPieces: {
    white: PlacementCounter;
    black: PlacementCounter;
  };
}

/**
 * UI state - mutable controller state for interaction
 */
export interface UIState {
  gameMode: string; // "vs-ai" | "vs-player"
  selectedSquare: Coordinate | null;
  selectedMoves: MoveDestination[];
  selectedPlacementType: PlaceableType | null;
  aiThinking: boolean;
}

/**
 * AI move choice - what action the AI has selected to execute
 */
export interface AIMove {
  action: "move" | "place";
  from: Coordinate | null;
  to: Coordinate;
  capture: boolean;
  piece: Piece | null;
  placeType: PlaceableType | null;
}
