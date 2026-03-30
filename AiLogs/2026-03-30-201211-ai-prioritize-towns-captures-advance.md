## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

The ai should prioritize capuring the towns and other pieces more as well as moving up pieces

## Summary

Updated AI move scoring in src/ai.js to increase priority for capturing pieces, occupying/capturing town squares, and forward piece advancement. Added explicit scoring constants for these priorities while preserving deterministic move selection. Added tests in tests/game.test.js to verify preference for town captures and forward progression. Ran npm test successfully.
