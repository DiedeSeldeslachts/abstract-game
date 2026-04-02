import {
  applyPlacement,
  applyMove,
  BOARD_COLS,
  BOARD_ROWS,
  createInitialState,
  getLegalPlacements,
  getLegalMoves,
  getRemainingReserveCounts,
  getRemainingPieceCounts,
  isInsideBoard,
  isTownSquare,
  PLACEMENT_LIMITS,
  playerControlsBothTowns,
  toAlgebraic
} from "./game.js";
import { chooseAIMove } from "./ai.js";

const HUMAN_PLAYER = "white";
const AI_PLAYER = "black";
const AI_MOVE_DELAY_MS = 320;

const PIECE_SYMBOLS = {
  white: {
    commander: "♔",
    horse: "♘",
    pawn: "♙",
    sentinel: "♖",
    teacher: "♗"
  },
  black: {
    commander: "♚",
    horse: "♞",
    pawn: "♟",
    sentinel: "♜",
    teacher: "♝"
  }
};

const boardElement = document.querySelector("#board");
const statusTurnElement = document.querySelector("#status-turn");
const statusTextElement = document.querySelector("#status-text");
const selectionTextElement = document.querySelector("#selection-text");
const lastActionTextElement = document.querySelector("#last-action-text");
const whiteRemainingElement = document.querySelector("#white-remaining");
const blackRemainingElement = document.querySelector("#black-remaining");
const whiteCapturesElement = document.querySelector("#white-captures");
const blackCapturesElement = document.querySelector("#black-captures");
const reserveButtons = Array.from(document.querySelectorAll("[data-place-type]"));
const whiteReservePawnElement = document.querySelector("#white-reserve-pawn");
const whiteReserveHorseElement = document.querySelector("#white-reserve-horse");
const whiteReserveSentinelElement = document.querySelector("#white-reserve-sentinel");
const whiteReserveTeacherElement = document.querySelector("#white-reserve-teacher");
const blackReservePawnElement = document.querySelector("#black-reserve-pawn");
const blackReserveHorseElement = document.querySelector("#black-reserve-horse");
const blackReserveSentinelElement = document.querySelector("#black-reserve-sentinel");
const blackReserveTeacherElement = document.querySelector("#black-reserve-teacher");
const restartButton = document.querySelector("#restart-button");
const transformOverlayElement = document.querySelector("#transform-overlay");
const transformTitleElement = document.querySelector("#transform-overlay-title");
const transformPromptElement = document.querySelector("#transform-overlay-prompt");
const transformOptionsElement = document.querySelector("#transform-options");
const transformCancelButton = document.querySelector("#transform-cancel");

let state = createInitialState();
let selectedSquare = null;
let selectedMoves = [];
let selectedPlacementType = null;
let aiThinking = false;
let aiMoveTimer = null;
let transformChoiceResolver = null;
let transformChoicePending = false;

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPieceName(piece) {
  return `${titleCase(piece.player)} ${piece.type}`;
}

function getSquareClasses(row, col) {
  const classes = ["hex", (row + col) % 2 === 0 ? "light" : "dark"];

  if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
    classes.push("is-selected");
  }

  const move = selectedMoves.find((candidate) => candidate.row === row && candidate.col === col);

  if (move) {
    classes.push(move.capture ? "is-capture" : "is-target");
  }

  if (state.lastAction?.from?.row === row && state.lastAction?.from?.col === col) {
    classes.push("is-origin");
  }

  if (state.lastAction?.to?.row === row && state.lastAction?.to?.col === col) {
    classes.push("is-destination");
  }

  if (isTownSquare(row, col)) {
    classes.push("is-town");
  }

  return classes.join(" ");
}

