# Changelog

## 0.2.1 (2026-11-05)

- Tool detection no longer lists plugin tool names. A `spawn_*` agent tool
  counts as delegation. A plugin or MCP tool counts as a lookup when a word
  of its name is a lookup verb and no word says it changes something
  (`notes_search`, `mcp__docs__get_page`; not `find_and_replace`). Read-only
  DSH tools such as `job_list` and `get_goal` now count as research too.
- Scripts named `*doctor*` no longer count as test runs.
- Test fixtures and prompt examples use invented content, or describe this
  plugin itself.

## 0.2.0 (2026-11-05)

- The journal updates itself when a turn ends: the finished turn is
  summarized and the work items are regrouped in the background, so the
  panel is current when opened. Only the session whose turn ended is
  touched, in one summary language; subagent and teammate sessions are
  skipped. The session is followed until nothing is left to do, so failed
  summaries are retried and an outline overtaken by a newer summary is
  redone.
- A finished turn with no steps no longer blocks the outline.
- Unloading or replacing the plugin stops its queued model calls.

## 0.1.2 (2026-11-05)

- Work item cards start collapsed; click a card to expand it.

## 0.1.1 (2026-11-05)

- Open items no longer include the agent's own follow-up checks ("confirm
  after the restart"), things the user said are not needed, or corrections to
  the journal's own records. Summaries and outlines are recomputed once
  (summary format 3, outline format 3).

## 0.1.0 (2026-11-05)

First release.

- Right-sidebar "Work log" tab (start page card) and a session-header chip
  with the current work item and phase.
- Facts per turn from the session's event log: messages, tool calls, file
  edits with line counts, test commands and exit codes, reviews, todos.
- Per-turn summaries (phases from a fixed list, decisions, open items) and a
  session outline that groups turns into work items with status, result,
  open items and decisions. Pasted material is not taken for a request.
- Default summarizer route: each session's own provider and model;
  `SESSION_JOURNAL_PROVIDER` / `SESSION_JOURNAL_MODEL` / `SESSION_JOURNAL_EFFORT`
  override it, `SESSION_JOURNAL_MODEL=off` runs on rules only.
- Click a turn (or a card's turn range) to jump to it in the chat, through
  the chat view's own turn rail.
- Open and decided counts on every card; "Done · loose ends" when a done
  item still has open items.
- English and Chinese UI following the DSH language; summary language
  (same as UI / Chinese / English) chosen in the panel, cached per language.
