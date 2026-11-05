# Changelog

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
