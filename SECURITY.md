# Security Policy

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/Edison-A-N/dsh-session-journal/security/advisories/new)
rather than a public issue.

Relevant areas:

- The `/plugins/session-journal/api/journal` route. It must stay behind
  DSH's login check (the same one as the Web UI itself) and accept only
  well-formed session ids. It reads sessions through DSH's own session query
  service, so it exposes nothing a logged-in Web UI user could not already
  open.
- The cache under `$DSH_HOME/storages/session-journal/`. Files are written
  with mode `0600`; session ids are validated before they become file names.
- Model calls. Summaries send the session's messages and tool activity to
  the configured model route, the same route the session itself uses unless
  `SESSION_JOURNAL_PROVIDER` / `SESSION_JOURNAL_MODEL` point elsewhere.

Only the latest release is supported.
