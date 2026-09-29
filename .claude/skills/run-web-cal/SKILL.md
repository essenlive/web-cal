---
name: run-web-cal
description: Build, start, and drive web-cal (the Next.js calendar app) in a headless container. Use when asked to run the app, start the dev server, take a screenshot of a view, or interact with the calendar UI to verify a change.
---

web-cal is a Next.js 15 (App Router) web app — no desktop/Electron shell,
no test suite with a browser runner. There is no `chromium-cli` in this
container, so it's driven via a small Playwright-based REPL committed at
`.claude/skills/run-web-cal/driver.mjs`.

All paths below are relative to the repo root (`web-cal/`).

## Prerequisites

Playwright is already a `devDependency` (added for this skill). After a
fresh `npm install`, the Chromium binary Playwright needs is a separate
download — install it once:

```bash
npx playwright install chromium
```

No system packages were needed beyond that (headless Chromium ran fine
in this Linux container with no extra `apt-get` installs).

## Build

Not required to run the dev server. If you want to sanity-check a
production build compiles (recommended after any change):

```bash
npm run build
```

**Do not run `npm run build` while a `next dev` server is running** —
see Gotchas.

## Run (agent path)

Start the dev server in the background on a fixed port, wait for it to
respond, then pipe commands to the driver:

```bash
npx next dev --turbopack --port 3050 > /tmp/web-cal-dev.log 2>&1 &
disown
timeout 30 bash -c 'until curl -sf http://localhost:3050 >/dev/null; do sleep 1; done'
```

```bash
node .claude/skills/run-web-cal/driver.mjs <<'EOF'
nav http://localhost:3050/dev
wait-for text=Calendrier
screenshot dev-page
hover text=21
screenshot hover-21
console
EOF
```

Screenshots land in `.claude/skills/run-web-cal/shots/<name>.png` (full
page, 1400×1000 viewport). `console` prints any collected page/console
errors as JSON — always check it's `[]` before declaring success.

The driver works from any working directory — it resolves `playwright`
relative to its own file location, not the caller's cwd.

| command | what it does |
|---|---|
| `nav <url>` | Navigate, waits for `networkidle` |
| `wait-for text=<substring>` (or any selector) | Wait for the first matching element |
| `hover <selector>` | Hover the first match — this app opens some popovers on hover, not click |
| `click <selector>` | Click the first match |
| `screenshot <name>` | Full-page PNG → `shots/<name>.png` |
| `press <key>` | Keyboard press, e.g. `press w`, `press ArrowRight` |
| `back` / `forward` | Browser history navigation |
| `url` | Print the current URL |
| `console` | Print collected `pageerror`/console-error text |

There's a real, useful test route baked into the app: `/dev` (a
"Dev Preview" page). It has three scenario buttons (Standard,
Débordement, Tout-jour) that seed the month view with events exercising
overflow popovers, avatar badges, day-style backgrounds, and multi-day
bars — far more useful for visually testing calendar-grid changes than
the empty default state, which has zero events until a real calendar
connection is configured. Default scenario on load is "Débordement".

## Run (human path)

```bash
npm run dev   # → http://localhost:3000, Ctrl-C to stop
```

Useless headless — only relevant if a human has a browser.

## Test

No browser-based (Playwright) test suite exists — `playwright` here is only the
manual driver above, not a configured test runner. Component tests run on
Vitest + React Testing Library + jsdom instead:

```bash
npm test        # vitest run
npm run build   # tsc type-check, part of the Next.js build
npm run lint
```

## Gotchas

- **Never run `npm run build` while `next dev` is up.** Both write to
  the same `.next/` directory. `build` truncates/replaces manifests the
  running dev server still has open handles to, and the dev server
  starts throwing `ENOENT: .../app-build-manifest.json` and
  `_buildManifest.js.tmp.*` on every request (500s) until it's killed
  and restarted. If you need both, stop `dev`, run `build`, then
  restart `dev`.
- **`npm run dev -- -p 3050` is unreliable for picking the port** in
  this container — in one session it silently fell back to port 3000
  instead of binding 3050, leaving a stray `next-server` process on
  3000 while nothing answered on 3050. Use
  `npx next dev --turbopack --port 3050` directly (bypassing the npm
  script's arg-forwarding) — that bound the requested port reliably
  every time.
- **The real calendar view is empty by default.** `useEventsStore` only
  has events once a calendar connection syncs, or when seeded via the
  `/dev` route's scenario buttons. Don't conclude a rendering change is
  broken just because the plain `/` route shows a blank grid — check
  `/dev` with the "Débordement" scenario, which is built specifically
  to exercise overflow/avatar/day-style/multi-day rendering paths.
- **Text selectors can be ambiguous.** The `/dev` page has a component
  showcase panel on the right with its own sample chips/badges — a
  bare `text=Meeting` or similar could match the showcase instead of
  the actual calendar grid. Prefer selectors scoped to what's visually
  on the left (calendar grid is roughly `x < 1100` in the default
  viewport), or a specific unique label from seeded scenario data
  (e.g. `text=Réunion 1`) rather than a generic type name.

## Troubleshooting

- **`Cannot find module 'playwright'`**: the driver was invoked as a
  copy living outside the repo (e.g. in `/tmp`). Node resolves
  `node_modules` starting from the *script's own path*, not the
  caller's cwd — always run the committed
  `.claude/skills/run-web-cal/driver.mjs` in place, don't copy it
  elsewhere.
- **`require is not defined in ES module scope`**: `package.json` has
  `"type": "module"`, so any driver/scratch script must use `.mjs`
  (ESM `import`) or the `.cjs` extension for CommonJS `require` — a
  plain `.js` file is treated as ESM here and `require()` fails.
- **Screenshot shows a Radix `Popover`/`Dialog` mid-fade or empty**:
  add a short `wait-for` on content inside it (or a small delay) before
  `screenshot` — Radix animates open/close and a screenshot taken
  exactly on `click`/`hover` can land mid-transition.
