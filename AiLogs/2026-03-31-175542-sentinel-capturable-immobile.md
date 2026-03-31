# Sentinel Mechanic Changes

## Agent

GitHub Copilot (Claude Haiku 4.5)

## User

Unknown User

## Prompt

A sentinel should be capturable and should not be able to move.

## Summary

Updated sentinel mechanics in the Kingstep game to make sentinels capturable and immobile:

### Changes Made

1. **Rules Update** (`rules/rules.md`):
   - Added rule: "Sentinels cannot move. They occupy a square but have no legal move actions."
   - Removed sentinel protection rule that prevented pawns adjacent to sentinels from being captured
   - Updated examples to remove sentinel protection scenarios
   - Updated revision notes to document these changes

2. **Code Update** (`src/game.js`):
   - Simplified `isCapturablePiece()` function to allow all pieces to be capturable (removed sentinel exception)
   - Removed `isPawnProtectedBySentinel()` function entirely as it's no longer needed
   - Added sentinel check in `getLegalMovesForPlayer()` to return empty array for sentinels, preventing them from moving

3. **Test Update** (`tests/game.test.js`):
   - Updated `testEnemyCannotCaptureSentinel` to `testEnemyCanCaptureSentinel` to verify sentinels CAN be captured
   - Updated `testEnemyCannotCapturePawnAdjacentToSentinel` to verify pawns are no longer protected when adjacent to sentinels
   - Added new `testSentinelCannotMove()` to verify sentinels have no legal moves
   - Removed obsolete `testEnemyCanMoveAdjacentToSentinelToEmptySquare()` test

### Validation

All tests pass successfully (npm test - validation passed).

### Mechanical Impact

- Sentinels are now purely defensive/control pieces that occupy board space but provide no movement or protection benefits
- Enemies can capture a sentinel just like any other piece
- Sentinels serve primarily as board control elements in placement strategies
