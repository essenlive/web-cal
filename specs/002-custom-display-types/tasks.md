# Tasks: Custom Events Display Types

**Input**: Design documents from `/specs/002-custom-display-types/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup

*No setup needed — this feature extends existing files only. Proceed to Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: TypeScript type definitions and store initialization that ALL user stories depend on. These two changes cause compilation errors everywhere until resolved — complete them together before any story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Update `src/types/index.ts`: add `timedStyle: DisplayStyle` to `EventType`, add `displayTypeId?: string` to both `WebCalConnection` and `CalDAVConnection`, add `customTimedStyle?: DisplayStyle` to `CalendarEvent`
- [x] T002 Update `src/store/index.ts`: add `timedStyle: "block"` to all 6 entries in `DEFAULT_EVENT_TYPES`; update `migrateType()` to return `{ ...existing, timedStyle: t.timedStyle ?? "block" }` for forward migration

**Checkpoint**: `tsc -b` compiles with zero errors before moving forward. `npm run dev` loads the app.

---

## Phase 3: User Story 2 — Define and Manage Display Types (Priority: P2)

**Goal**: Users can create, edit, and delete display types that include a `timedStyle` setting. The Settings panel shows a timed style picker alongside the existing all-day style picker. Duplicate names are prevented. Deletion warns when the type is in use.

**Why US2 before US1**: Defining types is prerequisite to assigning them to calendars (US1). US2 delivers standalone value: users can curate their display type library before any calendar assignment.

**Independent Test**: Open Settings → Types tab, create a new type with a non-default `timedStyle`, edit it, verify changes persist after reload, attempt to create a duplicate name and confirm the error, delete the type and confirm it disappears.

### Implementation for User Story 2

- [x] T003 [US2] Add `timedStyle` state variable (default `"block"`) to `EventTypeForm` in `src/pages/SettingsPage.tsx` and include it in the `onSave` call alongside existing fields
- [x] T004 [US2] Add a timed-event style picker section to `EventTypeForm` in `src/pages/SettingsPage.tsx` — reuse `STYLE_OPTIONS` and `StylePreview`, label it "Style — événements horaires", placed after the all-day style section; remove the explanatory text "Les événements horaires sont toujours affichés en bloc."
- [x] T005 [US2] Add duplicate label validation to `EventTypeForm` in `src/pages/SettingsPage.tsx`: accept `existingLabels: string[]` prop, disable the save button and show an inline error when `label.trim()` matches any existing label (excluding the current type's own label when editing)
- [x] T006 [US2] Update the `SettingsPage` component in `src/pages/SettingsPage.tsx` to pass `existingLabels` (derived from `types.map(t => t.label)`) to `EventTypeForm` for both create and edit modes
- [x] T007 [US2] Add deletion-in-use warning to the Types tab in `src/pages/SettingsPage.tsx`: before calling `removeType(id)`, check `useConnectionStore.connections` for any with `displayTypeId === id` and `useEventsStore.events` for any with `eventTypeId === id`; if found, show an inline confirmation message with the count before proceeding

**Checkpoint**: All display type CRUD works in the Settings Types tab. Creating a type with any `timedStyle` value persists correctly. Duplicate name shows error. Deletion of an in-use type shows warning.

---

## Phase 4: User Story 1 — Assign a Display Type to an Entire Calendar (Priority: P1) 🎯 MVP

**Goal**: Users can assign a display type to a calendar connection. All events from that calendar render using that type's color, icon, and style. Event-level assignments take precedence. Removing the assignment reverts to default behavior.

**Independent Test**: Open Settings → Data Sources, assign a display type to a connected calendar, navigate to any calendar view, verify all events from that calendar render with the assigned type's color and icon. Add a per-event type override to one event and confirm it takes precedence.

### Implementation for User Story 1

- [x] T008 [P] [US1] Extend `resolveEventType()` in `src/components/events/EventChip.tsx` to accept two new optional parameters: `getConnection: (calendarId: string) => Connection | undefined` and `defaultTypeId: string | undefined`; implement Level 3 resolution (connection's `displayTypeId`) and Level 4 (application default type) after the existing Level 1 and Level 2 checks
- [x] T009 [P] [US1] Add `eventTypes: EventType[]` and `onUpdate: (conn: Connection) => void` to `ConnectionListProps` interface in `src/components/settings/ConnectionList.tsx`
- [x] T010 [US1] Add a compact display type selector to `ConnectionRow` in `src/components/settings/ConnectionList.tsx`: a small dropdown or button group showing "No type" (when `displayTypeId` is undefined) and one entry per `eventType` in props; selecting a type calls `onUpdate({ ...connection, displayTypeId: selectedId })`, selecting "None" calls `onUpdate({ ...connection, displayTypeId: undefined })` (depends on T009)
- [x] T011 [US1] Update `BackendSettings.tsx` (or whichever component renders `ConnectionList`) in `src/components/settings/BackendSettings.tsx` to source `eventTypes` from `useEventTypeStore` and `onUpdate` from `useConnectionStore.updateConnection`, then pass both to `ConnectionList` (depends on T009, parallelizable with T010)
- [x] T012 [US1] Locate all call sites of `resolveEventType()` in `src/components/calendar/` and any other rendering components; update each call to pass `getConnection` (derived from `useConnectionStore`) and `defaultTypeId` (from `useUIStore.defaultEventTypeId`) so the full 4-level resolution chain is active (depends on T008)

**Checkpoint**: Assigning a display type to a calendar connection causes all its events to render with that type's color and icon in all views. A per-event type override beats the calendar-level one.

---

## Phase 5: User Story 3 — Apply a Display Type to an Individual Event (Priority: P3)

**Goal**: The event editor allows selecting a named display type or configuring a one-off "Custom" appearance that includes `timedStyle`. Event-level selection takes precedence over calendar-level.

**Independent Test**: Open an event, select a named display type from the dropdown and save — confirm the event renders with that type everywhere. Open another event, select "Custom", set a non-default timed style and save — confirm rendering matches.

### Implementation for User Story 3

- [x] T013 [P] [US3] Update `resolveEventType()` in `src/components/events/EventChip.tsx`: when `event.eventTypeId === "custom"`, include `timedStyle: event.customTimedStyle ?? "block"` in the virtual EventType object returned (one-line addition alongside existing `customAllDayStyle` handling)
- [x] T014 [P] [US3] Add a `customTimedStyle` state variable and timed style picker to the "Custom" event type section in `src/components/events/EventModal.tsx`, mirroring the existing `customAllDayStyle` picker pattern; include `customTimedStyle` in the saved event object when `eventTypeId === "custom"`
- [x] T015 [US3] Verify in `src/components/events/EventModal.tsx` that when a named display type is selected, all `custom*` fields (including `customTimedStyle`) are cleared from the saved event; when "Custom" is selected, all four custom fields are populated (depends on T014)

**Checkpoint**: Both named type selection and custom per-event configuration work in EventModal. Custom events render with the correct `customTimedStyle` in timed slots.

---

## Phase 6: User Story 4 — Visual Style Applies to Both All-Day and Timed Events (Priority: P4)

**Goal**: Timed events render according to their resolved `timedStyle` instead of always defaulting to "block". All four calendar views (month, week, day, agenda) honor the resolved style.

**Independent Test**: Create a display type with `timedStyle: "avatar-tl"`, assign it to a calendar or event, view that event in week/day view — it renders as an avatar badge instead of a block chip.

### Implementation for User Story 4

- [x] T016 [US4] Update `resolveStyle()` in `src/components/events/EventChip.tsx`: change `if (!allDay) return "block"` to `if (!allDay) return type?.timedStyle ?? "block"` — this single-line change activates timed style rendering across all views
- [x] T017 [US4] Audit all four calendar view components in `src/components/calendar/` (month, week, day, agenda views) to confirm that `eventType` is always passed to `EventChip` (or to `resolveStyle` directly if called separately), so `T016`'s change takes effect; fix any rendering sites that pass `undefined` where a resolved type should be passed

**Checkpoint**: A timed event with `timedStyle: "avatar-tl"` renders as an avatar badge in week and day views. All four views consistently apply the resolved timed style.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, cleanup, and consistency pass across all stories.

- [x] T018 [P] Run `tsc -b` from repo root and fix any remaining TypeScript errors introduced during implementation
- [x] T019 [P] Run `npm run lint` and fix any ESLint warnings — pay attention to exhaustive type narrowing on the updated `Connection` discriminated union
- [x] T020 Run `npm run build` and verify the production bundle builds successfully with no warnings
- [x] T021 Execute the manual smoke test checklist in `specs/002-custom-display-types/quickstart.md` — verify all 11 items pass in dark mode and light mode

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately; blocks everything else
- **US2 (Phase 3)**: Depends on Phase 2 — defines display types used by US1 and US3
- **US1 (Phase 4)**: Depends on Phase 2 (types compile); US2 recommended first so types exist to assign
- **US3 (Phase 5)**: Depends on Phase 2 only; US1 context useful but not blocking
- **US4 (Phase 6)**: Depends on Phase 2 only; T016 is 1 line, but benefits from US1/US3 being testable first
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US2 (P2)**: Depends on Foundational only — independent
- **US1 (P1)**: Depends on Foundational only — independent (best done after US2 so types exist to assign)
- **US3 (P3)**: Depends on Foundational only — independent (T013 extends the same function as T008, coordinate if working simultaneously)
- **US4 (P4)**: Depends on Foundational only — T016 must not conflict with T008 edits to `EventChip.tsx`

### Within-Story Dependencies

```text
Phase 3 (US2): T003 → T004 → T005 → T006 → T007   (sequential, all SettingsPage.tsx)
Phase 4 (US1): T008 [P] T009 → T010 → T011 [P] → T012
Phase 5 (US3): T013 [P] T014 → T015
Phase 6 (US4): T016 → T017
```

### ⚠️ File Conflict Warning

`src/components/events/EventChip.tsx` is modified by T008 (US1), T013 (US3), and T016 (US4). If working these phases in parallel, coordinate to avoid merge conflicts. Recommended order: complete T008 first (it restructures the function signature), then T013 (adds `customTimedStyle` handling), then T016 (changes `resolveStyle`).

---

## Parallel Opportunities

### Phase 4 (US1) Parallel Start

```text
# After T002 completes:
Task T008: Extend resolveEventType() in src/components/events/EventChip.tsx
Task T009: Add props to ConnectionListProps in src/components/settings/ConnectionList.tsx
# Both touch different files — start simultaneously
```

### Phase 5 (US3) Parallel Start

```text
# After T002 completes (and T008 is done to avoid EventChip.tsx conflict):
Task T013: Update resolveEventType() for customTimedStyle in src/components/events/EventChip.tsx
Task T014: Add customTimedStyle picker to src/components/events/EventModal.tsx
# Different files — start simultaneously
```

### Polish Parallel

```text
Task T018: tsc -b (no file writes, just validation)
Task T019: npm run lint (no file writes, just validation)
# Both read-only — start simultaneously
```

---

## Implementation Strategy

### MVP First (Recommended: US2 → US1)

1. Complete Phase 2: Foundational
2. Complete Phase 3: US2 (manage types with timedStyle) — users can define what they want to assign
3. Complete Phase 4: US1 (assign types to calendars) — **this is the P1 story**
4. **STOP and VALIDATE**: Both US1 and US2 work end-to-end
5. Deploy/demo

### Full Incremental Delivery

1. Phase 2 (Foundational) → compiles ✓
2. Phase 3 (US2) → type management complete ✓
3. Phase 4 (US1) → calendar assignment complete ✓ **← MVP demo point**
4. Phase 5 (US3) → per-event assignment complete ✓
5. Phase 6 (US4) → timed style renders everywhere ✓
6. Phase 7 (Polish) → ship ready ✓

---

## Notes

- All changes are additive — no existing functionality is removed or broken
- `src/components/events/EventChip.tsx` is the most change-dense file; coordinate if working in parallel
- `resolveStyle()`'s behaviour change in T016 is intentional and non-breaking for default types (all have `timedStyle: "block"`)
- [P] tasks = different files, no blocking dependencies between them
- Commit after each phase checkpoint to keep history clean and reviewable
