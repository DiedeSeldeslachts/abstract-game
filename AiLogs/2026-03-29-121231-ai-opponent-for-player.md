## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

Create an ai that can play against the player

## Summary

Implemented a deterministic black-side AI opponent and wired it into the browser UI so the human plays white and the AI responds automatically after each human move. Added a new pure AI module in src/ai.js with move scoring (capture preference, approach pressure, and exposure penalty), updated src/main.js to schedule/execute AI turns and prevent clicks while AI is thinking, extended tests/game.test.js with AI coverage, and updated README.md to document player-vs-AI behavior. Ran npm test successfully.
