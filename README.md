# Kingstep

Kingstep is a chess-inspired abstract capture game played on a standard 8x8 board.
Each side begins with a modified chess-style army where the queen and king are replaced
by two commanders on the back rank. Most pieces move exactly one square in any direction,
while commanders may move one or two adjacent steps in a single turn. There is no check,
checkmate, castling, en passant, or promotion.
The only way to win is to capture every opposing piece.

In this implementation, you play as White and the AI controls Black.

## Run

Open the root folder in a simple static server and load `index.html`.

Examples:

- VS Code Live Server
- `python -m http.server`
- `npx serve .`

## Test

Run:

```bash
npm test
```