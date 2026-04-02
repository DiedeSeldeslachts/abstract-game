## Agent

GitHub Copilot (Claude Sonnet 4.6)

## User

Unknown User

## Prompt

New game mechanic: every player does 2 moves per turn.
1st move: standard, can move and capture pieces.
2nd move: can only move or push pieces away (instead of capturing).

## Summary

Implemented a 2-phase turn structure across game logic, UI, AI, rules, and tests:

**src/game.js**
- Added `turnPhase: "action" | "push"` field to all game states.
- Modified `createNextStateBase` to stay on the same player after the action phase (push phase) and switch players only after the push phase.
- Updated `getSingleStepMovesForPlayer`, `getCommanderAuraHopMovesForPawn`, and `getHorseMovesForPlayer` to generate push moves (with `push: true, pushTo`) instead of capture moves in push phase.
- Disabled Teacher transform in push phase.
- Disabled placements (`getLegalPlacements`) in push phase.
- Added push handling to `applyMove`: pushing piece moves to enemy square, enemy displaced one step further in movement direction.
- Added `applyPassPush` export: skips the push phase (used when no legal push moves exist).
- Updated `resolveWinConditions` so town-win check and town-control-pending update only trigger at the end of a full turn (push → action transition).
- Added `push` and `pushTo` fields to move objects produced by `getAllLegalMoves`.

**src/main.js**
- Added `applyPassPush` and `getAllLegalMoves` to imports.
- Added `checkAutoPassPushPhase` helper: auto-skips push phase when no legal moves are available.
- Updated `performAIMove` to chain into the AI's push phase after the action phase.
- Updated status and selection text to show 1st/2nd move context.
- Updated last-action text to describe push and pass events.
- Disabled reserve placement buttons during push phase.
- Applied `is-push` CSS class to push-target hexes in board rendering.

**styles.css**
- Added `.hex.is-push::after` with orange highlight (distinct from capture red and target green).

**tests/game.test.js**
- Added `applyPassPush` import.
- Updated `testApplyPlacementAddsPieceAndFlipsTurn` → renamed and now verifies push phase (same player, `turnPhase: "push"`).
- Updated `testPlacedPieceCanBeCapturedImmediatelyOnNextTurn` to complete the full turn (action + pass push) before asserting capture legality.
- Updated `testPlacementLimitIsEnforced` to use full turns (action + pass push per player per round).
- Updated `testTownControlWinsAfterFullRound` to use two full turns (action + pass push).
- Added `testPushPhaseHasPushMovesAndNoCaptures`: verifies push phase produces no `capture: true` moves.
- Added `testPushMoveDisplacesEnemyPiece`: verifies pushing piece moves to enemy square and enemy is displaced to the square beyond.

**rules/rules.md**
- Rewrote Turn Structure to describe the 2-move turn (action phase + push phase).
- Updated Actions and Move Rules to include global push rules.
- Updated Special Rules and Edge Cases to reflect restrictions on captures and Teacher in push phase.
- Added Example 4 (town control and full turn) and Example 5 (push on the 2nd move).
- Updated Revision Notes.
