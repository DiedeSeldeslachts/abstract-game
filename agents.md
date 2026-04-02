# Agent Instructions

You are creating an abstract strategy game.
This game includes an AI you can play agains, if the game rules are changed, the AI should be changed accordingly

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
| `package.json` | `npm test` runs `tests/game.test.js`; `npm run serve` starts dev server on :8080 |

### Source Files (`src/`)
| File | Role | What to find here |
|---|---|---|
| `src/game.js` | **Pure game logic** — no DOM, no side effects | Board constants, piece types, legal move generation (`getLegalMoves`, `getAllLegalMoves`), `applyMove`, `applyPlacement`, `applyPassPush`, `createInitialState`, win detection (`playerControlsBothTowns`), coordinate helpers (`toAxial`, `toAlgebraic`) |
| `src/main.js` | **Controller** — wires game.js + renderer.js + ai.js | `uiState`, event handlers (click, reserve buttons, restart), AI timer, human/AI player constants (`HUMAN_PLAYER`, `AI_PLAYER`), turn flow |
| `src/renderer.js` | **DOM rendering** — reads state, never writes it | `renderGame()`, `BOARD_ELEMENT`, `RESERVE_BUTTONS`, transform overlay helpers; all DOM queries live in the `ELEMENTS` cache at the top |
| `src/ai.js` | **AI opponent** — pure scoring, no DOM | `chooseAIMove()`, piece/position scoring weights, heuristic constants at the top of the file |

### Rules & Tests
| File | Role |
|---|---|
| `rules/rules.md` | Authoritative written rules — always update before changing game logic |
| `tests/game.test.js` | Node-based tests for core game.js functions |

### Key Constants (all in `src/game.js`)
- `BOARD_ROWS / BOARD_COLS / HEX_RADIUS` — board dimensions (9×9, radius 4)
- `TOWN_POSITIONS` — `[{row:4,col:2}, {row:4,col:6}]` → c5 (white start) and g5 (black start)
- `CENTER_POSITION` — `{row:4,col:4}` → e5
- `PLACEMENT_LIMITS` — reserve caps per piece type
- `UNIT_TYPES / PLACEABLE_TYPES` — valid piece type strings

### Where to Look for Specific Changes
| Goal | Start here |
|---|---|
| Change move rules or legal move logic | `src/game.js` → `getLegalMoves` / `getAllLegalMoves` |
| Change win condition | `src/game.js` → `playerControlsBothTowns` |
| Add/remove a piece type | `src/game.js` constants → `src/renderer.js` (rendering) → `src/ai.js` (scoring) |
| Tune AI behavior or scoring | `src/ai.js` — constants at the top, `chooseAIMove` at the bottom |
| Change UI layout or visuals | `index.html` + `styles.css` |
| Change how the board is drawn | `src/renderer.js` → `renderGame` |
| Change turn flow or player interaction | `src/main.js` |
| Update written rules | `rules/rules.md` (use `game-rules-manager` skill) |

### Build / Run
- No build step. ES modules loaded directly by the browser.
- Dev server: `npm run serve` → http://localhost:8080
- Tests: `npm test` (plain Node, no test framework)