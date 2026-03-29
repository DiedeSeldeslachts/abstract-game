# Kingstep

## Overview

Kingstep is a two-player abstract strategy game derived from chess. It uses the same
8x8 board and a chess-like starting arrangement, but with two commanders on each back
rank instead of a king and queen. Most pieces move the same way: one square in any
direction, like a chess king. Commanders are stronger and may move one or two adjacent
steps in a single turn. The game is about steady attrition rather than checkmate, and
the only way to win is to remove every opposing piece from the board.

## Components

- 1 board with 8 files and 8 ranks
- 16 white pieces:
	- 2 commanders
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

- rook, knight, bishop, commander, commander, bishop, knight, rook

Each pawn begins on the rank directly in front of that side's back rank.

## Turn Structure

On your turn:

1. Choose one of your pieces.
2. Move it according to its movement rule.
3. If the destination square contains an opponent's piece, capture it by replacing it.
4. End your turn. The other player then takes a turn.

There are no extra actions beyond that single move.

## Actions and Move Rules

- Rooks, bishops, knights, and pawns all use the same movement rule:
	- exactly one square to any adjacent square, including diagonals.
- Commanders may move in either of these ways:
	- one square to any adjacent square, including diagonals, or
	- two adjacent king-style steps in one turn.
- You may move into an empty square.
- You may capture an opponent's piece by moving onto its square.
- You may not move off the board.
- You may not move onto a square occupied by one of your own pieces.
- A commander cannot jump over occupied squares when using two steps:
	- if the first step would capture, the move ends there;
	- the second step is only allowed when the first step lands on an empty square.

Piece types matter for setup and commander movement only.

## Special Rules and Edge Cases

- There is no check.
- There is no checkmate.
- There is no king piece in this version of the game.
- There is no castling.
- There is no pawn double-step.
- There is no en passant.
- There is no promotion.
- Because a player wins only by removing all opposing pieces, there are no royal-piece conditions.

## End of Game

The game ends immediately when one player has no pieces remaining on the board.

## Winning

You win if, after your move resolves, the opponent has zero pieces left on the board.

There are no alternate win conditions.

## Examples

### Example 1: Pawn movement

A pawn on e2 may move to d3, e3, or f3 if those squares are empty or occupied by enemy pieces.
It may not move two squares forward, and it may not move onto a square occupied by a friendly piece.

### Example 2: Commander two-step move

If your commander is on d4 and both d5 and e6 are legal squares, you may move from d4 to d5 and
then to e6 in the same turn. This is still one move action.

If d5 contains an enemy piece, your commander may capture on d5, but the move ends immediately and
you do not take a second step.

### Example 3: Commander capture

If your commander is on d4, d5 is empty, and the opponent has a piece on d6, your commander may
capture that piece by moving two steps from d4 to d6 through d5.

### Example 4: No checkmate concept

If your commander moves next to any opposing piece, that does not create check. The opposing player simply takes a normal turn.

## Revision Notes

- Replaced the template with a complete rulebook for Kingstep.
- Established standard chess setup, universal king-style movement, and total-elimination victory.
- Replaced king and queen with two commanders per side on the back rank.
- Added commander movement: one step or two adjacent king-style steps in one turn.