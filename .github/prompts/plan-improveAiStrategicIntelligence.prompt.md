## Plan: Improve AI Strategic Intelligence

**TL;DR**: Overhaul the AI evaluation weights and add new heuristics to fix three observed problems (purposeless quiet moves, insufficient reserve deployment, overall passivity). Rebalance existing weights + add 5 new evaluation components + improve move ordering + keep search depth at 3 with higher time budget.

---

### Phase 1: Weight Rebalancing (constants at top of `src/ai.ts`)

1. `MATERIAL_WEIGHT`: 36 → **50** — captures become more impactful (pawn=200, horse=300, sentinel=400, commander=600)
2. `TOWN_OCCUPATION_SCORE`: 360 → **180** — towns become worth less than capturing a sentinel (400) or commander (600)
3. `TOWN_DISTANCE_WEIGHT`: 20 → **12** — less gravitational pull toward towns at expense of tactics
4. `CAPTURE_THREAT_WEIGHT`: 18 → **28** — available captures weigh heavier, encouraging aggressive positioning
5. `PIECE_SAFETY_WEIGHT`: 1 → **3** — protecting pieces incentivizes defensive moves over purposeless shuffling
6. `MOBILITY_WEIGHT`: 4 → **2** — raw move count matters less; position quality matters more
7. `PUSH_PRESSURE_WEIGHT`: 34 → **42** — more aggression via commander pushes
8. `OPENING_AGGRESSION_WEIGHT`: 18 → **28** — stronger opening tempo
9. `KING_CENTER_DISTANCE_WEIGHT`: 300 → **350** — keep king advancement as strong priority
10. `ENDGAME_TOWN_WEIGHT`: 220 → **140** — proportional reduction to match halved `TOWN_OCCUPATION_SCORE`, prevents late-game town over-valuation
11. Keep `TOWN_CONTROL_SCORE` at 2200 — controlling both towns is effectively a win condition

### Phase 2: New Evaluation Heuristics (new functions in `src/ai.ts`) — all parallel

12. **`getDeploymentScore(state, player)`** — counts the **number** of on-board pieces (unweighted, not by value) to avoid double-counting material. Each piece = 1 point. Encourages placing reserves without distorting capture trade-offs. `DEPLOYMENT_WEIGHT = 16`.
13. **`getKingSafetyScore(state, player)`** — finds own king on board; counts friendly defenders adjacent (+3 each, +6 for sentinels). Penalizes enemy pieces adjacent (−4 each). **Scales inversely with king distance to center**: when king is far (distance 4+), full weight applies; when king is close (distance 1–2), weight drops to 25% so king advancement dominates near the win. `KING_SAFETY_WEIGHT = 40`.
14. **`getKingThreatScore(state, player)`** — only activates when opponent's king is on the board. Counts own pieces adjacent (distance 1) or nearby (distance 2) the enemy king. **Defended** pieces adjacent to the enemy king score +4; undefended pieces score only +1 (avoids encouraging suicidal positioning). Pieces at distance 2 score +2 regardless. `KING_THREAT_WEIGHT = 35`.
15. **`getCenterBlockadeScore(state, player)`** — only activates when the opponent's king is on the board. Rewards own pieces that are **between** the enemy king and center e5 (specifically: piece is within 2 hexes of center AND closer to center than the enemy king). Pieces merely "near center" without blocking don't score. `CENTER_BLOCKADE_WEIGHT = 25`.
16. **`getColorDiversityScore(state, player)`** — counts the number of distinct tile colors occupied by the player's pieces. Each unique color = 1 point. Prevents the AI from accidentally losing placement access to entire tile colors. `COLOR_DIVERSITY_WEIGHT = 12`.

### Phase 3: Integrate into `evaluateState` (*depends on Phase 2*)

17. Add all 5 new score components to `evaluateState()`, computed symmetrically for both players (same pattern as existing components).

### Phase 4: Move Ordering Improvements (*parallel with Phase 2*)

