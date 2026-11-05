# Contributing

Bug reports and pull requests are welcome.

## Reporting a bug

Open an [issue](https://github.com/Edison-A-N/dsh-session-journal/issues) with:

- the DSH version (`dsh --version`) and the browser,
- what the panel showed and what you expected,
- whether a summarizer model is configured (`SESSION_JOURNAL_*` variables), without any keys.

Please do not paste session content you would not want to be public.

## Making a change

```bash
pnpm install
pnpm run build   # bundles client/src into lib/client.js
pnpm test
```

- `lib/client.js` is committed because DSH loads it as-is. Rebuild it in the same commit as any change under `client/src`.
- Keep facts rule-based (`lib/collector.js`) and leave labelling to the model (`lib/summarizer.js`, `lib/outline.js`).
- UI copy goes in `client/src/locales.js`, in both `zh` and `en`.
- Add or update a test in `tests/` for behavior changes.
