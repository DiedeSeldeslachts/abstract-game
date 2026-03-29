import {
  applyMove,
  createInitialState,
  getLegalMoves,
  getRemainingPieceCounts,
  toAlgebraic
} from "./game.js";

const PIECE_SYMBOLS = {
  white: {
    king: "♙",
    queen: "♙",
    rook: "♙",
    bishop: "♙",
    knight: "♙",
    pawn: "♙"
  },
  black: {
    king: "♟",
    queen: "♟",
    rook: "♟",
    bishop: "♟",
    knight: "♟",
    pawn: "♟"
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

let state = createInitialState();
let selectedSquare = null;
let selectedMoves = [];

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPieceName(piece) {
  return `${titleCase(piece.player)} ${piece.type}`;
}

function getSquareClasses(row, col) {
  const classes = ["square", (row + col) % 2 === 0 ? "light" : "dark"];

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

  return classes.join(" ");
}

function createCoordinateLabels(row, col) {
  const wrapper = document.createDocumentFragment();

  if (col === 0) {
    const rank = document.createElement("span");
    rank.className = "coord rank";
    rank.textContent = String(8 - row);
    wrapper.append(rank);
  }

  if (row === 7) {
    const file = document.createElement("span");
    file.className = "coord file";
    file.textContent = String.fromCharCode(97 + col);
    wrapper.append(file);
  }

  return wrapper;
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      const square = document.createElement("button");

      square.type = "button";
      square.className = getSquareClasses(row, col);
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      square.setAttribute("role", "gridcell");

      const pieceLabel = piece ? formatPieceName(piece) : "Empty square";
      square.setAttribute("aria-label", `${toAlgebraic({ row, col })}: ${pieceLabel}`);
      square.append(createCoordinateLabels(row, col));

      if (piece) {
        const glyph = document.createElement("span");
        glyph.className = `piece piece-${piece.player}`;
        glyph.textContent = PIECE_SYMBOLS[piece.player][piece.type];
        square.append(glyph);
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
    selectionTextElement.textContent = "Select one of the current player's pieces to reveal its adjacent legal moves.";
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

  lastActionTextElement.textContent = `${pieceName} moved from ${from} to ${to}.`;
}

function renderStatus() {
  statusTurnElement.textContent = titleCase(state.currentPlayer);

  if (state.winner) {
    statusTextElement.textContent = `${titleCase(state.winner)} wins by removing every opposing piece from the board.`;
    return;
  }

  if (selectedSquare) {
    const piece = state.board[selectedSquare.row][selectedSquare.col];
    statusTextElement.textContent = `${formatPieceName(piece)} is selected. Choose one highlighted adjacent square.`;
    return;
  }

  statusTextElement.textContent = `${titleCase(state.currentPlayer)} to move. Every piece moves one square in any direction.`;
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

function handleSquareClick(event) {
  const square = event.target.closest("button[data-row][data-col]");

  if (!square || state.winner) {
    return;
  }

  const row = Number(square.dataset.row);
  const col = Number(square.dataset.col);
  const targetMove = selectedMoves.find((move) => move.row === row && move.col === col);

  if (selectedSquare && targetMove) {
    state = applyMove(state, selectedSquare, { row, col });
    clearSelection();
    render();
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
  state = createInitialState();
  clearSelection();
  render();
}

boardElement.addEventListener("click", handleSquareClick);
restartButton.addEventListener("click", restartGame);

render();