18. In `evaluateMoveForOrdering()`: increase placement bonus from 280 → **400**, extend placement cutoff from move 8 to move **12** — encourages placement throughout the game.
19. Add "defensive move" bonus (cheap heuristic — no attack map needed): if a move's destination is adjacent to a friendly piece worth ≥8 (sentinel/commander/king), add **+120**. This favors protective positioning without expensive attack-map computation inside move ordering.
20. Add "king threat" move bonus: if the move's destination is adjacent to the opponent's king, add **+200** — prioritizes attacking the king.
21. Add **quiet move penalty** (−50): non-capture moves whose destination is not adjacent to any enemy piece AND not adjacent to any friendly piece AND not a town square AND not closer to center. Pushes purposeless shuffling to the bottom of search order.

### Phase 5: King Placement Timing (*parallel with Phase 2*)

22. In `evaluateMoveForOrdering()` for placement actions: if placing a king and `state.moveNumber < 8`, apply a **−300 penalty** (too early, no defensive infrastructure). If placing a king and `state.moveNumber >= 8`, apply a **+150 bonus** (good timing, sentinels/commanders likely in place). Additionally, king placements get a bonus proportional to friendly adjacency at the destination (×20 per adjacent friendly piece) to encourage placing the king with an escort.

### Phase 6: Search Budget (*parallel with all above*)

23. Keep `SEARCH_MAX_DEPTH` at **3** — depth 4 risks blowing the time budget since `evaluateState` calls `getAllLegalMoves` 4× per leaf node. The weight and heuristic improvements alone address the strategic blind spots.
24. `SEARCH_TIME_BUDGET_MS`: 1400 → **2000** — modest increase gives more room for the slightly heavier evaluation.
25. `QUIESCENCE_DEPTH`: 1 → **2** — better horizon effect reduction for captures and pushes.

---

**Relevant files**
- `src/ai.ts` — All changes are in this single file: constants (lines 30–54), new evaluation functions (after ~line 340), `evaluateState` (~line 565), `evaluateMoveForOrdering` (~line 612), search params (lines 37–39)
- `src/game.ts` — Read-only reference for imports (already available in ai.ts); will need to import `getOccupiedTileColorsForPlayer` or `getTileColor` for color diversity scoring
- `tests/game.test.ts` — May add AI heuristic tests

**Verification**
1. `npm run build` — must compile
2. `npm test` — existing tests must pass
3. Manual playtest via `npm run serve` — confirm:
   - AI places pieces early and frequently instead of shuffling existing ones
   - AI captures enemy pieces when possible rather than occupying towns
   - AI advances king toward center with escort (not before move 8)
   - AI positions pieces near own king for defense
   - AI threatens opponent's king with defended pieces (not suicidal throws)
   - AI blocks opponent's king path to center when king is on board
   - AI maintains placement access to multiple tile colors
   - AI doesn't over-commit to towns mid-game or late-game
4. Console debug output — verify AI completes depth 3 within 2000ms budget consistently

**Decisions**
- All changes scoped to `src/ai.ts` only — no rule changes, no UI changes
- "King" = king piece type (wins by reaching center e5), not commander
- Town occupation (180) now below sentinel-capture value (400), but both-town control stays high (2200) as it's a win condition
- Search depth stays at 3 to avoid performance explosion from heavy `evaluateState`
- Move ordering uses cheap adjacency heuristics instead of attack maps (avoids O(n²) per ordering call)
- Deployment score counts pieces (not value) to avoid stacking with material weight
- King safety scales down near center to not fight king advancement
- King threat rewards defended attackers more than exposed ones
- Center blockade requires actual interposition, not just "near center"

**Risks to Monitor During Testing**
1. **Reserve flex penalty overlap**: `getOpeningAggressionScore` already penalizes holding reserves. With the new deployment score also pushing placement, these may over-stack. If AI deploys too aggressively (placing king early despite the timing penalty, or placing pieces in bad positions), reduce `DEPLOYMENT_WEIGHT` or the opening aggression reserve penalty.
2. **Quiescence depth 2 performance**: If search time creeps above 2s regularly, revert to quiescence depth 1.
3. **Color diversity over-valuation**: If the AI makes bad moves just to maintain a 4th tile color, reduce `COLOR_DIVERSITY_WEIGHT` from 12 to 6.
