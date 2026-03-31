## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

Create a new piece:
The horse,
on files a and h
The horse can move 2 steps in a straight line

## Summary

Implemented a new `horse` piece across game logic, AI, UI, tests, and written rules. Updated initial setup so files a/h on each back rank are horses, added horse legal move generation (exactly two squares in a straight line with an empty intermediate square), included horse in teacher transform targets, added horse symbols in the UI, and adjusted descriptive text in the game screens and docs. Added tests for initial horse placement and horse movement constraints, then ran `npm test` successfully.

## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

The horse can move 1 OR 2 steps in a straight line

## Summary

Updated horse movement rules so horses can move either one or two squares in straight adjacent directions. In the rules engine, horse moves now include legal 1-step straight moves and 2-step straight moves (with an empty intermediate square), while preserving capture, friendly-occupancy, and sentinel-shield constraints. Updated UI and documentation wording in `src/main.js`, `index.html`, `README.md`, and `rules/rules.md` to match the new rule, expanded horse tests to cover both ranges, and validated successfully with `npm test`.
