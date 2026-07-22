# Tasks: Display Type Rules Engine

**Input**: Design documents from `/specs/003-display-type-rules-engine/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated (no automated test runner exists in this repo; verification is via `quickstart.md` and the quality gates in Polish).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup

*No setup needed — this feature extends existing files and adds one new store, one new module, and one new view + route, all using already-installed dependencies. Proceed to Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `Rule` type, its store, its matching logic, and the extended resolution chain that every entry point (event modal, connection modal, global page) and every calendar view render through. Nothing in any user story is observable until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] Add `RuleMatchType` and `Rule` interface to `src/types/index.ts` per `data-model.md` (`id`, `matchType: "event" | "name" | "source"`, `matchValue`, `displayTypeId`, `enabled`, `createdAt`)
- [x] T002 Add `useRuleStore` to `src/store/index.ts`, persisted at key `webcal:rules`, following the exact `create()(persist(...))` pattern already used by `useEventTypeStore`/`useConnectionStore`: state `rules: Rule[]` (empty default) and actions `addRule` (inserts at the default tier position — event-id rules above name-pattern rules above source rules, newest-first within a tier, per `research.md` Decision 3), `updateRule`, `removeRule`, `reorderRule(id, toIndex)`, `toggleRule(id)`; also update `useConnectionStore.removeConnection` in the same file to call a new `removeRulesForConnection(connectionId)` action so source rules are deleted when their connection is (FR-012) (depends on T001)
- [x] T003 [P] Create `src/lib/rules.ts` with `isValidPattern(pattern: string): boolean` (wraps `new RegExp(pattern, "i")` in try/catch), `matchesRule(event: CalendarEvent, rule: Rule): boolean` (switches on `rule.matchType` — `"event"` compares `event.id`, `"source"` compares `event.calendarId`, `"name"` does `new RegExp(rule.matchValue, "i").test(event.title)`), and `findMatchingRule(event, rules, isBroken): Rule | undefined` (first enabled, non-broken match in array order) (depends on T001)
- [x] T004 [P] Fix `applyConnectionMeta()` in `src/lib/multi-source-provider.ts`: stop unconditionally setting `eventTypeId: "custom"` and `customColor: conn.color` on every ingested event — leave the provider's own `eventTypeId` untouched (per `research.md` Decision 2); keep the `id` namespacing logic unchanged
- [x] T005 Extend `resolveEventType()` in `src/components/events/EventChip.tsx`: add a `rules?: Rule[]` parameter inserted before `defaultTypeId`; after the existing Level 1 (`eventTypeId === "custom"`) check, add a new Level 2 that calls `findMatchingRule(event, rules, (rule) => !getType(rule.displayTypeId))` from `src/lib/rules.ts` — passing that `isBroken` predicate so a matched rule whose display type was deleted is skipped and evaluation falls through to the next matching rule or past Level 2 entirely — and returns `getType(matchedRule.displayTypeId)` when a non-broken match is found; after the existing named-type (Level 3) and `connection.displayTypeId` (Level 4) checks, add a new Level 5 that returns a virtual custom type built from `getConnection(event.calendarId)?.color` (restoring the coloring `applyConnectionMeta` used to do at ingestion time) before falling through to the existing Level 6 default-type check (depends on T002, T003, T004)
- [x] T006 [P] Update `resolveEventType()` call sites in `src/components/calendar/MonthView.tsx` to pass `useRuleStore().rules` as the new `rules` argument — call the hook directly in the component body (not `useRuleStore.getState()`) so the view re-renders whenever rules change, per FR-011 (depends on T005)
- [x] T007 [P] Update `resolveEventType()` call sites in `src/components/calendar/TimeGridView.tsx` to pass `useRuleStore().rules` as the new `rules` argument — call the hook directly in the component body (not `useRuleStore.getState()`) so the view re-renders whenever rules change, per FR-011 (depends on T005)
- [x] T008 [P] Update `resolveEventType()` call sites in `src/components/calendar/AgendaView.tsx` to pass `useRuleStore().rules` as the new `rules` argument — call the hook directly in the component body (not `useRuleStore.getState()`) so the view re-renders whenever rules change, per FR-011 (depends on T005)

**Checkpoint**: `npx tsc -b` compiles with zero errors. A connection with a color but no rules still colors its events (regression check from `quickstart.md` §4). No user-visible rule behavior yet — that starts with User Story 1.

---

## Phase 3: User Story 1 - Style Recurring-by-Name Events from the Event Modal (Priority: P1) 🎯 MVP

**Goal**: From any event's modal, a user can create a rule — matching either the event's title (regex/text) or that exact event only — and pick a display type; every existing and future matching event renders with it immediately.

**Independent Test**: Open any event, create a name-match rule with a chosen display type, and verify every event (current and future) whose title matches renders with that display type. Confirm an invalid regex is rejected with an explanation.

### Implementation for User Story 1

- [x] T009 [P] [US1] Create `src/components/settings/RuleModal.tsx`: a dialog (reuse existing `src/components/ui/dialog.tsx`) with a match-type selector (`event` / `name` / `source`), a `matchValue` input (editable text field; for `name` it doubles as the regex/text pattern), and a display-type picker (reuse the type-picker pattern from `src/components/events/EventModal.tsx:161-191`); on save, validate via `isValidPattern()` for `name` rules (reject with an inline error otherwise, FR-007) and reject exact duplicates by checking existing `useRuleStore().rules` for the same `(matchType, matchValue, displayTypeId)` triple (FR-008), then call `addRule` or `updateRule`; accept optional props to lock/pre-fill `matchType` and `matchValue` for the entry-point flows below
- [x] T010 [US1] Add a "Create a rule from this event" action to `src/components/events/EventModal.tsx` that opens `RuleModal` twice-purposed: pre-filled with `matchType: "name"`, `matchValue: event.title` (editable) as the primary action, and a secondary "just this event" option pre-filled with `matchType: "event"`, `matchValue: event.id` (depends on T009)

**Checkpoint**: Creating a rule from an event modal immediately restyles every matching event across all calendar views (verified via Foundational's Level 2 wiring). This is a fully demoable MVP on its own.

---

## Phase 4: User Story 2 - Style All Events from a Calendar Source (Priority: P2)

**Goal**: From a calendar/connection's settings, a user can create a rule assigning a display type to every event from that source.

**Independent Test**: Open a connection's settings, create a source rule with a display type, and verify all events from that source render with it while other sources are unaffected. Delete the connection and verify the rule disappears too.

### Implementation for User Story 2

- [x] T011 [US2] Add a "Create a rule for this source" action to `src/components/settings/AddConnectionModal.tsx` that opens `RuleModal` pre-filled with `matchType: "source"`, `matchValue: connection.id` (depends on T009)

**Checkpoint**: Source-wide rules work end-to-end, and deleting the connection cleans up its rule (already wired in Foundational T002/FR-012).

---

## Phase 5: User Story 3 - Manage All Rules from a Global Page (Priority: P3)

**Goal**: A dedicated page lists every rule regardless of origin, showing match type, target display type, and priority; users can reorder, enable/disable, edit, or delete any rule from it.

**Independent Test**: Create rules from the other two entry points, open the global page, verify all appear, and confirm reordering, disabling, editing, and deleting each work and take effect immediately.

### Implementation for User Story 3

- [x] T012 [US3] Create `src/views/RulesPage.tsx`: list `useRuleStore().rules` in priority order, each row showing match type + resolved match description (event title via `useEventsStore`, connection name via `useConnectionStore`, or the raw pattern), target display type's name/color/icon via `useEventTypeStore().getType`, and a "broken" indicator when `getType(rule.displayTypeId)` is `undefined`; reuse the row-list visual pattern from `src/components/sidebar/Sidebar.tsx` (`ConnectionRow`/`TypeRow`)
- [x] T013 [US3] Add drag-to-reorder to `RulesPage.tsx` calling `reorderRule(id, toIndex)`, plus keyboard-accessible move-up/move-down buttons per row as an accessible fallback to dragging (constitution Accessibility requirement) (depends on T012)
- [x] T014 [US3] Add enable/disable toggle (`toggleRule`) and delete (`removeRule`, with a confirm step) actions to each row in `RulesPage.tsx` (depends on T012)
- [x] T015 [US3] Wire "add rule" and per-row "edit" actions in `RulesPage.tsx` to `RuleModal` (unrestricted `matchType`, blank for create / pre-filled for edit) (depends on T009, T012)
- [x] T016 [P] [US3] Create the route `src/app/settings/rules/page.tsx` rendering `RulesPage` inside `DataProviderContext`, mirroring `src/app/settings/page.tsx` (depends on T012)
- [x] T017 [US3] Add a navigation link to the new Rules page in `src/views/SettingsPage.tsx` so it's discoverable (depends on T016)

**Checkpoint**: All rules from any entry point are visible, reorderable, toggleable, editable, and deletable from one page. Conflict resolution (SC-003) is fully self-serviceable here.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gates across the whole feature.

- [x] T018 Run the manual verification steps in `quickstart.md` end-to-end, including the regression checks in §4
- [x] T019 Run `npx tsc -b`, `npm run lint`, and `npm run build`; fix any resulting errors or warnings

---

## Phase 7: Amendment — Read-Only Sources, Mandatory Rules, ICS Library, Rule Transparency

**Input**: Amendment sections in `spec.md`, `research.md` (Decisions 7-10), `data-model.md`, `plan.md`, `contracts/ui-contracts.md`, dated 2026-07-22.

**Prerequisites**: Phases 2-6 complete (base rules engine shipped).

**Tests**: Same as base feature — no automated test runner; verification is manual + quality gates.

- [ ] T020 [P] Extend `RuleMatchType` with `"all"` in `src/types/index.ts`; remove `customColor`/`customIcon`/`customAllDayStyle`/`customTimedStyle` from `CalendarEvent`; remove `displayTypeId` from `WebCalConnection` and `CalDAVConnection` (data-model.md amendment)
- [ ] T021 [US-amend] In `src/store/index.ts`: seed exactly one `matchType: "all"` rule into `useRuleStore` on first load if none exists (target: previous `defaultEventTypeId` or the first `EventType`); make `removeRule`/`toggleRule` no-ops for that rule's `id`; make `reorderRule` always re-sort it to the end; remove `defaultEventTypeId` from `useUIStore`; add the catch-all-target guard to `useEventTypeStore`'s type-deletion action (reject deletion, per FR-021) (depends on T020)
- [ ] T022 [P] Update `src/lib/rules.ts`: change `findMatchingRule` to take `getType` instead of `isBroken` and return `Rule` (never `undefined`) — the catch-all guarantees a match and T021 guarantees its target always resolves (depends on T020, T021)
- [ ] T023 Collapse `resolveEventType()` in `src/components/events/EventChip.tsx` to `rules: Rule[]` only (drop `getConnection`, `defaultTypeId` params; return type becomes non-optional `EventType`), per research.md Decision 10 (depends on T022)
- [ ] T024 [P] Update call sites in `src/components/calendar/MonthView.tsx`, `TimeGridView.tsx`, `AgendaView.tsx` for the new `resolveEventType()` signature (depends on T023)
- [ ] T025 [P] Create `src/components/ui/combobox.tsx`: single-select searchable combobox on `@radix-ui/react-popover` + substring filter, per `contracts/ui-contracts.md` `ComboboxProps` (no new dependency)
- [ ] T026 In `src/components/settings/RuleModal.tsx`: replace the raw-ID `Input` for `matchType === "event"` with `<Combobox>` sourced from `useEventsStore()` (label = event title) and for `matchType === "source"` with `<Combobox>` sourced from `useConnectionStore()` (label = connection name); hide/disable all fields except the display-type picker when editing the catch-all row (depends on T025, T020)
- [ ] T027 Delete `src/components/events/EventModal.tsx`; create `src/components/events/EventDetail.tsx` as a read-only view (no save/create/update path) that keeps the "create a rule from this event" shortcut and adds the matched-rule description + priority display, per `contracts/ui-contracts.md` `EventDetailProps` (uses `findMatchingRule`/`rules` to compute both) (depends on T022)
- [ ] T028 [P] Update `MonthView.tsx`, `TimeGridView.tsx`, `AgendaView.tsx`, `CalendarGrid.tsx`, and `src/views/CalendarPage.tsx`: remove `onSlotClick`/"new event" affordances entirely; point `onEventClick` at `EventDetail` instead of `EventModal` (depends on T027)
- [ ] T029 Remove the `DisplayTypePicker`/`displayTypeId` field from `src/components/settings/AddConnectionModal.tsx`; keep its existing "create a rule for this source" shortcut into `RuleModal` (pre-filled `matchType: "source"`, source pre-selected in the new `Combobox`) (depends on T020, T026)
- [ ] T030 [P] In `src/views/RulesPage.tsx`: pin the `matchType: "all"` row last, remove its delete/toggle/reorder controls, keep its display-type picker editable, and label it clearly as the default/catch-all (depends on T021)
- [ ] T031 Add `ical.js` to `package.json`; replace `parseICSValue`/`icsDateToISO`/`parseICS` in `src/lib/webcal-provider.ts` with `ical.js`-based parsing behind the same `parseICS(text: string): CalendarEvent[]` signature (research.md Decision 8) — self-check: parse a feed containing a folded (line-continuation) property and a `TZID`-qualified `DTSTART` and confirm both produce correct output, since these are exactly the cases the old scanner mishandled
- [ ] T032 Remove `DataProvider.createEvent`/`updateEvent` (or equivalent) from the provider interface in `src/lib/multi-source-provider.ts` and any implementers, now that nothing calls them (depends on T027)

**Checkpoint**: No UI path creates or edits an event. Every event resolves a display type through a rule (catch-all or specific) with no separate default setting. Deleting the catch-all's target display type is blocked. Rule-target fields show names, never IDs. `.ics` parsing goes through `ical.js`. Every event's detail view names its applied rule and priority.

- [ ] T033 Run `npx tsc -b`, `npm run lint`, `npm run build`; fix any resulting errors or warnings
- [ ] T034 Manually re-run `quickstart.md`'s verification steps plus: confirm zero rules still styles every event (catch-all), confirm the combobox shows names not IDs, confirm deleting the catch-all's display type is blocked, confirm no "add event" affordance remains anywhere

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, nothing to do
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1 (P1) has no dependency on US2/US3 — it is the MVP
  - US2 (P2) depends on `RuleModal` from US1 (T009) but is otherwise independent
  - US3 (P3) depends on `RuleModal` from US1 (T009) but is otherwise independent of US2
- **Polish (Phase 6)**: Depends on all implemented user stories
- **Amendment (Phase 7)**: Depends on Phases 2-6 being complete (amends the already-shipped rules engine, `EventModal`, and `AddConnectionModal`); T020→T021→T022→T023→T024/T027 is one connected chain, T025→T026/T029, T028 depends on T027, T030/T031/T032 are otherwise independent

### Within Each Phase

- T001 before T002/T003 (both need the `Rule` type)
- T002, T003, T004 before T005 (resolution chain needs the store, matcher, and the ingestion fix in place)
- T005 before T006/T007/T008 (call sites need the new parameter to exist)
- T009 before T010/T011/T015 (all three entry points open the same modal)
- T012 before T013/T014/T015/T016

### Parallel Opportunities

- T001, T003, T004 can run in parallel (different files)
- T006, T007, T008 can run in parallel (different view files)
- Once T009 lands, US1's T010, US2's T011, and US3's T012 can all start in parallel (different files) — teams could split here
- T016 can run in parallel with T013/T014 (different files)

---

## Parallel Example: Foundational Phase

```bash
# After T001 completes:
Task: "Create src/lib/rules.ts with isValidPattern, matchesRule, findMatchingRule"
Task: "Fix applyConnectionMeta() in src/lib/multi-source-provider.ts"

# After T005 completes:
Task: "Update resolveEventType() call sites in src/components/calendar/MonthView.tsx"
Task: "Update resolveEventType() call sites in src/components/calendar/TimeGridView.tsx"
Task: "Update resolveEventType() call sites in src/components/calendar/AgendaView.tsx"
```

## Parallel Example: Entry Points (after T009)

```bash
Task: "Add 'Create a rule from this event' action to EventModal.tsx"          # US1
Task: "Add 'Create a rule for this source' action to AddConnectionModal.tsx"  # US2
Task: "Create src/views/RulesPage.tsx"                                       # US3
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL — blocks everything)
2. Complete Phase 3: User Story 1 (T009–T010)
3. **STOP and VALIDATE**: name-pattern and single-event rules work end-to-end from the event modal
4. Demo if ready — this alone delivers the feature's core differentiator

### Incremental Delivery

1. Foundational → Foundation ready
2. User Story 1 → Test independently → Demo (MVP!)
3. User Story 2 → Test independently → Demo
4. User Story 3 → Test independently → Demo
5. Polish → ship

### Notes

- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- `RuleModal` (T009) is intentionally built once in US1 and reused by US2/US3 rather than duplicated — the three entry points differ only in what they pre-fill