function createCoordinateLabels(row, col) {
  return document.createDocumentFragment();
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";

    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (!isInsideBoard(row, col)) {
        continue;
      }

      const piece = state.board[row][col];
      const square = document.createElement("button");

      square.type = "button";
      square.className = getSquareClasses(row, col);
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      square.setAttribute("role", "gridcell");

      const isTown = isTownSquare(row, col);
      const townLabel = isTown ? " (town)" : "";
      const pieceLabel = piece ? formatPieceName(piece) : `Empty hex${townLabel}`;
      square.setAttribute("aria-label", `${toAlgebraic({ row, col })}: ${pieceLabel}`);
      square.append(createCoordinateLabels(row, col));

      if (piece) {
        const glyph = document.createElement("span");
        glyph.className = `piece piece-${piece.player} piece-${piece.type}`;
        glyph.textContent = PIECE_SYMBOLS[piece.player][piece.type];
        square.append(glyph);
      } else if (isTown) {
        const townMarker = document.createElement("span");
        townMarker.className = "town-marker";
        townMarker.textContent = "⛩";
        square.append(townMarker);
      }

      rowElement.append(square);
    }

    if (rowElement.childElementCount > 0) {
      boardElement.append(rowElement);
    }
  }
}

function renderSidebar() {
  const counts = getRemainingPieceCounts(state);

  whiteRemainingElement.textContent = String(counts.white);
  blackRemainingElement.textContent = String(counts.black);
  whiteCapturesElement.textContent = String(state.capturedPieces.white.length);
  blackCapturesElement.textContent = String(state.capturedPieces.black.length);

  if (selectedPlacementType) {
    const reserveLeft = getRemainingReserveCounts(state, state.currentPlayer)[selectedPlacementType];
    selectionTextElement.textContent = `${titleCase(state.currentPlayer)} is placing ${selectedPlacementType}. Select any highlighted non-town hex. ${reserveLeft} remaining.`;
  } else if (selectedSquare) {
    const piece = state.board[selectedSquare.row][selectedSquare.col];
    const moveCount = selectedMoves.length;
    selectionTextElement.textContent = `${formatPieceName(piece)} on ${toAlgebraic(selectedSquare)} has ${moveCount} legal ${moveCount === 1 ? "move" : "moves"}.`;
  } else {
    selectionTextElement.textContent = "Choose to move a piece or place one reserve unit, then select a legal target hex.";
  }

  if (!state.lastAction) {
    lastActionTextElement.textContent = "No moves yet.";
    return;
  }

  const pieceName = formatPieceName(state.lastAction.piece);
  const to = toAlgebraic(state.lastAction.to);

  if (state.lastAction.kind === "place") {
    lastActionTextElement.textContent = `${pieceName} was placed on ${to}.`;
    return;
  }

  const from = toAlgebraic(state.lastAction.from);

  if (state.lastAction.capturedPiece) {
    lastActionTextElement.textContent = `${pieceName} captured ${formatPieceName(state.lastAction.capturedPiece)} from ${from} to ${to}.`;
    return;
  }

  if (state.lastAction.kind === "transform") {
    lastActionTextElement.textContent = `${pieceName} transformed ${titleCase(state.lastAction.player)} ${state.lastAction.transformedFrom} on ${to} into ${state.lastAction.transformedTo}.`;
    return;
  }

  lastActionTextElement.textContent = `${pieceName} moved from ${from} to ${to}.`;
}

function renderReservePanel() {
  const whiteReserve = getRemainingReserveCounts(state, "white");
  const blackReserve = getRemainingReserveCounts(state, "black");

  whiteReservePawnElement.textContent = String(whiteReserve.pawn);
  whiteReserveHorseElement.textContent = String(whiteReserve.horse);
  whiteReserveSentinelElement.textContent = String(whiteReserve.sentinel);
  whiteReserveTeacherElement.textContent = String(whiteReserve.teacher);
  blackReservePawnElement.textContent = String(blackReserve.pawn);
  blackReserveHorseElement.textContent = String(blackReserve.horse);
  blackReserveSentinelElement.textContent = String(blackReserve.sentinel);
  blackReserveTeacherElement.textContent = String(blackReserve.teacher);

  for (const button of reserveButtons) {
    const pieceType = button.dataset.placeType;
    const reserveLeft = getRemainingReserveCounts(state, HUMAN_PLAYER)[pieceType];
    const isActive = selectedPlacementType === pieceType;
    button.classList.toggle("is-active", isActive);
    button.disabled =
      state.winner !== null ||
      aiThinking ||
      transformChoicePending ||
      state.currentPlayer !== HUMAN_PLAYER ||
      reserveLeft <= 0;
  }
}

