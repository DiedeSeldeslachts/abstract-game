# Kingstep

Kingstep is a placement-first abstract capture game on a 9x8 board.
Each side starts with only one pawn on a town square.
On every turn, a player chooses exactly one action:

- Move one piece already on the board, or
- Place one reserve piece on an empty non-town square.

Reserve limits per player are 5 pawns, 2 horses, and 2 sentinels.
Most pieces move one square in any direction, horses move one or two squares in a straight line,
commanders grant adjacent friendly pawns a hop option, and sentinels cannot move.

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