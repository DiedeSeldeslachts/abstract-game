# Kingstep

## Overview

Kingstep is a two-player abstract strategy game derived from chess. It uses the same
8x8 board and the same starting arrangement of pieces as chess, but every piece moves
the same way: one square in any direction, like a chess king. The game is about steady
attrition rather than checkmate. Kings are ordinary capturable pieces, and the only way
to win is to remove every opposing piece from the board.

## Components

- 1 board with 8 files and 8 ranks
- 16 white pieces:
	- 1 king
	- 1 queen
	- 2 rooks
	- 2 bishops
	- 2 knights
	- 8 pawns
- 16 black pieces with the same distribution

## Objective

Capture all of the opponent's pieces.

## Setup

1. Place the board between the two players with each player viewing the board from one side.
2. Set up the pieces exactly as in standard chess.
3. White takes the first turn.

Standard starting order on each back rank from left to right is:

- rook, knight, bishop, queen, king, bishop, knight, rook

Each pawn begins on the rank directly in front of that side's back rank.

## Turn Structure

On your turn:

1. Choose one of your pieces.
2. Move it exactly one square in any orthogonal or diagonal direction.
3. If the destination square contains an opponent's piece, capture it by replacing it.
4. End your turn. The other player then takes a turn.

There are no multi-step moves and no extra actions.

## Actions and Move Rules

- Every piece uses the same movement rule.
- A legal move is one square to any adjacent square, including diagonals.
- You may move into an empty square.
- You may capture an opponent's piece by moving onto its square.
- You may not move off the board.
- You may not move onto a square occupied by one of your own pieces.

The original chess piece types matter only for identity and setup. They do not change movement.

## Special Rules and Edge Cases

- There is no check.
- There is no checkmate.
- The king has no special protection and may be captured like any other piece.
- There is no castling.
- There is no pawn double-step.
- There is no en passant.
- There is no promotion.
- Because a player wins only by removing all opposing pieces, threatening the king alone has no special effect.

## End of Game

The game ends immediately when one player has no pieces remaining on the board.

## Winning

You win if, after your move resolves, the opponent has zero pieces left on the board.

There are no alternate win conditions.

## Examples

### Example 1: Pawn movement

A pawn on e2 may move to d3, e3, or f3 if those squares are empty or occupied by enemy pieces.
It may not move two squares forward, and it may not move onto a square occupied by a friendly piece.

### Example 2: King capture

If your rook is on d4 and the opposing king is on e5, your rook may capture that king by moving to e5.
The game continues unless that capture removes the opponent's final remaining piece.

### Example 3: No checkmate concept

If your queen moves next to the opposing king, that does not create check. The opposing player simply takes a normal turn.

## Revision Notes

- Replaced the template with a complete rulebook for Kingstep.
- Established standard chess setup, universal king-style movement, and total-elimination victory.