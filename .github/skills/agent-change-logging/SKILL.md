---
name: agent-change-logging
description: Creates a Markdown change log file in AiLogs/ per chat session to track agent work. Use after completing any task that modifies files, generates code, or updates documentation.
---

## Agent Change Logging

## When to Use

- After any chat session with an agent

## Workflow

When an agent works in this repository:

- **Create one Markdown log file in `AiLogs/` per chat session**
- Reuse that same file for all updates during the session (do not create multiple log files in one session)
- For each question asked to the agent, append these sections:
  - `## Agent` — the agent, model name
  - `## User` — the user who executed the prompt (preferably a GitHub username, or "Unknown User" if not known)
  - `## Prompt` — what was prompted/requested
  - `## Summary` — a short summary of what was done by the main agent and any subagents
- Use filename format: `yyyy-mm-dd-HHmmss-short-prompt-summary.md`
  - Timestamp in Belgian local time (CET/CEST), no `T` separator
  - Do not include the agent name in the filename
  - Include a few words that summarise the prompt

## Edge Cases

- **Multiple questions in one session:** Append a new `## Agent` / `## User` / `## Prompt` / `## Summary` block for each question — do not overwrite earlier entries.
- **Subagent work:** Include subagent actions in the parent `## Summary` section, not as separate log files.
- **No file changes made:** Still create a log entry if the agent performed research, analysis, or answered a question — the log tracks agent activity, not just file edits.

## Example

A session where two questions were asked produces a single file:

**Filename:** `2026-03-15-194644-module-d-spec-pack-summary.md`

**Contents:**

```markdown
## Agent

GitHub Copilot (Claude Opus 4.6)

## User

Probook

## Prompt

Generate the Module D spec pack for the Nefarious intelligence dashboard.

## Summary

Created 16 spec files across 5 workflow stages covering datastructures,
backend, frontend, nice-to-haves, and validation/demo. Added INDEX.md
with dependency graph and implementation order.

## Agent

GitHub Copilot (Claude Opus 4.6)

## User

Probook

## Prompt

Add cross-cutting compliance coverage table to the index.

## Summary

Added compliance coverage and spec-to-requirement traceability tables
to INDEX.md covering all FR, NFR, and governance requirements.
```