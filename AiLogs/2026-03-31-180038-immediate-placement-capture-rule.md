## Agent

GitHub Copilot (GPT-5.3-Codex)

## User

Unknown User

## Prompt

There seems to be a rule that sais that a placed piece cannot be immediatly captured, this should be possible

## Summary

Confirmed the move engine already treats all pieces as capturable and does not grant placement immunity. Updated the rulebook to explicitly state that a newly placed piece can be captured on the opponent's next turn, and added a regression test that places a piece and captures it immediately on the following turn. Ran the test suite (`npm test`), and all tests passed.
