# web-cal Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-11-15

## Active Technologies
- TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, lucide-react — no new dependency (no Radix needed; see research.md Decision 3) (006-view-presets)
- localStorage via Zustand `persist` middleware — new key `webcal:presets`, alongside existing `proton-cal:ui`, `proton-cal:event-types`, `proton-cal:themes`, `webcal:connections`, `webcal:rules` (006-view-presets)
- TypeScript ~5.9.3, React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, `@radix-ui/react-dialog` (existing dependency, reused to build a `Sheet` primitive), lucide-react — no new dependency (007-settings-side-drawer)
- localStorage via Zustand `persist` middleware — no new persisted key; the drawer's "which panel is open" state is transient UI state added to the existing `useUIStore` and excluded from its `partialize`, same pattern already used there for other non-persisted fields (007-settings-side-drawer)
- TypeScript ~5.9.3, React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11 (existing stores only — no new store added, see research.md Decision A), date-fns 4.1.0 (interval/range math), lucide-react (spinner/error icons for `SyncIndicator`) — no new dependency (008-events-perf-caching)
- No new persisted key. The event cache, sync state, and resolved-event map are all session-only/in-memory (see spec.md Assumptions and data-model.md) — `useEventsStore` gains one new non-persisted field (`hasLoadedOnce`), consistent with that store already being unpersisted. (008-events-perf-caching)
- TypeScript ~5.9 (Node.js 20+ runtime) — same language as the existing client, new server runtime target + Next.js App Router route handlers (reused from the existing app, one deployable unit); `ical.js` (already a dependency) also writes the RFC 5545 `.ics` feeds; calendar endpoints read/written through our own connectors (ICS read-only, CalDAV read+create via `tsdav`, replacing keeper.sh — see specs/009 revision of 2026-11-15); `better-sqlite3` for the config/feed-token store (new dependency, justified by `docs/planning/server-sync-architecture.md`'s own "commencer en SQLite" default: file-based, no extra service to run in the self-hosted container, synchronous API fits a small single-process aggregation job) (009-server-ics-presets)
- SQLite (one file) — holds the imported sources/types/rules/presets configuration, one opaque feed token per preset, and the last-aggregated-events snapshot per source (refreshed each aggregation cycle; feed requests are always served from this snapshot, never trigger a live fetch) (009-server-ics-presets)

- TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (`@radix-ui/react-popover`, `@radix-ui/react-dialog` — both already dependencies), lucide-react (005-global-theming)
- localStorage via Zustand `persist` middleware — new key `proton-cal:themes`, alongside existing `proton-cal:ui`, `proton-cal:event-types`, `webcal:connections` (005-global-theming)
- TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, lucide-react, date-fns 4.1.0 (004-quick-hide)
- localStorage via Zustand `persist` middleware — reuses the existing `webcal:connections` and `proton-cal:event-types` keys (adds a field to already-persisted records; no new key, no migration function needed since a missing `hidden` field is simply falsy) (004-quick-hide)
- TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (shadcn/ui "new-york" primitives), lucide-react, date-fns 4.1.0 (003-display-type-rules-engine)
- localStorage via Zustand `persist` middleware — new key `webcal:rules`, alongside existing `proton-cal:event-types` and `webcal:connections` (003-display-type-rules-engine)
- TypeScript 5.9+ / React 19.2.0 + Zustand 5.0.11, Tailwind CSS 3.4, Radix UI, lucide-react, date-fns 4.1.0, react-router 7 (002-custom-display-types)
- localStorage via Zustand persist middleware (`proton-cal:event-types`, `webcal:connections`) (002-custom-display-types)
- TypeScript ~5.9.3 + React 19.2.0, Zustand 5.0.11, date-fns 4.1.0, Radix UI, Tailwind CSS 3.4, lucide-react, react-router 7 (001-cloud-calendar-connector)

## Project Structure

```text
src/
  app/          # Next.js App Router — routes only
  views/        # route-level components (CalendarPage, SettingsPage, RulesPage)
  components/   # calendar/, events/, settings/, sidebar/, ui/
  context/      # DataProviderContext
  lib/          # data providers, rules engine, theme resolution
  store/        # Zustand stores (persisted via localStorage)
  types/        # shared TypeScript types
specs/          # Spec Kit feature specs (spec/plan/data-model/tasks per feature)
```

## Commands

npm run dev && npm run build && npm run lint && npm test

## Code Style

TypeScript ~6.0.3: Follow standard conventions

## Recent Changes
- 009-server-ics-presets: Added TypeScript ~5.9 (Node.js 20+ runtime) — same language as the existing client, new server runtime target + Next.js App Router route handlers (reused from the existing app, one deployable unit); `ical.js` (already a dependency) also writes the RFC 5545 `.ics` feeds; calendar endpoints read/written through our own connectors (ICS read-only, CalDAV read+create via `tsdav`, replacing keeper.sh — see specs/009 revision of 2026-11-15); `better-sqlite3` for the config/feed-token store (new dependency, justified by `docs/planning/server-sync-architecture.md`'s own "commencer en SQLite" default: file-based, no extra service to run in the self-hosted container, synchronous API fits a small single-process aggregation job)
- 008-events-perf-caching: Added TypeScript ~5.9.3, React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11 (existing stores only — no new store added, see research.md Decision A), date-fns 4.1.0 (interval/range math), lucide-react (spinner/error icons for `SyncIndicator`) — no new dependency
- Dependency update: Next.js 15→16, Tailwind CSS 3→4 (config moved from `tailwind.config.js` into `src/app/globals.css` as `@theme`), TypeScript 5.9→6.0, lucide-react 0→1, eslint 9→10, plus in-range patch/minor bumps across the rest. See [TODO.md](TODO.md) for what was deliberately skipped and why.

<!-- MANUAL ADDITIONS START -->

For the full architecture (persistence, event sync, rules engine, quick hide, theming), see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Unscheduled feature ideas live in [TODO.md](TODO.md).

<!-- MANUAL ADDITIONS END -->
