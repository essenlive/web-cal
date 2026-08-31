# web-cal

A personal calendar app built with Next.js + TypeScript. Merges events from multiple ICS/WebCal feeds (or local demo data) into one calendar, with per-event-type visual customisation, rule-based styling, quick-hide, and per-user themes.

Everything runs client-side — no backend database, all state lives in `localStorage`.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript 6
- Tailwind CSS 4 + Radix UI + lucide-react
- Zustand (persist middleware)
- date-fns

## Development

```bash
npm install
npm run dev     # next dev --turbopack
npm run build   # next build (ESLint gate disabled — see next.config.ts; run `npm run lint` separately)
npm run start   # serve the production build
npm run lint
```

## Learn more

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — global architecture, persistence, and how each building block (event sync, display types, rules engine, quick hide, theming) works, linked to the spec that introduced it.
- [specs/](specs) — one folder per feature (spec, plan, data model, tasks), managed via [Spec Kit](.specify).
- [TODO.md](TODO.md) — backlog of ideas not yet turned into a spec.
