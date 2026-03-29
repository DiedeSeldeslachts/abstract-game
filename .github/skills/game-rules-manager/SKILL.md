---
name: game-rules-manager
description: 'Create, update, rewrite, and organize board game rules in Markdown. Use when defining setup, turn order, legal moves, win conditions, edge cases, and revisions for rules/rules.md.'
argument-hint: 'Describe the game and the rule changes to make in rules/rules.md'
user-invocable: true
---

# Game Rules Manager

## What This Skill Does

This skill creates and maintains a board game's written rules in Markdown.

The canonical rules file lives at `rules/rules.md`.

Use this skill to:
- create the first draft of a game's rules
- revise existing rules after design changes
- add missing edge cases, examples, or clarifications
- keep rule structure consistent as the game evolves

## When to Use

Use this skill when the task involves any of the following:
- writing a new rulebook for a board game
- updating setup instructions or components lists
- changing turn structure or action rules
- redefining legal moves or restrictions
- documenting scoring, win conditions, or tie breakers
- clarifying ambiguous interactions or exceptions

## Output Requirements

- Write everything in Markdown.
- Store the rules only in `rules/rules.md`.
- Treat `rules/rules.md` as the source of truth for gameplay rules.
- Keep the document readable for both designers and implementers.
- Prefer explicit rules over shorthand or implied behavior.
- Prefer a full rewrite of the rulebook when updating rules so the document stays internally consistent.
- Add examples when they materially reduce ambiguity.
- Maintain a `## Revision Notes` section when rules are updated.

## Required Structure

When creating or substantially rewriting `rules/rules.md`, use this structure unless the user asks for a different format:

1. `# <Game Name>`
2. `## Overview`
3. `## Components`
4. `## Objective`
5. `## Setup`
6. `## Turn Structure`
7. `## Actions and Move Rules`
8. `## Special Rules and Edge Cases`
9. `## End of Game`
10. `## Winning`
11. `## Examples`
12. `## Revision Notes`

## Procedure

1. Inspect `rules/rules.md` if it already exists.
2. Identify whether the request is for a new ruleset or an update that should be rewritten into a clean, consistent full rulebook.
3. Extract the core rule facts:
   - board or play area
   - pieces, tokens, or shared resources
   - player count
   - setup sequence
   - turn flow
   - legal actions
   - restrictions and edge cases
   - victory and failure conditions
4. Resolve ambiguity before writing when a missing rule would change gameplay behavior.
5. Write or update `rules/rules.md` in Markdown.
6. When updating existing rules, rewrite affected and adjacent sections as needed so the final document reads as one coherent rulebook.
7. Ensure terminology is consistent across the whole document.
8. Add concise examples when a rule could be interpreted in multiple valid ways.
9. Record notable changes in `## Revision Notes` when updating an existing ruleset.
10. End by checking that the rules are complete enough for another person to run the game without guessing.

## Quality Checks

Before finishing, verify that:
- setup can be followed step by step
- each turn has a clear beginning, action space, and end
- legal and illegal moves are distinguishable
- win conditions are measurable and unambiguous
- exceptions do not conflict with the base rules
- terminology is consistent throughout the document
- the file remains Markdown-only with no non-Markdown output embedded in it

## Decision Rules

- If the user gives partial rules, keep established facts and only fill gaps that are logically required.
- If a new rule conflicts with an existing rule, rewrite the conflicting sections so the document stays internally consistent.
- If the requested change alters strategy-critical behavior, update all affected sections, not just one paragraph.
- If examples would prevent likely implementation mistakes, include them.
- If information is missing and multiple interpretations are plausible, ask a focused clarification question instead of inventing rules.

## Completion Standard

The skill is complete when `rules/rules.md` is a coherent Markdown rulebook that matches the latest requested game design and does not leave core gameplay loops undefined.