# Tasks: Quick Hide

**Input**: Design documents from `/specs/004-quick-hide/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated (no automated test runner exists in this repo; verification is via `quickstart.md` and the quality gates in Polish).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup

*No setup needed — this feature only adds one optional field to two existing types and extends five existing files. No new dependencies, no new store, no new route. Proceed to Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `hidden` field and the filtering logic every calendar view renders through. Nothing in any user story is observable until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add `hidden?: boolean` to `EventType`, `WebCalConnection`, and `CalDAVConnection` in `src/types/index.ts` per `data-model.md` (optional field, no migration needed — absent/undefined behaves as visible)
- [x] T002 Add `isEventHidden(event, getType, getConnection, defaultTypeId): boolean` to `src/components/events/EventChip.tsx`, exported next to the existing `resolveEventType`/`resolveStyle`: returns `true` if `getConnection(event.calendarId)?.hidden` is true, else `true` if `resolveEventType(event, getType, getConnection, defaultTypeId)?.hidden` is true, else `false`, per `contracts/ui-contracts.md` (depends on T001)
- [x] T003 [P] In `src/components/calendar/MonthView.tsx`: filter the raw `events` array through `isEventHidden` (negated) immediately after `getConnection`/`getType`/`defaultEventTypeId` are available in the component body, before any day/week/lane computation reads `events`, per `contracts/ui-contracts.md` call-site example (depends on T002)
- [x] T004 [P] In `src/components/calendar/TimeGridView.tsx`: same filtering, applied right after `getConnection`/`getType`/`defaultEventTypeId` are available, before `layoutDayEvents`/`getAllDayEventsForDay` consume `events` (depends on T002)
- [x] T005 [P] In `src/components/calendar/AgendaView.tsx`: same filtering, applied right after `getConnection` is defined, before the day-grouping loop consumes `events` (depends on T002)

**Checkpoint**: `npx tsc -b` compiles with zero errors. With no UI yet to set `hidden`, every event renders exactly as before this feature (regression check from `quickstart.md` §4, first bullet). No user-visible behavior change yet — that starts with User Story 1.

---

## Phase 3: User Story 1 - Hide a Noisy Calendar Source (Priority: P1) 🎯 MVP

**Goal**: From the existing Data Sources settings list, a user can hide/unhide a connection with one toggle; while hidden, none of its events appear in any calendar view, and it remains fully listed (name, color, credentials, status) with a visible hidden indicator.

**Independent Test**: With two or more connected sources producing events in the visible date range, hide one source from its settings row and verify none of its events appear in month, week, day, or agenda views while the other source's events are unaffected; unhide it and verify its events reappear.

### Implementation for User Story 1

- [x] T006 [US1] Add a hide/show icon-button (lucide `Eye`/`EyeOff`, matching the existing `Trash2` button's styling) to `ConnectionRow` in `src/components/settings/ConnectionList.tsx`, calling the row's existing `onUpdate({ ...connection, hidden: !connection.hidden })`; dim the row (e.g. `opacity-50`) and set the button's `aria-label`/`title` to reflect current state when `connection.hidden` is true (depends on T001, T003, T004, T005 for the toggle to have any visible effect)

**Checkpoint**: Hiding a connection from Settings → Data Sources immediately removes its events from every calendar view; the connection stays listed with full config, visibly marked hidden; unhiding restores it. This is a fully demoable MVP on its own.

---

## Phase 4: User Story 2 - Hide a Display Type (Priority: P1)

**Goal**: From the existing Types settings list, a user can hide/unhide a display type with one toggle; while hidden, every event currently resolving to that type — directly, via calendar-level fallback, or via the application default — disappears from every calendar view, and the type remains fully listed with a visible hidden indicator.

**Independent Test**: With events resolving to a given display type (directly, via calendar-level fallback, or via the application default), hide that type from its settings row and verify all such events disappear from every calendar view while events of other types remain visible; unhide it and verify they reappear.

### Implementation for User Story 2

- [x] T007 [US2] Add an `onToggleHidden: (t: EventType) => void` prop and a hide/show icon-button to `EventTypeRow` in `src/views/SettingsPage.tsx`, matching `T006`'s button styling; wire `SettingsPage`'s render call to pass `(t) => updateType({ ...t, hidden: !t.hidden })`; dim the row when `type.hidden` is true, per `contracts/ui-contracts.md` (depends on T001, T003, T004, T005)

**Checkpoint**: Hiding a type from Settings → Types immediately removes every event resolving to it (through any part of the existing precedence chain) from every calendar view; the type stays listed with full config, visibly marked hidden; unhiding restores it.

---

## Phase 5: User Story 3 - Toggle Visibility Without Leaving the Calendar (Priority: P2)

**Goal**: A compact "Sources & Types" section in the Sidebar — the always-visible calendar chrome — lists every connection and every type with its current hidden/visible state and a one-click toggle, reachable without navigating to Settings.

**Independent Test**: From the main calendar screen (not the settings page), locate a source or type in the sidebar's quick list, toggle its visibility, and confirm the effect on calendar views without navigating to another page.

### Implementation for User Story 3

- [x] T008 [US3] Add a "Sources & Types" quick-toggle section to `src/components/sidebar/Sidebar.tsx`, below the existing mini calendar: read `connections` from `useConnectionStore()` and `types` from `useEventTypeStore()`; render two labeled row-groups ("Sources", "Types"), each row showing a color swatch (connections) or icon (types), the label (dimmed when hidden), and an `Eye`/`EyeOff` button calling `updateConnection({ ...c, hidden: !c.hidden })` / `updateType({ ...t, hidden: !t.hidden })` respectively, per `contracts/ui-contracts.md`'s `VisibilityItem` shape (depends on T001, T003, T004, T005; reuses the same store actions as T006/T007 so both surfaces stay in sync automatically)

**Checkpoint**: All three user stories are demoable end-to-end. Toggling from the sidebar and toggling from Settings both immediately affect the calendar and stay in sync with each other (same underlying store record).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gates across the whole feature.

- [x] T009 Run the manual verification steps in `quickstart.md` end-to-end, including the regression checks in §4 (hide-everything, hidden-type-still-selectable-in-pickers, delete-while-hidden)
- [x] T010 Run `npx tsc -b`, `npm run lint`, and `npm run build`; fix any resulting errors or warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, nothing to do
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1 (P1) has no dependency on US2/US3 — it is the MVP
  - US2 (P1) is independent of US1 (different file, different store) but is listed second per spec.md's story order
  - US3 (P2) depends on US1/US2 conceptually (reuses their toggle pattern for UX consistency) but has no hard file dependency on either — could be built in parallel once Foundational is done
- **Polish (Phase 6)**: Depends on all implemented user stories

### Within Each Phase

- T001 before T002 (helper needs the field to exist)
- T002 before T003/T004/T005 (call sites need the helper to exist)
- T003, T004, T005 before T006/T007/T008 have any visible effect (toggles are inert without the render-side filter)

### Parallel Opportunities

- T003, T004, T005 can run in parallel (different view files, same dependency on T002)
- Once Foundational (T001–T005) lands, T006 (US1), T007 (US2), and T008 (US3) can all start in parallel (different files, no shared dependencies)

---

## Parallel Example: Foundational Phase

```bash
# After T002 completes:
Task: "Wire isEventHidden filter into src/components/calendar/MonthView.tsx"
Task: "Wire isEventHidden filter into src/components/calendar/TimeGridView.tsx"
Task: "Wire isEventHidden filter into src/components/calendar/AgendaView.tsx"
```

## Parallel Example: User Story Toggles (after Foundational)

```bash
Task: "Add hide/show button to ConnectionRow in ConnectionList.tsx"   # US1
Task: "Add hide/show button to EventTypeRow in SettingsPage.tsx"      # US2
Task: "Add Sources & Types quick-toggle section to Sidebar.tsx"       # US3
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL — blocks everything)
2. Complete Phase 3: User Story 1 (T006)
3. **STOP and VALIDATE**: hiding/unhiding a source from Settings works end-to-end across all calendar views
4. Demo if ready — this alone delivers the feature's core differentiator for sources

### Incremental Delivery

1. Foundational → Foundation ready
2. User Story 1 → Test independently → Demo (MVP!)
3. User Story 2 → Test independently → Demo
4. User Story 3 → Test independently → Demo
5. Polish → ship

### Notes

- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- T006 and T007 are intentionally near-identical in shape (same button, same dim-row treatment, different store) — this is acceptable duplication per Constitution Simplicity/YAGNI: a shared `VisibilityToggleButton` component was considered and rejected in `research.md` Decision 6's spirit (two ~10-line call sites don't justify a new shared component over matching the existing per-file icon-button convention).
