## Agent

GitHub Copilot (Claude Sonnet 4.6)

## User

Unknown User

## Prompt

The game.js file refers to vanguard, rider, sentinel,... but this should not be here, all we have are pawns and commanders

## Summary

Renamed all non-commander piece types (vanguard, rider, sentinel, guard) to "pawn" across the entire codebase:

- `src/game.js`: Updated `BACK_RANK` to use `"pawn"` for all non-commander slots, replaced `"guard"` with `"pawn"` in `createInitialState`, and simplified `UNIT_TYPES` to `["commander", "pawn"]`.
- `src/ai.js`: Collapsed the four separate `CAPTURE_VALUES` entries (vanguard, sentinel, rider, guard) into a single `pawn: 4` entry.
- `src/main.js`: Replaced the four symbol mappings (vanguard, sentinel, rider, guard) in `PIECE_SYMBOLS` with a single `pawn` entry for each player.
- `tests/game.test.js`: Updated all `placePiece` calls and variable names to use `"pawn"` instead of the old type names.

All tests pass after the changes.
