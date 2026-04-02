## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

make it so that teachers cannot caputre pieces

## Summary

Updated the rule engine so teacher movement excludes capture targets by filtering capture moves from teacher single-step movement options in src/game.js. Added a regression test in tests/game.test.js to verify teachers cannot capture adjacent enemy pieces. Updated rules/rules.md to document that teachers may only move to empty adjacent squares and added a revision note for the behavior change. Ran the test suite with npm test; all tests passed.
