/**
 * Rendering engine - DOM manipulation from game state.
 * Pure rendering: reads state, never mutates it.
 * All DOM references are cached at the top.
 */

import type { GameState, UIState, PlaceableType, Piece } from "./types.js";
import {
  BOARD_ROWS,
  BOARD_COLS,
  getRemainingPieceCounts,
  getRemainingReserveCounts,
  isInsideBoard,
  isCenterTile,
  isTownSquare,
  getTileColor,
  playerControlsBothTowns,
  toAlgebraic
} from "./game.js";

// ---------------------------------------------------------------------------
// DOM element cache – all DOM references live here
// ---------------------------------------------------------------------------

interface ElementCache {
  board: HTMLElement;
  gameModeSelect: HTMLSelectElement;
  statusTurn: HTMLElement;
  statusText: HTMLElement;
  selectionText: HTMLElement;
  lastActionText: HTMLElement;
  whiteRemaining: HTMLElement;
  blackRemaining: HTMLElement;
  whiteCaptures: HTMLElement;
  blackCaptures: HTMLElement;
  whiteReservePawn: HTMLElement;
  whiteReserveHorse: HTMLElement;
  whiteReserveSentinel: HTMLElement;
  blackReservePawn: HTMLElement;
  blackReserveHorse: HTMLElement;
  blackReserveSentinel: HTMLElement;
}

const ELEMENTS: ElementCache = {
  board: document.querySelector("#board")!,
  gameModeSelect: document.querySelector("#game-mode")!,
  statusTurn: document.querySelector("#status-turn")!,
  statusText: document.querySelector("#status-text")!,
  selectionText: document.querySelector("#selection-text")!,
  lastActionText: document.querySelector("#last-action-text")!,
  whiteRemaining: document.querySelector("#white-remaining")!,
  blackRemaining: document.querySelector("#black-remaining")!,
  whiteCaptures: document.querySelector("#white-captures")!,
  blackCaptures: document.querySelector("#black-captures")!,
  whiteReservePawn: document.querySelector("#white-reserve-pawn")!,
  whiteReserveHorse: document.querySelector("#white-reserve-horse")!,
  whiteReserveSentinel: document.querySelector("#white-reserve-sentinel")!,
  blackReservePawn: document.querySelector("#black-reserve-pawn")!,
  blackReserveHorse: document.querySelector("#black-reserve-horse")!,
  blackReserveSentinel: document.querySelector("#black-reserve-sentinel")!
};

/** Board element exported so the controller can attach event delegation. */
export const BOARD_ELEMENT = ELEMENTS.board;
export const GAME_MODE_SELECT = ELEMENTS.gameModeSelect;

/** Reserve buttons exported so the controller can attach event listeners. */
export const RESERVE_BUTTONS = Array.from(document.querySelectorAll("[data-place-type]"));

// ---------------------------------------------------------------------------
// Piece display constants
// ---------------------------------------------------------------------------

