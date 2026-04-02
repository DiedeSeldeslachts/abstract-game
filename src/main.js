// src/main.js
// Game controller: manages game state and UI state, handles user input, drives the AI.
// Delegates all DOM rendering to renderer.js and all game logic to game.js.

import {
  applyMove,
  applyPassPush,
  applyPlacement,
  createInitialState,
  getAllLegalMoves,
  getLegalMoves,
  getLegalPlacements,
  getRemainingReserveCounts,
  PLACEMENT_LIMITS,
} from "./game.js";
import { chooseAIMove } from "./ai.js";
import {
  cancelTransformOverlay,
  openTransformOverlay,
  renderGame,
  BOARD_ELEMENT,
  RESERVE_BUTTONS,
} from "./renderer.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HUMAN_PLAYER = "white";
const AI_PLAYER = "black";
const AI_MOVE_DELAY_MS = 320;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// Game state: immutable snapshot replaced after each action (see game.js)
let state = createInitialState();

// UI state: mutable controller variables tracking interaction state
let uiState = {
  humanPlayer: HUMAN_PLAYER,
  selectedSquare: null,         // { row, col } | null
  selectedMoves: [],            // highlighted legal destinations for selected piece
  selectedPlacementType: null,  // string | null – piece type chosen for placement
  aiThinking: false,            // true while AI timer is running
  transformChoicePending: false, // true while the transform overlay is open
};

let aiMoveTimer = null;

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  renderGame(state, uiState);
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

function clearSelection() {
  uiState.selectedSquare = null;
  uiState.selectedMoves = [];
  uiState.selectedPlacementType = null;
}

// ---------------------------------------------------------------------------
// Auto-pass: if the push phase has no legal moves, pass automatically
// ---------------------------------------------------------------------------

function checkAutoPassPushPhase() {
  if (state.winner || state.turnPhase !== "push") return;
  if (getAllLegalMoves(state, state.currentPlayer).length === 0) {
    state = applyPassPush(state);
    clearSelection();
  }
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

function performAIMove() {
  if (state.winner || state.currentPlayer !== AI_PLAYER) {
    uiState.aiThinking = false;
    render();
    return;
  }

  const move = chooseAIMove(state, AI_PLAYER);

  if (!move) {
    if (state.turnPhase === "push") {
      state = applyPassPush(state);
      clearSelection();
    }
    uiState.aiThinking = false;
    render();
    return;
  }

  state = move.action === "place"
    ? applyPlacement(state, move.to, move.placeType)
    : applyMove(state, move.from, move.to, { transformTo: move.transformTo });
  clearSelection();

  // AI may have a second move (push phase after action phase)
  if (!state.winner && state.currentPlayer === AI_PLAYER) {
    render();
    aiMoveTimer = window.setTimeout(() => {
      aiMoveTimer = null;
      performAIMove();
    }, AI_MOVE_DELAY_MS);
    return;
  }

  uiState.aiThinking = false;
  render();
}

function scheduleAIMove() {
  if (state.winner || state.currentPlayer !== AI_PLAYER) return;

  uiState.aiThinking = true;
  render();

  if (aiMoveTimer) window.clearTimeout(aiMoveTimer);
  aiMoveTimer = window.setTimeout(() => {
    aiMoveTimer = null;
    performAIMove();
  }, AI_MOVE_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleSquareClick(event) {
  const hexEl = event.target.closest("button[data-row][data-col]");

  if (
    !hexEl ||
    state.winner ||
    uiState.aiThinking ||
    uiState.transformChoicePending ||
    state.currentPlayer !== HUMAN_PLAYER
  ) {
    return;
  }

  const row = Number(hexEl.dataset.row);
  const col = Number(hexEl.dataset.col);
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
    let transformTo = null;

    if (targetMove.transform) {
      const targetPiece = state.board[row][col];
      uiState.transformChoicePending = true;
      render();
      transformTo = await openTransformOverlay(targetMove.transformOptions ?? [], state.currentPlayer, targetPiece);
      uiState.transformChoicePending = false;

      if (!transformTo) {
        render();
        return;
      }
    }

    state = applyMove(state, uiState.selectedSquare, { row, col }, { transformTo });
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

function handleReserveButtonClick(event) {
  const button = event.currentTarget;
  const pieceType = button.dataset.placeType;

  if (!pieceType || !Object.prototype.hasOwnProperty.call(PLACEMENT_LIMITS, pieceType)) return;

  if (
    state.winner ||
    uiState.aiThinking ||
    uiState.transformChoicePending ||
    state.currentPlayer !== HUMAN_PLAYER ||
    state.turnPhase === "push"
  ) {
    return;
  }

  const reserveLeft = getRemainingReserveCounts(state, HUMAN_PLAYER)[pieceType];
  if (reserveLeft <= 0) return;

  if (uiState.selectedPlacementType === pieceType) {
    clearSelection();
    render();
    return;
  }

  uiState.selectedPlacementType = pieceType;
  uiState.selectedSquare = null;
  uiState.selectedMoves = getLegalPlacements(state, HUMAN_PLAYER)
    .filter((p) => p.placeType === pieceType)
    .map((p) => ({ row: p.to.row, col: p.to.col, capture: false }));
  render();
}

function handleRestartClick() {
  if (aiMoveTimer) {
    window.clearTimeout(aiMoveTimer);
    aiMoveTimer = null;
  }

  cancelTransformOverlay();
  state = createInitialState();
  uiState.selectedSquare = null;
  uiState.selectedMoves = [];
  uiState.selectedPlacementType = null;
  uiState.aiThinking = false;
  uiState.transformChoicePending = false;
  render();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

BOARD_ELEMENT.addEventListener("click", handleSquareClick);
document.querySelector("#restart-button").addEventListener("click", handleRestartClick);
for (const button of RESERVE_BUTTONS) {
  button.addEventListener("click", handleReserveButtonClick);
}

render();