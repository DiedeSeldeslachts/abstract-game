/**
 * Game controller - wires together game.ts, renderer.ts, and ai.ts.
 * Manages UI state, event handlers, and turn flow.
 */

import type { UIState, GameState, Coordinate, PlaceableType } from "./types.js";
import {
  applyMove,
  applyPassPush,
  applyPlacement,
  createInitialState,
  getAllLegalMoves,
  getLegalMoves,
  getLegalPlacements,
  getRemainingReserveCounts,
  PLACEMENT_LIMITS
} from "./game.js";
import { chooseAIMove } from "./ai.js";
import {
  renderGame,
  BOARD_ELEMENT,
  GAME_MODE_SELECT,
  RESERVE_BUTTONS
} from "./renderer.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AI_PLAYER = "black";
const AI_MOVE_DELAY_MS = 320;
const GAME_MODE_VS_AI = "vs-ai";
const GAME_MODE_VS_PLAYER = "vs-player";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// Game state: immutable snapshot replaced after each action
let state: GameState = createInitialState();

// UI state: mutable controller variables tracking interaction state
let uiState: UIState = {
  gameMode: GAME_MODE_VS_AI,
  selectedSquare: null,
  selectedMoves: [],
  selectedPlacementType: null,
  aiThinking: false
};

let aiMoveTimer: ReturnType<typeof window.setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(): void {
  renderGame(state, uiState);
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

function clearSelection(): void {
  uiState.selectedSquare = null;
  uiState.selectedMoves = [];
  uiState.selectedPlacementType = null;
}

function isAIControlledPlayer(player: string): boolean {
  return uiState.gameMode === GAME_MODE_VS_AI && player === AI_PLAYER;
}

// ---------------------------------------------------------------------------
// Auto-pass: if the push phase has no legal moves, pass automatically
// ---------------------------------------------------------------------------

function checkAutoPassPushPhase(): void {
  if (state.winner || state.turnPhase !== "push") return;
  if (getAllLegalMoves(state, state.currentPlayer).length === 0) {
    state = applyPassPush(state);
    clearSelection();
  }
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

function performAIMove(): void {
  if (state.winner || !isAIControlledPlayer(state.currentPlayer)) {
    uiState.aiThinking = false;
    render();
    return;
  }

  const move = chooseAIMove(state, state.currentPlayer);

  if (!move) {
    if (state.turnPhase === "push") {
      state = applyPassPush(state);
      clearSelection();
    }
    uiState.aiThinking = false;
    render();
    return;
  }

  state =
    move.action === "place"
      ? applyPlacement(state, move.to, move.placeType!)
      : applyMove(state, move.from!, move.to);
  clearSelection();

  // AI may have a second move (push phase after action phase)
  if (!state.winner && isAIControlledPlayer(state.currentPlayer)) {
    render();
    aiMoveTimer = window.setTimeout(() => {
      aiMoveTimer = null;
      performAIMove();
    }, AI_MOVE_DELAY_MS) as any;
    return;
  }

  uiState.aiThinking = false;
  render();
}

function scheduleAIMove(): void {
  if (state.winner || !isAIControlledPlayer(state.currentPlayer)) return;

  uiState.aiThinking = true;
  render();

  if (aiMoveTimer) window.clearTimeout(aiMoveTimer);
  aiMoveTimer = window.setTimeout(() => {
    aiMoveTimer = null;
    performAIMove();
  }, AI_MOVE_DELAY_MS) as any;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handleSquareClick(event: Event): void {
  const hexEl = (event.target as Element).closest("button[data-row][data-col]");

  if (
    !hexEl ||
    state.winner ||
    uiState.aiThinking ||
    isAIControlledPlayer(state.currentPlayer)
  ) {
    return;
  }

  const row = Number((hexEl as HTMLElement).dataset.row);
  const col = Number((hexEl as HTMLElement).dataset.col);
  const targetMove = uiState.selectedMoves.find((m) => m.row === row && m.col === col);

  // Placement mode: click a highlighted hex to place the selected piece type
  if (uiState.selectedPlacementType) {
    if (targetMove) {
      state = applyPlacement(state, { row, col }, uiState.selectedPlacementType);
      clearSelection();
      checkAutoPassPushPhase();
      render();
      if (!state.winner) scheduleAIMove();
    }
    return;
  }

  // Move mode: click a highlighted hex to move the selected piece
  if (uiState.selectedSquare && targetMove) {
    state = applyMove(state, uiState.selectedSquare, { row, col });
    clearSelection();
    checkAutoPassPushPhase();
    render();
    if (!state.winner) scheduleAIMove();
    return;
  }

  // Selection: click a friendly piece to select it, or click elsewhere to deselect
  const piece = state.board[row][col];
  if (piece && piece.player === state.currentPlayer) {
    uiState.selectedSquare = { row, col };
    uiState.selectedMoves = getLegalMoves(state, row, col);
  } else {
    clearSelection();
  }
  render();
}

function handleReserveButtonClick(event: Event): void {
  const button = event.currentTarget as HTMLElement;
  const pieceType = button.getAttribute("data-place-type");

  if (!pieceType || !Object.prototype.hasOwnProperty.call(PLACEMENT_LIMITS, pieceType)) {
    return;
  }

  if (
    state.winner ||
    uiState.aiThinking ||
    isAIControlledPlayer(state.currentPlayer) ||
    state.turnPhase === "push"
  ) {
    return;
  }

  const reserveLeft = getRemainingReserveCounts(state, state.currentPlayer)[
    pieceType as PlaceableType
  ];
  if (reserveLeft <= 0) return;

  if (uiState.selectedPlacementType === pieceType) {
    clearSelection();
    render();
    return;
  }

  uiState.selectedPlacementType = pieceType as PlaceableType;
  uiState.selectedSquare = null;
  uiState.selectedMoves = getLegalPlacements(state, state.currentPlayer)
    .filter((p) => p.placeType === pieceType)
    .map((p) => ({ row: p.to.row, col: p.to.col, capture: false }));
  render();
}

function handleModeChange(event: Event): void {
  const nextMode = (event.target as HTMLSelectElement).value;
  if (nextMode !== GAME_MODE_VS_AI && nextMode !== GAME_MODE_VS_PLAYER) return;

  if (aiMoveTimer) {
    window.clearTimeout(aiMoveTimer);
    aiMoveTimer = null;
  }

  uiState.gameMode = nextMode;
  state = createInitialState();
  clearSelection();
  uiState.aiThinking = false;
  render();
  scheduleAIMove();
}

function handleRestartClick(): void {
  if (aiMoveTimer) {
    window.clearTimeout(aiMoveTimer);
    aiMoveTimer = null;
  }

  state = createInitialState();
  uiState.selectedSquare = null;
  uiState.selectedMoves = [];
  uiState.selectedPlacementType = null;
  uiState.aiThinking = false;
  render();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

BOARD_ELEMENT.addEventListener("click", handleSquareClick);
document.querySelector("#restart-button")!.addEventListener("click", handleRestartClick);
GAME_MODE_SELECT.addEventListener("change", handleModeChange);
for (const button of RESERVE_BUTTONS) {
  button.addEventListener("click", handleReserveButtonClick);
}

render();
