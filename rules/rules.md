# Kingstep

## Overview

Kingstep is a two-player abstract strategy game played on a hexagonal board.
Each player starts with only one pawn already on the board, and all other units
enter play through placement actions during the game.

On each turn, a player chooses exactly one action:

1. Move one of their pieces already on the board, or
2. Place one reserve piece on an empty non-town, non-center square.

You can win by eliminating all opposing pieces or by controlling both town squares
through one full opponent turn.

## Components

- 1 hexagonal board (radius 4, 61 tiles total)
- Tile colors: 60 playable tiles divided equally among 4 colors — **green**, **blue**, **yellow**, and **brown** (15 tiles each)
- 1 center tile (e5) — white, impassable; no piece may enter or be placed on it
- 2 town squares at c5 and g5
- White pieces:
  - 1 starting pawn (already on c5)
  - Reserve pool: 5 pawns, 2 horses, 2 sentinels
- Black pieces:
  - 1 starting pawn (already on g5)
  - Reserve pool: 5 pawns, 2 horses, 2 sentinels

## Objective

Win by either:

1. Capturing every opposing piece, or
2. Starting your turn while controlling both towns (c5 and g5).

## Setup

1. Place the board between both players.
2. Mark c5 and g5 as town squares. Mark e5 as the center tile (impassable).
3. Place one white pawn on c5.
4. Place one black pawn on g5.
5. Keep all other pieces in each player's reserve.
6. White takes the first turn.

## Turn Structure

Each turn consists of two sequential moves performed by the same player:

**1st move (action)** — choose one of:
1. Move one of your on-board pieces to a legal destination. If the destination has an opposing piece, capture it.
2. Place one piece type from your reserve on any empty square that is not a town square.

**2nd move (push)** — choose one of:
1. Move one of your on-board pieces to an empty destination (no captures).
2. Push an enemy piece away: move one of your pieces onto an enemy-occupied square. The enemy piece is displaced one square further in the same direction of movement. The destination square for the pushed piece must be empty and on the board. If no such square exists, that push is not a legal option.

After both moves are completed, the turn ends and the opponent takes their turn.

If a player has no legal moves available during the 2nd move, the 2nd move is skipped automatically.

## Actions and Move Rules

Global rules:

- You may not move off-board.
- You may not move onto the center tile (e5). No piece may enter or be placed on it.
- You may not move onto a square occupied by a friendly piece.
- Captures happen on the 1st move only, by moving onto an enemy-occupied square.
- **Capture tile-color rule:** a capture is legal only if there is a tile of the same color as the capturing piece's starting tile on the capture line in the movement direction (this may be before the target, on the target, or beyond the target). If no such same-color tile exists on that line, the capture is not allowed.
- Placement never captures and is only available on the 1st move.
- Pieces may not be placed on town squares or on the center tile.
- The 2nd move cannot capture; it can only move to empty squares or push enemy pieces.

Push rules:

- A push is initiated by moving onto an enemy-occupied square on the 2nd move.
- The push direction is the direction of your piece's movement.
- The enemy piece is displaced one square further in that same direction.
- The displaced position must be empty and on the board. Otherwise the push is not legal.
- The pushing piece occupies the square previously held by the pushed piece.

Reserve placement limits (per player):

- Pawn: up to 5 placements
- Horse: up to 2 placements
- Sentinel: up to 2 placements

Piece movement rules:

- Most pieces move exactly one square to any adjacent square, including diagonals.
- Horses move one or two squares in one straight direction (orthogonal or diagonal).
- For a two-square horse move, the intermediate square must be empty and not the center tile.
- Sentinels cannot move. They occupy a square but have no legal move actions.

Commander aura rule:

- A pawn adjacent to at least one friendly commander gains hop options.
- A hop moves two squares in one adjacent direction.
- The first square in that direction must contain a friendly piece to hop over.
- The landing square must be on-board, not the center tile, and not occupied by a friendly piece.
- The landing square may be empty or enemy-occupied (capture).

Commanders themselves move one square and do not hop.

Pawn sliding rule (1st move):

- On the 1st move of a turn, a pawn may slide any number of squares in a single direction.
- The pawn must stop on a tile whose **color matches the pawn's starting tile color**.
- If the pawn encounters an enemy piece, a capture is only allowed if the capture tile-color rule is satisfied: there must be a tile matching the pawn's starting tile color on that same slide line (before the enemy, on the enemy tile, or beyond the enemy). If the rule is not satisfied, the pawn is still blocked and cannot slide further, but no capture occurs.
- If a friendly piece blocks the path, the pawn may not pass through it.
- If no valid stopping tile exists in a given direction, the pawn may not move in that direction.
- A pawn that starts on the center tile (normally impossible in play) cannot slide in any direction.

