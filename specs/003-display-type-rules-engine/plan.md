# Implementation Plan: Display Type Rules Engine

**Branch**: `003-display-type-rules-engine` | **Date**: 2026-07-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-display-type-rules-engine/spec.md`

## Summary

Add a rules engine that resolves an event's display type by matching on event ID, calendar/connection source, or a regex/text pattern against the event title, with rules manageable from the event modal, the connection modal, and a new global rules page. Rules slot into the existing `resolveEventType()` precedence chain in `EventChip.tsx` as a new level between the per-event "custom" override and the legacy named-type/connection-level assignment — which in turn requires fixing a pre-existing bug where `multi-source-provider.ts` unconditionally stamps every ingested event as `eventTypeId: "custom"`, silently defeating both the existing (002) calendar-level assignment and this new rule engine. No new dependencies; one new Zustand store (`useRuleStore`, persisted at `webcal:rules`) following the exact pattern of the existing `useEventTypeStore`/`useConnectionStore`.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 / React 19.2.0
**Primary Dependencies**: Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (shadcn/ui "new-york" primitives), lucide-react, date-fns 4.1.0
**Storage**: localStorage via Zustand `persist` middleware — new key `webcal:rules`, alongside existing `proton-cal:event-types` and `webcal:connections`
**Testing**: No automated test runner is configured in this repo (no `test` script, no vitest/jest present); quality gates are `npx tsc -b`, `npm run lint`, `npm run build`, and manual testing per constitution — `quickstart.md` documents the manual verification steps
**Target Platform**: Browser (PWA), all modern browsers
**Project Type**: Web application (single Next.js app, client-side state only)
**Performance Goals**: Matching stays imperceptible (no dropped frames) at up to ~100 rules evaluated against several thousand rendered events (SC-005) — satisfied by a plain linear scan, no indexing needed at this scale
**Constraints**: No new dependencies; regex compiled via native `RegExp` with try/catch validation only, no complexity cap or execution timeout (per clarification session); must not alter the `CalendarEvent`/`EventType`/`Connection` schemas (additive only)
**Scale/Scope**: Single-user local config; one new store, one new module (`src/lib/rules.ts`), one new page, ~7 existing files touched

**Note on stack drift**: `.specify/memory/constitution.md` still references Vite 7 and `react-router-dom`; the repo migrated to Next.js 15 App Router in commit `5835a49` (pre-existing drift, not introduced by this feature — flagged here rather than silently worked around).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Component-First Architecture**: New `RuleModal`/`RulesPage` components are self-contained; existing `EventModal`/`AddConnectionModal` gain a single well-scoped affordance each (pre-fill + open the rule modal) rather than absorbing rule-editing logic directly.
- [x] **Type Safety**: `Rule`, `RuleMatchType` fully typed in `src/types/index.ts`; no `any` introduced (the one pre-existing `Icons as any` in `EventChip.tsx` is untouched and out of scope).
- [x] **State Management Discipline**: `useRuleStore` is a new Zustand store with `persist`, mirroring `useEventTypeStore`/`useConnectionStore` exactly. Rule matching (`src/lib/rules.ts`) is pure presentation-layer logic, not mixed into the store.
- [x] **Accessibility**: New rule rows/modals reuse existing Radix `dialog`/`switch`/`input` primitives and the Sidebar's existing row-list keyboard/focus patterns; drag-reorder needs an explicit keyboard-accessible fallback (e.g. move-up/move-down buttons) — tracked as tasks.md T013 (Phase 5, User Story 3), not deferred.
- [x] **Visual Consistency**: Tailwind + shadcn/ui "new-york" primitives already in `src/components/ui/`; no new visual language introduced.
- [x] **Data Provider Abstraction**: No `DataProvider` interface changes. The `multi-source-provider.ts` fix (research.md Decision 2) only removes an incorrect ingestion-time stamp; it does not add new provider responsibilities.
- [x] **Simplicity & YAGNI**: Array-order-is-priority (no fractional indexing), derived "broken" state (no redundant stored flag), native `RegExp` (no matching library) — see research.md Decisions 3–5 for why each simpler alternative was sufficient.
- [~] **Technology Stack**: Uses the actual current stack (React 19, TypeScript 5.9+, Next.js 15, Tailwind, Radix, Zustand, date-fns, lucide-react) — constitution text still says "Vite 7"/`react-router-dom`, a pre-existing drift from the Next.js migration (commit `5835a49`), not something introduced or fixed by this feature.
- [x] **Performance Targets**: No new network requests; rule matching is an in-memory linear scan sized for SC-005 (~100 rules × several-thousand events), well within the existing 500ms/100-event calendar-render budget.
- [x] **Security**: No new credentials or external calls. User-authored regex stays client-side; no sanitization beyond syntax validation is required (per clarification session).
- [x] **Quality Gates**: `npx tsc -b`, `npm run lint`, `npm run build`, plus manual testing per `quickstart.md` (no automated test runner exists in this repo to add unit tests to — see Technical Context).

## Project Structure

### Documentation (this feature)

```text
specs/003-display-type-rules-engine/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — entity, store, and resolution-chain definitions
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
│   └── index.ts                       ← add Rule, RuleMatchType
├── store/
│   └── index.ts                       ← add useRuleStore ("webcal:rules"); removeConnection
│                                          calls useRuleStore.removeRulesForConnection
├── lib/
│   ├── rules.ts                       ← NEW: isValidPattern, matchesRule, findMatchingRule
│   └── multi-source-provider.ts       ← fix applyConnectionMeta() (research.md Decision 2)
├── components/
│   ├── events/
│   │   ├── EventChip.tsx              ← resolveEventType() gains `rules` param + new level
│   │   └── EventModal.tsx             ← "Create a rule from this event" affordance
│   ├── settings/
│   │   ├── AddConnectionModal.tsx     ← "Create a rule for this source" affordance
│   │   └── RuleModal.tsx              ← NEW: create/edit a single rule
│   ├── calendar/
│   │   ├── MonthView.tsx              ← pass rules into resolveEventType() call sites
│   │   ├── TimeGridView.tsx           ← same
│   │   └── AgendaView.tsx             ← same
│   └── sidebar/
│       └── Sidebar.tsx                (pattern reference only — not modified; RulesPage imitates its row-list layout)
├── views/
│   └── RulesPage.tsx                  ← NEW: global rules list (reorder, toggle, edit, delete)
└── app/
    └── settings/
        └── rules/
            └── page.tsx               ← NEW route rendering RulesPage
