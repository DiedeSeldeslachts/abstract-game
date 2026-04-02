# Agent Instructions

You are creating an abstract strategy game.
This game includes an AI you can play against; if the game rules are changed, the AI should be changed accordingly.

## General File Creation Guidelines

When creating new files:

- **Always use LF (Unix-style) line endings**, not CRLF (Windows-style)
- This repository uses `.gitattributes` to enforce LF line endings
- Ensures consistency across all platforms and avoids Git warnings


## Project Map

### Entry Points
| File | Role |
|---|---|
| `index.html` | Shell: board DOM, status panels, reserve buttons, transform overlay |
| `styles.css` | All visual styling — layout, board, pieces, UI panels |
| `package.json` | TypeScript scripts: `npm run build` compiles with `tsc`; `npm test` runs compiled tests; `npm run serve` builds then serves on :8080 |

### Source Files (`src/`)
| File | Role | What to find here |
|---|---|---|
| `src/game.ts` | **Pure game logic** — no DOM, no side effects | Board constants, piece types, legal move generation (`getLegalMoves`, `getAllLegalMoves`), `applyMove`, `applyPlacement`, `applyPassPush`, `createInitialState`, win detection (`playerControlsBothTowns`), coordinate helpers (`toAxial`, `toAlgebraic`) |
| `src/main.ts` | **Controller** — wires game.ts + renderer.ts + ai.ts | `uiState`, event handlers (click, reserve buttons, restart), AI timer, human/AI player constants (`HUMAN_PLAYER`, `AI_PLAYER`), turn flow |
| `src/renderer.ts` | **DOM rendering** — reads state, never writes it | `renderGame()`, `BOARD_ELEMENT`, `RESERVE_BUTTONS`, transform overlay helpers; all DOM queries live in the `ELEMENTS` cache at the top |
| `src/ai.ts` | **AI opponent** — pure scoring, no DOM | `chooseAIMove()`, piece/position scoring weights, heuristic constants at the top of the file |
| `src/types.ts` | **Shared TypeScript types** — game and UI contracts | Piece, move, state, and helper type definitions shared across modules |

### Rules & Tests
| File | Role |
|---|---|
| `rules/rules.md` | Authoritative written rules — always update before changing game logic |
| `tests/game.test.ts` | TypeScript tests for core game.ts functions (compiled before execution) |

### Key Constants (all in `src/game.ts`)
- `BOARD_ROWS / BOARD_COLS / HEX_RADIUS` — board dimensions (9×9, radius 4)
- `TOWN_POSITIONS` — `[{row:4,col:2}, {row:4,col:6}]` → c5 (white start) and g5 (black start)
- `CENTER_POSITION` — `{row:4,col:4}` → e5
- `PLACEMENT_LIMITS` — reserve caps per piece type
- `UNIT_TYPES / PLACEABLE_TYPES` — valid piece type strings

### Where to Look for Specific Changes
| Goal | Start here |
|---|---|
| Change move rules or legal move logic | `src/game.ts` → `getLegalMoves` / `getAllLegalMoves` |
| Change win condition | `src/game.ts` → `playerControlsBothTowns` |
| Add/remove a piece type | `src/game.ts` constants → `src/renderer.ts` (rendering) → `src/ai.ts` (scoring) |
| Tune AI behavior or scoring | `src/ai.ts` — constants at the top, `chooseAIMove` at the bottom |
| Change UI layout or visuals | `index.html` + `styles.css` |
| Change how the board is drawn | `src/renderer.ts` → `renderGame` |
| Change turn flow or player interaction | `src/main.ts` |
| Update written rules | `rules/rules.md` (use `game-rules-manager` skill) |

### Build / Run
- Build step required: `npm run build` compiles TypeScript to `dist/` with `tsc`.
- Dev server: `npm run serve` (runs build first) → http://localhost:8080
- Tests: `npm test` (runs build first, then executes `dist/tests/game.test.js` with Node)