const PIECE_SYMBOLS = {
  white: { commander: "♔", horse: "♘", pawn: "♙", sentinel: "♖" },
  black: { commander: "♚", horse: "♞", pawn: "♟", sentinel: "♜" }
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatPieceName(piece: Piece): string {
  return `${titleCase(piece.player)} ${piece.type}`;
}

function isAIControlledPlayer(player: string, uiState: UIState): boolean {
  return uiState.gameMode === "vs-ai" && player === "black";
}

/**
 * Builds the CSS class string for a single hex button.
 */
function getHexClasses(row: number, col: number, gameState: GameState, uiState: UIState): string {
  const tileColor = getTileColor(gameState, row, col) ?? "unknown";
  const classes = ["hex", `tile-${tileColor}`];
  const { selectedSquare, selectedMoves } = uiState;

  if (selectedSquare?.row === row && selectedSquare?.col === col) {
    classes.push("is-selected");
  }

  const highlighted = selectedMoves.find((m) => m.row === row && m.col === col);
  if (highlighted) {
    classes.push(highlighted.push ? "is-push" : highlighted.capture ? "is-capture" : "is-target");
  }

  if (gameState.lastAction?.from?.row === row && gameState.lastAction?.from?.col === col) {
    classes.push("is-origin");
  }
  if (gameState.lastAction?.to?.row === row && gameState.lastAction?.to?.col === col) {
    classes.push("is-destination");
  }
  if (isTownSquare(row, col)) {
    classes.push("is-town");
  }

  if (isCenterTile(row, col)) {
    classes.push("is-center");
  }

  return classes.join(" ");
}

// ---------------------------------------------------------------------------
// Private section renderers
// ---------------------------------------------------------------------------

function renderBoard(gameState: GameState, uiState: UIState): void {
  ELEMENTS.board.innerHTML = "";

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";

    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (!isInsideBoard(row, col)) continue;

      const piece = gameState.board[row][col];
      const hex = document.createElement("button");
      hex.type = "button";
      hex.className = getHexClasses(row, col, gameState, uiState);
      hex.dataset.row = String(row);
      hex.dataset.col = String(col);
      hex.setAttribute("role", "gridcell");

      const isTown = isTownSquare(row, col);
      const isCenter = isCenterTile(row, col);
      const pieceLabel = piece
        ? formatPieceName(piece)
        : `Empty hex${isTown ? " (town)" : ""}${isCenter ? " (impassable)" : ""}`;
      hex.setAttribute("aria-label", `${toAlgebraic({ row, col })}: ${pieceLabel}`);

      if (piece) {
        const glyph = document.createElement("span");
        glyph.className = `piece piece-${piece.player} piece-${piece.type}`;
        glyph.textContent = PIECE_SYMBOLS[piece.player][piece.type];
        hex.append(glyph);
      } else if (isTown) {
        const marker = document.createElement("span");
        marker.className = "town-marker";
        marker.textContent = "⛩";
        hex.append(marker);
      } else if (isCenter) {
        const marker = document.createElement("span");
        marker.className = "center-marker";
        marker.textContent = "✦";
        hex.append(marker);
      }

      rowElement.append(hex);
    }

    if (rowElement.childElementCount > 0) {
      ELEMENTS.board.append(rowElement);
    }
  }
}

function renderStatus(gameState: GameState, uiState: UIState): void {
  const { selectedSquare, selectedPlacementType, aiThinking } = uiState;
  const currentPlayerIsAI = isAIControlledPlayer(gameState.currentPlayer, uiState);

  ELEMENTS.gameModeSelect.value = uiState.gameMode;

  ELEMENTS.statusTurn.textContent = currentPlayerIsAI
    ? `${titleCase(gameState.currentPlayer)} (AI)`
    : titleCase(gameState.currentPlayer);

  if (gameState.winner) {
    const reason = playerControlsBothTowns(gameState, gameState.winner)
      ? "controlling both towns"
      : "removing every opposing piece from the board";
    ELEMENTS.statusText.textContent = `${titleCase(gameState.winner)} wins by ${reason}.`;
    return;
  }

  if (aiThinking) {
    ELEMENTS.statusText.textContent = `${titleCase(gameState.currentPlayer)} is choosing a move...`;
    return;
  }

  if (selectedPlacementType) {
    ELEMENTS.statusText.textContent = `${titleCase(gameState.currentPlayer)} is placing a ${selectedPlacementType}. Placement is legal on empty non-town hexes only.`;
    return;
  }

  if (selectedSquare) {
    const piece = gameState.board[selectedSquare.row][selectedSquare.col];
    ELEMENTS.statusText.textContent = `${formatPieceName(piece!)} is selected. Choose one highlighted legal destination.`;
    return;
  }

  if (gameState.turnPhase === "push") {
    ELEMENTS.statusText.textContent = `${titleCase(gameState.currentPlayer)}'s 2nd move: move a piece or push an enemy piece away (no captures).`;
    return;
  }

  ELEMENTS.statusText.textContent = `${titleCase(gameState.currentPlayer)} to act. 1st move: move or capture, or place a reserve piece. 2nd move will follow.`;
}

