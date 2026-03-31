# Kingstep

Kingstep is a chess-inspired abstract capture game played on a 9x8 board.
Each side begins with a modified chess-style army where the queen and king are replaced
by two commanders on the back rank. Horses start on files a and h and move one or two squares in a straight line.
Most pieces move exactly one square in any direction,
while commanders grant adjacent friendly pawns a hop move over friendly pieces. There is no check,
checkmate, castling, en passant, or promotion.
You win by capturing every opposing piece or by controlling both town squares through one full round.

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