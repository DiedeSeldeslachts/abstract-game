## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

Big rule change!
There will no longer be starting pieces except for 1 pawn on the towns.
In a turn you can do one of 2 things:
- Move a piece that is on the board
- Place a piece on the board (anywhere except directly on towns)

Both players can place up to 5 pawns, 2 horses, 2 sentinels and one teacher

## Summary

Reworked the game to a placement-first ruleset. Updated the rules source of truth in rules/rules.md with the new setup, turn structure, placement restrictions, and reserve limits. Refactored src/game.js to support legal placement generation, reserve tracking, placement caps, placement application, and the new initial state with one town pawn per player.

Updated src/ai.js so the AI can evaluate and choose both move and placement actions. Updated UI flow in src/main.js, index.html, and styles.css to add reserve placement buttons, reserve counters, placement-mode board targeting, and status/last-action messaging for place actions.

Rewrote tests in tests/game.test.js for the new setup and placement logic, including limits and AI placement behavior. Ran npm test successfully and verified there are no editor diagnostics in changed source files.
