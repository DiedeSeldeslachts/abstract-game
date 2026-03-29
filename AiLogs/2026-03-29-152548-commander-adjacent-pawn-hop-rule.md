## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

Rule updates: A commander can no longer move 2 spaces, but instead allows for all pawns adjacent to it to hop over friendly pieces

## Summary

Updated game logic so commanders now move one square only, and added a commander aura that grants adjacent friendly pawns hop moves over friendly adjacent blockers into the next square (including captures on enemy landing squares). Replaced commander two-step tests with new pawn-hop tests, rewrote rules/rules.md to document the new mechanic and edge cases, and updated UI/README text to match. Ran npm test and all tests passed.
