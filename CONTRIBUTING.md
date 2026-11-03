# Contributing

## Setup

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`npm run dev` rebuilds `dist/gui.cjs` on change. `npm run demo` serves the real panel component
with mocked host data at <http://localhost:5173>, with scenario, theme and width switches.
Point a local OpenCode Desktop install at the checkout:

```jsonc
{
  "plugins": ["file:///absolute/path/to/opencode-plugin-ask-questions-in-right-panel"]
}
```

## Layout

- `src/index.ts` — server half, declares the plugin id
- `src/gui.tsx` — GUI half: panel registration, auto-open, dock hiding
- `src/question-panel.tsx` — panel UI
- `src/forms.ts` — pure helpers; keep them free of Solid and DOM so they stay unit testable
- `src/labels.ts` — copy for both languages
- `src/styles.css` — panel styles plus the one rule that hides the host dock

## Pull requests

- Keep the change focused and describe the user-visible behavior
- Add or update tests for logic in `src/forms.ts`
- Run `npm run typecheck`, `npm test` and `npm run build` before opening the PR
- Do not patch or copy host internals; prefer public GUI plugin APIs. The single exception is the
  documented `data-component` / `data-kind` selector used to hide the bottom dock
- Mention the OpenCode Desktop version you tested with
