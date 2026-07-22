# Implementation Plan: Quick Hide

**Branch**: `004-quick-hide` | **Date**: 2026-07-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-quick-hide/spec.md`

## Summary

Add a `hidden?: boolean` field to the existing `EventType` and `Connection` (`WebCalConnection`/`CalDAVConnection`) records, toggleable via the existing `updateType`/`updateConnection` store actions (no new store, no new persist key, no migration needed — `hidden` is simply `undefined`/falsy on any already-persisted record). Add one pure filter helper, `isEventHidden()`, next to the existing `resolveEventType()`/`resolveStyle()` helpers in `EventChip.tsx`, and apply it in the three calendar views (`MonthView`, `TimeGridView`, `AgendaView`) to drop hidden events before layout. Add a compact "Sources & Types" quick-toggle section to `Sidebar.tsx` (the always-visible calendar chrome) and a per-row hide/show icon button to the existing `ConnectionList.tsx` row and `SettingsPage.tsx`'s `EventTypeRow`, all using the already-installed `Eye`/`EyeOff` lucide icons. No new dependencies, no new components beyond one small presentational row list in the sidebar.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 / React 19.2.0
**Primary Dependencies**: Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, lucide-react, date-fns 4.1.0
**Storage**: localStorage via Zustand `persist` middleware — reuses the existing `webcal:connections` and `proton-cal:event-types` keys (adds a field to already-persisted records; no new key, no migration function needed since a missing `hidden` field is simply falsy)
**Testing**: No automated test runner is configured in this repo (no `test` script, no vitest/jest present); quality gates are `npx tsc -b`, `npm run lint`, `npm run build`, and manual testing per constitution — `quickstart.md` documents the manual verification steps
**Target Platform**: Browser (PWA), all modern browsers
**Project Type**: Web application (single Next.js app, client-side state only)
**Performance Goals**: No measurable perf target beyond the existing constitution budget (calendar render < 500ms for 100 events) — filtering is a single `Array.prototype.filter` pass over already-fetched events, negligible relative to existing render work
**Constraints**: No new dependencies; must not alter the persisted shape of existing records beyond adding one optional field (backward compatible with data written by earlier versions of the app); hiding is display-only and must never touch `DataProvider`/fetch logic or delete/mutate any other field
**Scale/Scope**: Single-user local config; one new pure function (`isEventHidden` in `EventChip.tsx`), one new presentational block in `Sidebar.tsx`, small additive edits to 5 existing files

**Note on stack drift**: `.specify/memory/constitution.md` still references Vite 7 and `react-router-dom`; the repo migrated to Next.js 15 App Router in an earlier commit (pre-existing drift, not introduced by this feature — flagged here rather than silently worked around, matching how prior feature plans on this repo have handled the same drift).

**Note on branch base**: This feature branches from `003-display-type-rules-engine`'s current committed state, which includes the 001/002 connection-management and event-type scaffolding (`AddConnectionModal`, `ConnectionList`, `BackendSettings`, the 4-level `resolveEventType()` precedence chain) but does not include any rules-engine code — that work is not present in this branch's history. This plan targets the codebase as it actually exists on this branch, not a hypothetical post-rules-engine state.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Component-First Architecture**: New `VisibilitySection`/`VisibilityRow` is a small, self-contained presentational block added to `Sidebar.tsx`; existing `ConnectionRow` and `EventTypeRow` each gain one well-scoped icon-button, not new responsibilities.
- [x] **Type Safety**: `hidden?: boolean` is fully typed on `EventType`, `WebCalConnection`, `CalDAVConnection`; `isEventHidden()` has explicit typed parameters and return type; no `any` introduced.
- [x] **State Management Discipline**: No new store — reuses the existing `useConnectionStore`/`useEventTypeStore` `persist`-backed stores and their existing `updateConnection`/`updateType` actions. State updates remain immutable (spread + field override, matching existing action implementations).
- [x] **Accessibility**: Toggle buttons are real `<button>` elements with `aria-label`/`title` reflecting current state (e.g. "Hide Work Calendar" / "Show Work Calendar"), keyboard-focusable and operable like the existing Edit2/Trash2 icon buttons they sit beside.
- [x] **Visual Consistency**: Reuses existing Tailwind utility patterns (icon-button `p-1.5 rounded-lg hover:bg-muted text-muted-foreground`, dimmed-row `opacity-50`) already established in `EventTypeRow`/`ConnectionRow`/`Header`; no new visual language, no new UI primitive library.
- [x] **Data Provider Abstraction**: No `DataProvider` interface changes; hiding never touches fetch/provider logic, only render-time filtering of already-fetched events.
- [x] **Simplicity & YAGNI**: No new store, no new persist key, no new toggle actions (reuses `updateConnection`/`updateType`), no new dependency, one filter function instead of duplicating the same predicate three times across views — see research.md Decisions 1, 2, 4 for the simpler alternatives chosen over more elaborate ones.
- [~] **Technology Stack**: Uses the actual current stack (React 19, TypeScript 5.9+, Next.js 15, Tailwind, Zustand, date-fns, lucide-react) — constitution text still says "Vite 7"/`react-router-dom`, pre-existing drift from an earlier migration (see Technical Context note), not introduced or fixed by this feature.
- [x] **Performance Targets**: No new network requests; filtering is O(n) over already-fetched events, well within the existing 500ms/100-event render budget.
- [x] **Security**: No new credentials, no new external calls, no change to what's stored — `hidden` is a plain boolean alongside data already in localStorage.
- [x] **Quality Gates**: `npx tsc -b`, `npm run lint`, `npm run build`, plus manual testing per `quickstart.md` (no automated test runner exists in this repo to add unit tests to).

## Project Structure

### Documentation (this feature)

```text
specs/004-quick-hide/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md         # Phase 1 — entity and filter-contract definitions
├── quickstart.md        # Phase 1 — manual verification steps
├── contracts/
│   └── ui-contracts.md  # Phase 1 — TypeScript interface contracts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                       ← add `hidden?: boolean` to EventType,
│                                          WebCalConnection, CalDAVConnection
├── components/
│   ├── events/
│   │   └── EventChip.tsx              ← NEW export: isEventHidden()
│   ├── calendar/
│   │   ├── MonthView.tsx              ← filter events via isEventHidden()
│   │   ├── TimeGridView.tsx           ← same
│   │   └── AgendaView.tsx             ← same
│   ├── settings/
│   │   └── ConnectionList.tsx         ← add hide/show icon-button to ConnectionRow
│   └── sidebar/
│       └── Sidebar.tsx                ← NEW: "Sources & Types" quick-toggle section
└── views/
    └── SettingsPage.tsx               ← add hide/show icon-button to EventTypeRow
```

**Structure Decision**: Single Next.js project, no new top-level directories, no new files beyond documentation — every change lives inside already-existing `src/` files, following the same organization as the 001/002/003 features (types → components → views).

## Complexity Tracking

No unjustified constitution violations. The one partial item (Technology Stack constitution text vs. actual Next.js stack) is pre-existing drift from an earlier migration, not a violation introduced by this feature — see Technical Context "Note on stack drift".
