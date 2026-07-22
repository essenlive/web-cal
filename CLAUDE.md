# web-cal Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-07-21

## Active Technologies
- TypeScript 5.9+ / React 19.2.0 + Zustand 5.0.11, Tailwind CSS 3.4, Radix UI, lucide-react, date-fns 4.1.0, react-router 7 (002-custom-display-types)
- localStorage via Zustand persist middleware (`proton-cal:event-types`, `webcal:connections`) (002-custom-display-types)
- TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (shadcn/ui "new-york" primitives), lucide-react, date-fns 4.1.0 (003-display-type-rules-engine)
- localStorage via Zustand `persist` middleware — new key `webcal:rules`, alongside existing `proton-cal:event-types` and `webcal:connections` (003-display-type-rules-engine)

- TypeScript ~5.9.3 + React 19.2.0, Zustand 5.0.11, date-fns 4.1.0, Radix UI, Tailwind CSS 3.4, lucide-react, react-router 7 (001-cloud-calendar-connector)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript ~5.9.3: Follow standard conventions

## Recent Changes
- 003-display-type-rules-engine: Added TypeScript ~5.9.3 / React 19.2.0 + Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (shadcn/ui "new-york" primitives), lucide-react, date-fns 4.1.0
- 002-custom-display-types: Added TypeScript 5.9+ / React 19.2.0 + Zustand 5.0.11, Tailwind CSS 3.4, Radix UI, lucide-react, date-fns 4.1.0, react-router 7

- 001-cloud-calendar-connector: Added TypeScript ~5.9.3 + React 19.2.0, Zustand 5.0.11, date-fns 4.1.0, Radix UI, Tailwind CSS 3.4, lucide-react, react-router 7

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
