# Implementation Plan: Events Performance & Sync Feedback

**Branch**: `008-events-perf-caching` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-events-perf-caching/spec.md`

## Summary

Overhaul the event pipeline end to end without changing any observable display/rules/theming behavior: (1) a session-only, per-connection **range cache** in `DataProviderContext` that serves already-fetched date ranges instantly and only fetches the uncovered delta (`src/lib/event-cache.ts`), with a 5-minute staleness TTL that triggers a non-blocking background refresh of the currently-viewed window (stale-while-revalidate); (2) a **shared, memoized rules-resolution hook** (`useResolvedEvents()`) so `resolveEventType`/`isEventHidden` run once per real data change instead of once per event per render per view; (3) **day-bucketing + `React.memo`** in `MonthView`/`TimeGridView`/`AgendaView` so rendering cost is `O(events)` instead of `O(days × events)` and local UI state changes don't re-render the whole grid; (4) a new, minimal **`SyncIndicator`** in the header (idle/syncing/error, derived from the existing per-connection status map — never a parallel source of truth) plus a **first-load skeleton**, both additive to the existing sidebar status dots and "last updated" timestamp. Along the way, this plan also fixes a pre-existing correctness bug found during research: editing a connection's URL/proxy today silently keeps fetching the old configuration because `DataProviderContext`'s provider-recreation key only tracks connection *ids*, not their fetch-relevant fields — required to correctly satisfy the spec's cache-invalidation-on-edit requirement (FR-005; research.md Decision E).

## Technical Context

**Language/Version**: TypeScript ~5.9.3, React 19.2.0
**Primary Dependencies**: Next.js 15.5 (App Router), Zustand 5.0.11 (existing stores only — no new store added, see research.md Decision A), date-fns 4.1.0 (interval/range math), lucide-react (spinner/error icons for `SyncIndicator`) — no new dependency
**Storage**: No new persisted key. The event cache, sync state, and resolved-event map are all session-only/in-memory (see spec.md Assumptions and data-model.md) — `useEventsStore` gains one new non-persisted field (`hasLoadedOnce`), consistent with that store already being unpersisted.
**Testing**: No automated test framework in this repo (`package.json` scripts: `dev`/`build`/`lint` only, matching prior specs e.g. `007-settings-side-drawer`) — verified manually per `quickstart.md`, run against `npm run dev` with the seeded demo source and at least one real `.ics` feed, plus `tsc -b`/`npm run build`/`npm run lint` as the enforced gates.
**Target Platform**: Web (desktop + mobile browsers), no platform-specific work — this feature touches data-flow and rendering internals, not layout/responsiveness.
**Project Type**: Single Next.js web app (no frontend/backend split).
**Performance Goals**: Repeat navigation within a cached range updates in <100ms with no visible loading state (SC-001); month-view render stays well under the constitution's existing 500ms/100-events target, now with materially less work per render (Decisions F–H).
**Constraints**: MUST NOT change the `DataProvider` interface (`getEvents(start, end): Promise<CalendarEvent[]>`) — see research.md Decision D for why `AbortController`/signal threading was deliberately rejected. MUST NOT change any display type, rule-matching semantics, quick-hide behavior, theming, or multi-source merge/namespacing behavior documented in `docs/ARCHITECTURE.md` (FR-014) — this is a performance/feedback refactor of *how* existing results get computed and shown, not a change to *what* they are.
**Scale/Scope**: Two new files (`src/lib/event-cache.ts`, `src/hooks/useResolvedEvents.ts`), two new small UI components (`SyncIndicator`, `CalendarSkeleton`), and edits to `DataProviderContext.tsx`, `lib/rules.ts`, `store/index.ts`, `Header.tsx`, `CalendarPage.tsx`, and the three calendar view components (`MonthView.tsx`, `TimeGridView.tsx`, `AgendaView.tsx`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Component-First Architecture**: New UI is two small, single-responsibility components (`SyncIndicator`, `CalendarSkeleton`); non-UI logic (cache, resolution) lives in a lib module and a hook, not inlined into view components.
- [x] **Type Safety**: `ConnectionCacheEntry`, `SyncState`, `ResolvedEvent` (data-model.md) are all explicit interfaces/types in `src/types/` or colocated with their module; no `any`. `SyncState` is a string-literal union (`"idle" | "syncing" | "error"`), matching the existing `ConnectionStatus` union style.
- [x] **State Management Discipline**: Cache/sync-state stay local to `DataProviderContext` (research.md Decision A) rather than becoming a new global store, matching the existing `statusMap` pattern; `useEventsStore`'s one new field (`hasLoadedOnce`) is an immutable `set()` update like its existing fields. Rules resolution is derived (`useMemo`), never stored.
- [x] **Accessibility**: `SyncIndicator`'s syncing/error states use `aria-live="polite"` text (not color alone) so screen-reader users get the same state change sighted users see; icons carry `aria-label`. `CalendarSkeleton` is marked `aria-busy`/`aria-hidden` appropriately so it doesn't announce as real content.
- [x] **Visual Consistency**: `SyncIndicator`/`CalendarSkeleton` use Tailwind + existing `text-muted-foreground`/`bg-muted` tokens, no inline styles beyond what the codebase already does for dynamic event colors (unrelated to this feature).
- [x] **Data Provider Abstraction**: `DataProvider.getEvents(start, end)` interface is unchanged (research.md Decision D) — the cache sits entirely on the *caller* side of that interface, inside `DataProviderContext`, never inside a provider implementation.
- [x] **Simplicity & YAGNI**: No new dependency. No new Zustand store. No LRU/eviction machinery (session-only cache is enough per spec.md Assumptions). No `AbortController`/signal plumbing (research.md Decision D). The one "extra" fix (Decision E) is the minimum change needed for FR-005 to actually hold, not scope creep.
- [x] **Technology Stack**: No deviation — Next.js/Zustand/Tailwind/date-fns/lucide-react, all already-approved/in-use (per CLAUDE.md's actual stack; the constitution's Vite/react-router listing predates the Next.js migration recorded in CLAUDE.md's Recent Changes and is already superseded in every prior plan under `specs/`, consistent with this one).
- [x] **Performance Targets**: This feature exists specifically to bring navigation well under the constitution's 500ms/100-events render target and the spec's own <100ms cached-navigation target (SC-001) — a direct improvement, not a risk to this gate.
- [x] **Security**: N/A — no credentials, secrets, or CORS-proxy behavior touched. `fetchKey` (research.md Decision E) includes `username`/`password` only as an opaque hash input to detect config changes, never logged, displayed, or stored anywhere new.
- [x] **Quality Gates**: Verified via `npm run build`, `npm run lint`, `tsc -b`, plus the manual pass in `quickstart.md` (no automated test framework exists in this repo — see Testing above).

## Project Structure

### Documentation (this feature)

```text
specs/008-events-perf-caching/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md         # Phase 1 output (/speckit.plan command)
├── quickstart.md         # Phase 1 output (/speckit.plan command)
├── contracts/            # SKIPPED — no external interface; DataProvider stays unchanged (research.md Decision D)
└── tasks.md               # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
  lib/
    event-cache.ts          # NEW — ConnectionCacheEntry, gap computation, range merge, fetchKey hashing (data-model.md, research.md Decisions B/D/E)
    rules.ts                 # EDIT — per-rule compiled RegExp cache, rebuilt only when `rules` array changes (research.md Decision F)
  hooks/
    useResolvedEvents.ts     # NEW — single memoized Map<eventId, ResolvedEvent> shared by all three calendar views (research.md Decision F)
  context/
    DataProviderContext.tsx  # EDIT — integrates event-cache.ts; fixes connectionKey (research.md Decision E); exposes
                              #        isBackgroundRefreshing + derived SyncState alongside existing statusMap/lastUpdated/refresh
  store/
    index.ts                 # EDIT — useEventsStore gains `hasLoadedOnce: boolean` (data-model.md)
  components/
    sidebar/
      Header.tsx              # EDIT — mounts <SyncIndicator />
      SyncIndicator.tsx        # NEW — idle/syncing/error, derived only (research.md Decision I)
    calendar/
      CalendarGrid.tsx         # EDIT — renders <CalendarSkeleton /> instead of the view switcher while !hasLoadedOnce && loading
      CalendarSkeleton.tsx     # NEW — first-load-only placeholder grid (research.md Decision J)
      MonthView.tsx             # EDIT — day-bucketing useMemo, React.memo on DayCell, consumes useResolvedEvents() (research.md Decisions F/G/H)
      TimeGridView.tsx          # EDIT — same bucketing/memoization/shared-hook treatment
      AgendaView.tsx            # EDIT — same
    events/
      EventChip.tsx             # EDIT — resolveEventType/isEventHidden remain as pure functions (used internally by useResolvedEvents());
                                  #        views stop calling them directly per-event (research.md Decision F)
```

**Structure Decision**: Single Next.js project (existing `src/` layout per CLAUDE.md, no new top-level directories). `src/hooks/` is a new directory — the codebase currently has no shared-hooks folder (hooks live inline or as store selectors); `useResolvedEvents()` is the first cross-view hook, justified because it's consumed identically by all three calendar views (not a one-off). No `tests/` directory — this repo has no automated test framework (manual verification via `npm run dev`/`build`/`lint`, per CLAUDE.md Commands and every prior spec's convention).

## Complexity Tracking

*No constitution violations — this section is intentionally empty. The one deviation worth flagging is not a violation: this plan fixes a pre-existing bug (research.md Decision E) as a required prerequisite for FR-005, not as unrelated scope creep — it's the minimum change that makes "editing a connection invalidates its cache" actually true.*
