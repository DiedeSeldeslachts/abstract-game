export const BOARD_ROWS = 9;
export const BOARD_COLS = 8;

const BACK_RANK = ["pawn", "pawn", "commander", "pawn", "pawn", "commander", "pawn", "pawn"];
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const TOWN_POSITIONS = [
  { row: 4, col: 2 }, // c5
  { row: 4, col: 5 }  // f5
];
const UNIT_TYPES = ["commander", "pawn"];
const ADJACENT_STEPS = [
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
  return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null));
}

function createPlayerPieceCounter() {
  return Object.fromEntries(UNIT_TYPES.map((type) => [type, 0]));
}

function createPieceCounters() {
  return {
    white: createPlayerPieceCounter(),
    black: createPlayerPieceCounter()
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

function getSingleStepMovesForPlayer(state, row, col, player) {
  const moves = [];

  for (const step of ADJACENT_STEPS) {
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

function hasAdjacentFriendlyCommander(state, row, col, player) {
  for (const step of ADJACENT_STEPS) {
    const commanderRow = row + step.row;
    const commanderCol = col + step.col;

    if (!isInsideBoard(commanderRow, commanderCol)) {
      continue;
    }

    const adjacentPiece = state.board[commanderRow][commanderCol];

    if (adjacentPiece && adjacentPiece.player === player && adjacentPiece.type === "commander") {
      return true;
    }
  }

  return false;
}

function getCommanderAuraHopMovesForPawn(state, row, col, player) {
  if (!hasAdjacentFriendlyCommander(state, row, col, player)) {
    return [];
  }

  const moves = [];

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

    if (!isInsideBoard(landingRow, landingCol)) {
      continue;
    }

    const target = state.board[landingRow][landingCol];

    if (target && target.player === player) {
      continue;
    }

    moves.push({
      row: landingRow,
      col: landingCol,
      capture: Boolean(target)
    });
  }

  return moves;
}

function getLegalMovesForPlayer(state, row, col, player) {
  const piece = getPiece(state, row, col);

  if (!piece || piece.player !== player) {
    return [];
  }

  if (piece.type === "commander") {
    return getSingleStepMovesForPlayer(state, row, col, player);
  }

  const movesBySquare = new Map();

  for (const move of getSingleStepMovesForPlayer(state, row, col, player)) {
    movesBySquare.set(`${move.row},${move.col}`, move);
  }

  for (const move of getCommanderAuraHopMovesForPawn(state, row, col, player)) {
    movesBySquare.set(`${move.row},${move.col}`, move);
  }

  return Array.from(movesBySquare.values());
}

export function createEmptyState(currentPlayer = "white") {
  return {
    board: createEmptyBoard(),
    currentPlayer,
    winner: null,
    moveNumber: 1,
    townControlPendingPlayer: null,
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

  for (let col = 0; col < BOARD_COLS; col += 1) {
    state.board[0][col] = makePiece("white", BACK_RANK[col], counters);
    state.board[1][col] = makePiece("white", "pawn", counters);
    state.board[7][col] = makePiece("black", "pawn", counters);
    state.board[8][col] = makePiece("black", BACK_RANK[col], counters);
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
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
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

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
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

export function playerControlsBothTowns(state, player) {
  for (const townPos of TOWN_POSITIONS) {
    const piece = state.board[townPos.row][townPos.col];
    if (!piece || piece.player !== player) {
      return false;
    }
  }
  return true;
}

export function isTownSquare(row, col) {
  return TOWN_POSITIONS.some((town) => town.row === row && town.col === col);
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
    townControlPendingPlayer: state.townControlPendingPlayer,
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

  // A town victory triggers at the start of a player's turn if they still control both towns.
  if (
    !nextState.winner &&
    state.townControlPendingPlayer === nextState.currentPlayer &&
    playerControlsBothTowns(nextState, nextState.currentPlayer)
  ) {
    nextState.winner = nextState.currentPlayer;
  }

  nextState.townControlPendingPlayer = playerControlsBothTowns(nextState, piece.player)
    ? piece.player
    : null;

  return nextState;
}

export function toAlgebraic(square) {
  return `${FILES[square.col]}${BOARD_ROWS - square.row}`;
}