function renderStatus() {
  statusTurnElement.textContent =
    state.currentPlayer === AI_PLAYER
      ? `${titleCase(state.currentPlayer)} (AI)`
      : titleCase(state.currentPlayer);

  if (state.winner) {
    const winReason = playerControlsBothTowns(state, state.winner)
      ? "controlling both towns"
      : "removing every opposing piece from the board";
    statusTextElement.textContent = `${titleCase(state.winner)} wins by ${winReason}.`;
    return;
  }

  if (aiThinking) {
    statusTextElement.textContent = `${titleCase(AI_PLAYER)} is choosing a move...`;
    return;
  }

  if (selectedPlacementType) {
    statusTextElement.textContent = `${titleCase(HUMAN_PLAYER)} is placing a ${selectedPlacementType}. Placement is legal on empty non-town hexes only.`;
    return;
  }

  if (selectedSquare) {
    const piece = state.board[selectedSquare.row][selectedSquare.col];
    statusTextElement.textContent = `${formatPieceName(piece)} is selected. Choose one highlighted legal destination.`;
    return;
  }

  statusTextElement.textContent = `${titleCase(state.currentPlayer)} to act. On each turn, either move an existing piece or place one reserve piece onto any empty non-town hex. Hold both towns for one full round to win.`;
}

function render() {
  renderStatus();
  renderBoard();
  renderSidebar();
  renderReservePanel();
}

function clearSelection() {
  selectedSquare = null;
  selectedMoves = [];
  selectedPlacementType = null;
}

function closeTransformOverlay(result = null) {
  if (!transformChoicePending || !transformChoiceResolver) {
    return;
  }

  transformChoicePending = false;
  transformOverlayElement.classList.remove("is-open");
  transformOverlayElement.setAttribute("aria-hidden", "true");
  transformOptionsElement.innerHTML = "";

  const resolver = transformChoiceResolver;
  transformChoiceResolver = null;
  resolver(result);
}

function openTransformOverlay(move, targetPiece) {
  const options = move.transformOptions ?? [];

  if (options.length === 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    transformChoicePending = true;
    transformChoiceResolver = resolve;

    transformOverlayElement.classList.add("is-open");
    transformOverlayElement.setAttribute("aria-hidden", "false");
    transformOptionsElement.innerHTML = "";

    if (targetPiece) {
      transformTitleElement.textContent = `Transform ${titleCase(targetPiece.player)} ${targetPiece.type}`;
      transformPromptElement.textContent = "Choose the new piece type.";
    } else {
      transformTitleElement.textContent = "Choose transform target";
      transformPromptElement.textContent = "Choose the new piece type.";
    }

    for (const option of options) {
      const optionButton = document.createElement("button");
      const glyph = PIECE_SYMBOLS[state.currentPlayer][option];

      optionButton.type = "button";
      optionButton.className = "transform-option";
      optionButton.setAttribute("aria-label", `Transform into ${option}`);
      optionButton.innerHTML = `<span class="transform-glyph">${glyph}</span><span class="transform-label">${titleCase(option)}</span>`;
      optionButton.addEventListener("click", () => closeTransformOverlay(option));
      transformOptionsElement.append(optionButton);
    }

    const firstOption = transformOptionsElement.querySelector(".transform-option");
    if (firstOption) {
      firstOption.focus();
    }
  });
}