function renderSidebar(gameState: GameState, uiState: UIState): void {
  const { selectedSquare, selectedMoves, selectedPlacementType } = uiState;
  const counts = getRemainingPieceCounts(gameState);

  ELEMENTS.whiteRemaining.textContent = String(counts.white);
  ELEMENTS.blackRemaining.textContent = String(counts.black);
  ELEMENTS.whiteCaptures.textContent = String(gameState.capturedPieces.white.length);
  ELEMENTS.blackCaptures.textContent = String(gameState.capturedPieces.black.length);

  if (selectedPlacementType) {
    const reserveLeft =
      getRemainingReserveCounts(gameState, gameState.currentPlayer)[selectedPlacementType];
    ELEMENTS.selectionText.textContent = `${titleCase(gameState.currentPlayer)} is placing ${selectedPlacementType}. Select any highlighted non-town hex. ${reserveLeft} remaining.`;
  } else if (selectedSquare) {
    const piece = gameState.board[selectedSquare.row][selectedSquare.col];
    const total = selectedMoves.length;
    const pushes = selectedMoves.filter((m) => m.push).length;
    const nonPushes = total - pushes;
    const phaseHint =
      gameState.turnPhase === "push"
        ? ` (${pushes} push${pushes === 1 ? "" : "es"}, ${nonPushes} move${nonPushes === 1 ? "" : "s"})`
        : "";
    ELEMENTS.selectionText.textContent = `${formatPieceName(piece!)} on ${toAlgebraic(selectedSquare)} has ${total} legal ${total === 1 ? "move" : "moves"}${phaseHint}.`;
  } else if (gameState.turnPhase === "push") {
    ELEMENTS.selectionText.textContent =
      "2nd move: select a piece to move it or push an enemy piece away. No captures allowed.";
  } else {
    ELEMENTS.selectionText.textContent =
      "Choose to move a piece or place one reserve unit, then select a legal target hex.";
  }

  renderLastAction(gameState);
}

function renderLastAction(gameState: GameState): void {
  const action = gameState.lastAction;

  if (!action) {
    ELEMENTS.lastActionText.textContent = "No moves yet.";
    return;
  }

  if (action.kind === "pass") {
    ELEMENTS.lastActionText.textContent = `${titleCase(action.player)} passed the 2nd move.`;
    return;
  }

  const pieceName = formatPieceName(action.piece!);
  const to = toAlgebraic(action.to!);

  if (action.kind === "place") {
    ELEMENTS.lastActionText.textContent = `${pieceName} was placed on ${to}.`;
    return;
  }

  const from = toAlgebraic(action.from!);

  if (action.kind === "push") {
    ELEMENTS.lastActionText.textContent = `${pieceName} pushed ${formatPieceName(action.pushedPiece)} from ${to} to ${toAlgebraic(action.pushTo)}.`;
    return;
  }

  if (action.capturedPiece) {
    ELEMENTS.lastActionText.textContent = `${pieceName} captured ${formatPieceName(action.capturedPiece)} from ${from} to ${to}.`;
    return;
  }

  ELEMENTS.lastActionText.textContent = `${pieceName} moved from ${from} to ${to}.`;
}

function renderReservePanel(gameState: GameState, uiState: UIState): void {
  const { selectedPlacementType, aiThinking } = uiState;
  const white = getRemainingReserveCounts(gameState, "white");
  const black = getRemainingReserveCounts(gameState, "black");

  ELEMENTS.whiteReservePawn.textContent = String(white.pawn);
  ELEMENTS.whiteReserveHorse.textContent = String(white.horse);
  ELEMENTS.whiteReserveSentinel.textContent = String(white.sentinel);
  ELEMENTS.blackReservePawn.textContent = String(black.pawn);
  ELEMENTS.blackReserveHorse.textContent = String(black.horse);
  ELEMENTS.blackReserveSentinel.textContent = String(black.sentinel);

  const buttonsBlocked =
    gameState.winner !== null ||
    aiThinking ||
    isAIControlledPlayer(gameState.currentPlayer, uiState) ||
    gameState.turnPhase === "push";

  for (const button of RESERVE_BUTTONS) {
    const pieceType = button.getAttribute("data-place-type") as unknown as PlaceableType;
    const reserveLeft = getRemainingReserveCounts(gameState, gameState.currentPlayer)[pieceType];
    button.classList.toggle("is-active", selectedPlacementType === pieceType);
    (button as HTMLButtonElement).disabled = buttonsBlocked || reserveLeft <= 0;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Performs a full re-render of all game UI.
 * Call this after any change to game state or UI state.
 */
export function renderGame(gameState: GameState, uiState: UIState): void {
  renderStatus(gameState, uiState);
  renderBoard(gameState, uiState);
  renderSidebar(gameState, uiState);
  renderReservePanel(gameState, uiState);
}
