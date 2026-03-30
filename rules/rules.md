# Kingstep

## Overview

Kingstep is a two-player abstract strategy game played on a 9x8 board.
Each side has two commanders and fourteen pawns.
All pieces move one square in any direction.
Commanders no longer move two squares; instead, each commander grants a local aura:
any friendly pawn adjacent to that commander can hop over a friendly adjacent piece.

You can win by eliminating all opposing pieces or by controlling both town squares
through one full opponent turn.

## Components

- 1 board with 9 ranks and 8 files
- 2 town squares at c5 and f5
- 16 white pieces:
  - 2 commanders
  - 14 pawns
- 16 black pieces:
  - 2 commanders
  - 14 pawns

## Objective

Win by either:

1. Capturing every opposing piece, or
2. Starting your turn while controlling both towns (c5 and f5).

## Setup

1. Place the board between both players.
2. Mark c5 and f5 as town squares.
3. White setup:
  - Back rank (rank 9): pawn, pawn, commander, pawn, pawn, commander, pawn, pawn
  - Front rank (rank 8): eight pawns
4. Black setup:
  - Back rank (rank 1): pawn, pawn, commander, pawn, pawn, commander, pawn, pawn
  - Front rank (rank 2): eight pawns
5. White takes the first turn.

## Turn Structure

On your turn:

1. Choose one of your pieces.
2. Move it to a legal destination.
3. If the destination contains an opposing piece, capture it.
4. End your turn.

There are no bonus actions.

## Actions and Move Rules

- All pieces may move exactly one square to any adjacent square, including diagonals.
- You may move into empty squares or capture by moving onto an enemy square.
- You may not move off-board.
- You may not move onto a square occupied by a friendly piece.

Commander aura rule:

- A pawn that is adjacent to at least one friendly commander gains hop options.
- A hop is a move two squares in a straight adjacent direction.
- The first square in that direction must contain a friendly piece to hop over.
- The landing square must be on the board and not occupied by a friendly piece.
- The landing square may be empty or occupied by an enemy piece (capture).

Commanders themselves do not hop and move only one square.

## Special Rules and Edge Cases

- There is no check or checkmate.
- There is no castling.
- There is no promotion.
- There is no en passant.
- No piece has a forward-only rule; movement is fully adjacent in all directions.
- A pawn can have both normal one-step moves and commander-aura hop moves in the same turn.
- A pawn only needs to be adjacent to one friendly commander to gain hop moves.

## End of Game

The game ends immediately when either condition is met:

1. One player has no pieces left.
2. A player's turn begins while that player still controls both towns.

## Winning

You win if either of the following becomes true:

1. The opponent has zero pieces remaining, or
2. Your turn begins and you occupy both c5 and f5.

If you occupy both towns on your move, you do not win immediately.
You must still occupy both towns when your next turn begins.

## Examples

### Example 1: Normal adjacent move

A pawn on e4 may move to any adjacent square (including diagonals) that is either empty
or occupied by an enemy piece.

### Example 2: Commander aura enables a hop

White commander on e5, white pawn on d5, white pawn on d4.
Because d5 is adjacent to a commander, the pawn on d5 may hop over the friendly pawn on d4
to d3, if d3 is not occupied by a white piece.

### Example 3: Hop capture

Using the previous position, if d3 contains a black piece, the pawn on d5 may hop to d3
and capture it.

### Example 4: No adjacent commander, no hop

If the commander on e5 moves away and the pawn on d5 is no longer adjacent to any friendly commander,
that pawn loses all hop options and can only use normal one-step moves.

### Example 5: Town control win timing

If white occupies both c5 and f5, white creates a pending town win.
White wins only if both towns are still occupied by white when white's next turn begins.

## Revision Notes

- Removed commander two-space movement.
- Added commander aura: adjacent friendly pawns can hop over friendly adjacent pieces.
- Clarified hop legality (adjacency requirement, blocker requirement, landing constraints).
- Rewrote examples and edge cases to match the new commander-aura system.
- Moved starting commanders from files d/e to files c/f.