function performAIMove() {
  if (state.winner || state.currentPlayer !== AI_PLAYER) {
    aiThinking = false;
    render();
    return;
  }

  const move = chooseAIMove(state, AI_PLAYER);
  aiThinking = false;

  if (!move) {
    render();
    return;
  }

  state =
    move.action === "place"
      ? applyPlacement(state, move.to, move.placeType)
      : applyMove(state, move.from, move.to, { transformTo: move.transformTo });
  clearSelection();
  render();
}

function chooseTransformType(move, targetPiece) {
  return openTransformOverlay(move, targetPiece);
}

function scheduleAIMove() {
  if (state.winner || state.currentPlayer !== AI_PLAYER) {
    return;
  }

  aiThinking = true;
  render();

  if (aiMoveTimer) {
    window.clearTimeout(aiMoveTimer);
  }

  aiMoveTimer = window.setTimeout(() => {
    aiMoveTimer = null;
    performAIMove();
  }, AI_MOVE_DELAY_MS);
}

async function handleSquareClick(event) {
  const square = event.target.closest("button[data-row][data-col]");

  if (!square || state.winner || aiThinking || transformChoicePending || state.currentPlayer !== HUMAN_PLAYER) {
    return;
  }

  const row = Number(square.dataset.row);
  const col = Number(square.dataset.col);
  const targetMove = selectedMoves.find((move) => move.row === row && move.col === col);

  if (selectedPlacementType) {
    if (targetMove) {
      state = applyPlacement(state, { row, col }, selectedPlacementType);
      clearSelection();
      render();

      if (!state.winner) {
        scheduleAIMove();
      }
    }

    return;
  }

  if (selectedSquare && targetMove) {
    let transformTo = null;

    if (targetMove.transform) {
      const targetPiece = state.board[row][col];
      transformTo = await chooseTransformType(targetMove, targetPiece);

      if (!transformTo) {
        render();
        return;
      }
    }

    state = applyMove(state, selectedSquare, { row, col }, { transformTo });
    clearSelection();
    render();

    if (!state.winner) {
      scheduleAIMove();
    }

    return;
  }

  const piece = state.board[row][col];

  if (piece && piece.player === state.currentPlayer) {
    selectedSquare = { row, col };
    selectedMoves = getLegalMoves(state, row, col);
  } else {
    clearSelection();
  }

  render();
}

function selectPlacementType(pieceType) {
  if (state.winner || aiThinking || transformChoicePending || state.currentPlayer !== HUMAN_PLAYER) {
    return;
  }

  const reserveLeft = getRemainingReserveCounts(state, HUMAN_PLAYER)[pieceType];

  if (reserveLeft <= 0) {
    return;
  }

  if (selectedPlacementType === pieceType) {
    clearSelection();
    render();
    return;
  }

  selectedPlacementType = pieceType;
  selectedSquare = null;
  selectedMoves = getLegalPlacements(state, HUMAN_PLAYER)
    .filter((placement) => placement.placeType === pieceType)
    .map((placement) => ({ row: placement.to.row, col: placement.to.col, capture: false }));

  render();
}

function restartGame() {
  if (aiMoveTimer) {
    window.clearTimeout(aiMoveTimer);
    aiMoveTimer = null;
  }

  aiThinking = false;
  if (transformChoicePending) {
    closeTransformOverlay(null);
  }
  state = createInitialState();
  clearSelection();
  render();
}

transformCancelButton.addEventListener("click", () => closeTransformOverlay(null));

transformOverlayElement.addEventListener("click", (event) => {
  if (event.target === transformOverlayElement) {
    closeTransformOverlay(null);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && transformChoicePending) {
    event.preventDefault();
    closeTransformOverlay(null);
  }
});

boardElement.addEventListener("click", handleSquareClick);
restartButton.addEventListener("click", restartGame);
for (const button of reserveButtons) {
  button.addEventListener("click", () => {
    const pieceType = button.dataset.placeType;

    if (pieceType && Object.prototype.hasOwnProperty.call(PLACEMENT_LIMITS, pieceType)) {
      selectPlacementType(pieceType);
    }
  });
}

render();