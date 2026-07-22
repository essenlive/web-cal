# web-cal Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-07-22

## Active Technologies

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
  views/        # route-level components (CalendarPage, SettingsPage, RulesPage, DevPage)
  components/   # calendar/, events/, settings/, sidebar/, ui/
  context/      # DataProviderContext
  lib/          # data providers, rules engine, theme resolution
  store/        # Zustand stores (persisted via localStorage)
  types/        # shared TypeScript types
specs/          # Spec Kit feature specs (spec/plan/data-model/tasks per feature)
```

## Commands

npm run dev && npm run build && npm run lint

## Code Style

TypeScript ~5.9.3: Follow standard conventions

## Recent Changes
- 005-global-theming: Added TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (`@radix-ui/react-popover`, `@radix-ui/react-dialog` — both already dependencies), lucide-react
- 004-quick-hide: Added TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, lucide-react, date-fns 4.1.0
- 003-display-type-rules-engine: Added TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (shadcn/ui "new-york" primitives), lucide-react, date-fns 4.1.0
- 002-custom-display-types: Added TypeScript 5.9+ / React 19.2.0 + Zustand 5.0.11, Tailwind CSS 3.4, Radix UI, lucide-react, date-fns 4.1.0, react-router 7
- 001-cloud-calendar-connector: Added TypeScript ~5.9.3 + React 19.2.0, Zustand 5.0.11, date-fns 4.1.0, Radix UI, Tailwind CSS 3.4, lucide-react, react-router 7

<!-- MANUAL ADDITIONS START -->

For the full architecture (persistence, event sync, rules engine, quick hide, theming), see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Unscheduled feature ideas live in [TODO.md](TODO.md).

<!-- MANUAL ADDITIONS END -->
