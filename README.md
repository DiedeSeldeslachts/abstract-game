# Kingstep

Kingstep is a chess-inspired abstract capture game played on a standard 8x8 board.
Each side begins with the normal chess army, but every piece moves exactly one square
in any direction. There is no check, checkmate, castling, en passant, or promotion.
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