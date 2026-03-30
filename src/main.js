import {
  applyMove,
  BOARD_COLS,
  BOARD_ROWS,
  createInitialState,
  getLegalMoves,
  getRemainingPieceCounts,
  isTownSquare,
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
    pawn: "♙",
    sentinel: "♖",
    teacher: "♗"
  },
  black: {
    commander: "♚",
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
const restartButton = document.querySelector("#restart-button");
const transformOverlayElement = document.querySelector("#transform-overlay");
const transformTitleElement = document.querySelector("#transform-overlay-title");
const transformPromptElement = document.querySelector("#transform-overlay-prompt");
const transformOptionsElement = document.querySelector("#transform-options");
const transformCancelButton = document.querySelector("#transform-cancel");

let state = createInitialState();
let selectedSquare = null;
let selectedMoves = [];
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

function isInsideSentinelShield(row, col, sentinelRow, sentinelCol) {
  return Math.max(Math.abs(row - sentinelRow), Math.abs(col - sentinelCol)) <= 1;
}

function getSentinelShieldSquares(gameState) {
  const squares = new Set();

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const piece = gameState.board[row][col];

      if (!piece || piece.type !== "sentinel") {
        continue;
      }

      for (let shieldRow = row - 1; shieldRow <= row + 1; shieldRow += 1) {
        for (let shieldCol = col - 1; shieldCol <= col + 1; shieldCol += 1) {
          if (
            shieldRow >= 0 &&
            shieldRow < BOARD_ROWS &&
            shieldCol >= 0 &&
            shieldCol < BOARD_COLS &&
            isInsideSentinelShield(shieldRow, shieldCol, row, col)
          ) {
            squares.add(`${shieldRow},${shieldCol}`);
          }
        }
      }
    }
  }

  return squares;
}

function getSquareClasses(row, col, sentinelShieldSquares) {
  const classes = ["square", (row + col) % 2 === 0 ? "light" : "dark"];

  if (sentinelShieldSquares.has(`${row},${col}`)) {
    classes.push("is-sentinel-shield");
  }

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
  const wrapper = document.createDocumentFragment();

  if (col === 0) {
    const rank = document.createElement("span");
    rank.className = "coord rank";
    rank.textContent = String(BOARD_ROWS - row);
    wrapper.append(rank);
  }

  if (row === BOARD_ROWS - 1) {
    const file = document.createElement("span");
    file.className = "coord file";
    file.textContent = String.fromCharCode(97 + col);
    wrapper.append(file);
  }

  return wrapper;
}

function renderBoard() {
  boardElement.innerHTML = "";
  const sentinelShieldSquares = getSentinelShieldSquares(state);

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const piece = state.board[row][col];
      const square = document.createElement("button");

      square.type = "button";
      square.className = getSquareClasses(row, col, sentinelShieldSquares);
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      square.setAttribute("role", "gridcell");

      const isTown = isTownSquare(row, col);
      const townLabel = isTown ? " (town)" : "";
      const pieceLabel = piece ? formatPieceName(piece) : `Empty square${townLabel}`;
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

      boardElement.append(square);
    }
  }
}

function renderSidebar() {
  const counts = getRemainingPieceCounts(state);

  whiteRemainingElement.textContent = String(counts.white);
  blackRemainingElement.textContent = String(counts.black);
  whiteCapturesElement.textContent = String(state.capturedPieces.white.length);
  blackCapturesElement.textContent = String(state.capturedPieces.black.length);

  if (selectedSquare) {
    const piece = state.board[selectedSquare.row][selectedSquare.col];
    const moveCount = selectedMoves.length;
    selectionTextElement.textContent = `${formatPieceName(piece)} on ${toAlgebraic(selectedSquare)} has ${moveCount} legal ${moveCount === 1 ? "move" : "moves"}.`;
  } else {
    selectionTextElement.textContent = "Select one of the current player's pieces to reveal its legal moves.";
  }

  if (!state.lastAction) {
    lastActionTextElement.textContent = "No moves yet.";
    return;
  }

  const pieceName = formatPieceName(state.lastAction.piece);
  const from = toAlgebraic(state.lastAction.from);
  const to = toAlgebraic(state.lastAction.to);

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

  if (selectedSquare) {
    const piece = state.board[selectedSquare.row][selectedSquare.col];
    statusTextElement.textContent = `${formatPieceName(piece)} is selected. Choose one highlighted legal destination.`;
    return;
  }

  statusTextElement.textContent = `${titleCase(state.currentPlayer)} to move. Most pieces move one square; pawns adjacent to a commander can hop over friendly pieces. Teachers can transform friendly units into any non-Teacher piece. Sentinels project a 1-tile shield enemies cannot enter or leave. Hold both towns for one full round to win!`;
}

function render() {
  renderStatus();
  renderBoard();
  renderSidebar();
}

function clearSelection() {
  selectedSquare = null;
  selectedMoves = [];
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

  state = applyMove(state, move.from, move.to, { transformTo: move.transformTo });
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

render();