```

**Structure Decision**: Single Next.js project, no new top-level directories. All changes live inside the existing `src/` tree, following the same file organization established by the 001/002 features (types → store → lib → components → views → app routes).

## Complexity Tracking

No unjustified constitution violations. The one partial item (Technology Stack constitution text vs. actual Next.js stack) is pre-existing drift from an earlier migration, not a violation introduced by this feature — see Technical Context "Note on stack drift".

---

## Amendment (2026-07-22): Read-Only Sources & Mandatory Rule Resolution

### Summary

Removes the two backward-compatibility mechanisms the base feature deliberately preserved (per-event custom styling, `connection.displayTypeId`) now that the rule engine is proven, makes rule resolution mandatory via a non-deletable catch-all rule, deletes event creation/editing entirely (sources are read-only), replaces the hand-rolled ICS parser with `ical.js`, adds a searchable combobox for event/source rule targets, and surfaces which rule (and priority) styled each event. Net effect on the codebase is a deletion — `EventModal.tsx`'s edit/create form and the multi-level fallback chain in `resolveEventType()` both go away; what's added is smaller than what's removed.

### Constitution re-check (amendment)

- **Simplicity & YAGNI**: This amendment is net negative LOC in the resolution chain (research.md Decision 10) and deletes a whole feature surface (event editing) rather than adding one — strongly aligned.
- **Technology Stack / no new dependencies**: One explicit, justified exception — `ical.js` (research.md Decision 8). No other new dependency; the combobox (Decision 9) is built on already-installed `@radix-ui/react-popover`.
- **Data Provider Abstraction**: `DataProvider.createEvent`/`updateEvent` (wherever declared in the provider interface) are removed, not stubbed — no provider is expected to support them, so keeping dead methods on the interface would violate YAGNI in the other direction.
- Other gates unchanged from the base feature's Constitution Check above.

### Source Code changes (amendment)

```text
src/
├── types/
│   └── index.ts                       ← RuleMatchType gains "all"; remove CalendarEvent
│                                          custom* fields; remove Connection.displayTypeId
├── store/
│   └── index.ts                       ← useRuleStore seeds one matchType:"all" rule;
│                                          removeRule/toggleRule/reorderRule guard it;
│                                          useEventTypeStore.removeType blocks deleting the
│                                          catch-all's target; useUIStore.defaultEventTypeId removed
├── lib/
│   ├── rules.ts                       ← findMatchingRule returns Rule (not | undefined);
│   │                                     drops the isBroken callback param, takes getType directly
│   └── webcal-provider.ts             ← parseICS/icsDateToISO/parseICSValue replaced by ical.js
├── components/
│   ├── events/
│   │   ├── EventModal.tsx             ← DELETED (create/edit form + custom-style editor)
│   │   └── EventDetail.tsx            ← NEW: read-only view; keeps the "create a rule from
│   │                                     this event" shortcut; adds applied-rule + priority display
│   ├── settings/
│   │   ├── AddConnectionModal.tsx     ← remove DisplayTypePicker/displayTypeId field;
│   │   │                                 keep "create a rule for this source" shortcut
│   │   └── RuleModal.tsx              ← matchValue field for "event"/"source" becomes
│   │                                     the new Combobox instead of a raw-ID Input
│   ├── ui/
│   │   └── combobox.tsx               ← NEW: single-select searchable combobox (Popover-based)
│   └── calendar/
│       ├── MonthView.tsx              ← onSlotClick (create) removed; onEventClick opens EventDetail
│       ├── TimeGridView.tsx           ← same
│       └── AgendaView.tsx             ← same
└── views/
    └── RulesPage.tsx                  ← catch-all row pinned last, non-deletable, non-draggable,
                                          only its display type is editable
```

### Sequencing

1. Types + store (catch-all seeding/guards) + `rules.ts` signature change — everything else depends on this.
2. Collapse `resolveEventType()` and its call sites (research.md Decision 10) together with deleting `EventModal.tsx` → `EventDetail.tsx` and the connection display-type field — these three are one connected change (same as the original planning discussion identified).
3. `RulesPage.tsx` catch-all pinning, applied-rule/priority surfacing in `EventDetail.tsx`, the `Combobox` component, and the `ical.js` swap are independent of each other and of step 2's internals (only depend on step 1).
