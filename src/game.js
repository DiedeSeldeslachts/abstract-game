export const BOARD_SIZE = 8;

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const KING_STEPS = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 }
];

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function createPieceCounters() {
  return {
    white: { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
    black: { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 }
  };
}

function makePiece(player, type, counters) {
  counters[player][type] += 1;

  return {
    id: `${player}-${type}-${counters[player][type]}`,
    player,
    type
  };
}

function getOpponent(player) {
  return player === "white" ? "black" : "white";
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function getLegalMovesForPlayer(state, row, col, player) {
  const piece = getPiece(state, row, col);

  if (!piece || piece.player !== player) {
    return [];
  }

  const moves = [];

  for (const step of KING_STEPS) {
    const nextRow = row + step.row;
    const nextCol = col + step.col;

    if (!isInsideBoard(nextRow, nextCol)) {
      continue;
    }

    const target = state.board[nextRow][nextCol];

    if (target && target.player === player) {
      continue;
    }

    moves.push({
      row: nextRow,
      col: nextCol,
      capture: Boolean(target)
    });
  }

  return moves;
}

export function createEmptyState(currentPlayer = "white") {
  return {
    board: createEmptyBoard(),
    currentPlayer,
    winner: null,
    moveNumber: 1,
    lastAction: null,
    capturedPieces: {
      white: [],
      black: []
    }
  };
}

export function createInitialState() {
  const state = createEmptyState("white");
  const counters = createPieceCounters();

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    state.board[0][col] = makePiece("black", BACK_RANK[col], counters);
    state.board[1][col] = makePiece("black", "pawn", counters);
    state.board[6][col] = makePiece("white", "pawn", counters);
    state.board[7][col] = makePiece("white", BACK_RANK[col], counters);
  }

  return state;
}

export function getPiece(state, row, col) {
  if (!isInsideBoard(row, col)) {
    return null;
  }

  return state.board[row][col];
}

export function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function getLegalMoves(state, row, col) {
  if (state.winner) {
    return [];
  }

  return getLegalMovesForPlayer(state, row, col, state.currentPlayer);
}

export function getAllLegalMoves(state, player = state.currentPlayer) {
  if (state.winner) {
    return [];
  }

  const allMoves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];

      if (!piece || piece.player !== player) {
        continue;
      }

      const moves = getLegalMovesForPlayer(state, row, col, player);

      for (const move of moves) {
        allMoves.push({
          from: { row, col },
          to: { row: move.row, col: move.col },
          capture: move.capture,
          piece
        });
      }
    }
  }

  return allMoves;
}

export function getRemainingPieceCounts(state) {
  const counts = { white: 0, black: 0 };

  for (const row of state.board) {
    for (const piece of row) {
      if (piece) {
        counts[piece.player] += 1;
      }
    }
  }

  return counts;
}

export function applyMove(state, from, to) {
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

  const nextState = {
    ...state,
    board: cloneBoard(state.board),
    moveNumber: state.moveNumber + 1,
    currentPlayer: getOpponent(state.currentPlayer),
    lastAction: null,
    capturedPieces: {
      white: [...state.capturedPieces.white],
      black: [...state.capturedPieces.black]
    }
  };

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
    capturedPiece
  };

  const remaining = getRemainingPieceCounts(nextState);
  const opponent = getOpponent(piece.player);

  if (remaining[opponent] === 0) {
    nextState.winner = piece.player;
  }

  return nextState;
}

export function toAlgebraic(square) {
  return `${FILES[square.col]}${BOARD_SIZE - square.row}`;
}