Pawn 2nd move rule:

- On the 2nd move of a turn (push phase), a pawn moves exactly **one step** to an adjacent empty square or pushes an adjacent enemy piece.
- The tile color rule does **not** apply on the 2nd move.

## Special Rules and Edge Cases

- Town squares are legal to move into and legal to occupy.
- Town squares are not legal placement squares.
- The center tile (e5) is impassable. No piece may move onto it or be placed on it.
- No tile color applies to the center tile; it is always white and cannot be used as a starting or stopping tile for pawn slides.
- The capture tile-color rule applies to all captures on the 1st move: single-step, horse, pawn slide, and commander aura hops.
- There is no check or checkmate.
- There is no castling.
- There is no promotion.
- There is no en passant.
- No piece has a forward-only rule; movement is adjacent in all directions.
- Horses are the only pieces that can move two squares in a straight line.
- A pawn only needs one adjacent friendly commander to unlock hop moves.
- Commander hop moves are not restricted by tile color, even on the 1st move.
- Pawn tile color rule applies only on the 1st move. On the 2nd move, pawns move one step freely.
- A piece placed on the 1st move can be captured normally by the opponent on their next 1st move; placement grants no capture immunity.
- If a player has no legal 1st move actions, they may not skip it; but if the board and reserve both yield no valid action, the game is considered stuck (draw by stalemate is not formally defined in the current rules).
- If a player has no legal 2nd move actions, the 2nd move is skipped.

## End of Game

The game ends immediately when either condition is met:
 One player has no pieces left on the board.
2. A player's turn begins while that player still controls both towns.

## Winning

You win if either becomes true:

1. The opponent has zero on-board pieces remaining, or
2. Your turn begins and you occupy both c5 and g5.

If you occupy both towns during your action, you do not win immediately.
You must still occupy both towns when your next turn begins.

## Examples

### Example 1: Placement action

White chooses a place action and places a horse on b7.
That square is empty and not a town square, so the action is legal.
White's remaining horse placements decrease by one.

### Example 2: Illegal placement on a town

Black cannot place a sentinel directly on c5 or g5,
even if the town square is empty. Black also cannot place on e5 (the center tile).

### Example 3: Commander aura hop

White commander on d5, white pawn on c5, white pawn on b5.
Because c5 is adjacent to a commander, the pawn on c5 may hop over b5 to a5,
if a5 is not occupied by a white piece. The destination tile color is irrelevant for hops.

### Example 4: Town control and full turn

White occupies both c5 and g5 at the end of White's full turn (after both the 1st and 2nd moves).
White creates pending town control.
White wins only if both towns are still white-occupied when White's next full turn begins.

### Example 5: Push on the 2nd move

White pawn on d5, Black pawn on e4, f3 is empty.
On White's 2nd move, White moves the pawn from d5 one step toward e4.
The Black pawn on e4 is pushed to f3. White's pawn occupies e4. No piece is captured.
The tile color rule does not apply on the 2nd move; the pawn moves exactly one step.

### Example 6: Pawn slide and tile color

White pawn on a tile of color **blue**. The pawn may slide in any direction.
It passes through green and yellow tiles freely, stopping only on tiles it encounters that are **blue**
(or on the first red enemy piece in that direction).
If no blue tile (or enemy piece) is reachable in a given direction, the pawn may not move that way.

## Revision Notes

- Replaced full-army starting setup with minimal setup: one white pawn on c5 and one black pawn on g5.
- Moved the right-side town one tile to the right: f5 -> g5.
- Added dual-action turn structure: move one piece or place one reserve piece.
- Added reserve placement limits per player: 5 pawns, 2 horses, 2 sentinels.
- Added placement restriction: pieces cannot be placed directly on town squares.
- Updated setup, edge cases, and examples to align with placement-first gameplay.
- Updated sentinel mechanics: sentinels can now be captured and cannot move.
- Removed sentinel protection rule: pawns adjacent to sentinels are no longer protected from capture.
- Clarified that newly placed pieces are immediately capturable on the opponent's next turn.
- Changed turn structure to two sequential moves per turn: 1st move (action: move/capture or place), 2nd move (push: move to empty square or push enemy piece away, no captures). The 2nd move is skipped automatically if no legal options exist.
- Added tile colors: every playable tile has one of 4 colors (green, blue, yellow, brown), 15 tiles each.
- Added center tile rule: e5 is white and impassable — no piece may enter or be placed on it.
- Added capture tile-color rule: on the 1st move, a piece can only capture an enemy if there is a tile of the same color as the capturing piece's starting tile along the movement path to the target (inclusive). This applies to all capture types: single-step, horse, pawn slide, and commander aura hops.
- Removed teacher piece and all transformation mechanics from the ruleset.
