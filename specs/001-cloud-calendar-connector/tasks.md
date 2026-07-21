# Tasks: Cloud Calendar Provider Connector

**Input**: Design documents from `/specs/001-cloud-calendar-connector/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/settings-ui.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. No test tasks generated (not requested in spec).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Type Definitions)

**Purpose**: Extend the type system with new `Connection` entities. All subsequent phases depend on these types.

- [x] T001 Add `ConnectionStatus`, `WebCalConnection`, `CalDAVConnection`, `Connection` union type, and `ConnectionStatusMap` to `src/types/index.ts` — preserve all existing types unchanged; add the new types below the existing `EventType` interface as documented in `data-model.md`

**Checkpoint**: `npx tsc -b` passes with zero errors before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can begin. These three tasks establish the data layer, provider logic, and React context that all UI phases consume.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `useConnectionStore` to `src/store/index.ts` — implements `ConnectionStore` interface (`connections`, `addConnection` with UUID generation via `crypto.randomUUID()`, `removeConnection`, `updateConnection`); persists to localStorage key `"webcal:connections"`; includes `onRehydrateStorage` migration that reads legacy `webcal:backend` key, converts `webcal` sources and `caldav` config to `Connection[]` entries, then removes the old key; mark `useBackendStore` as `@deprecated` via JSDoc comment
- [x] T003 Create `src/lib/multi-source-provider.ts` — `MultiSourceProvider` class implementing `DataProvider`; constructor accepts `connections: Connection[]` and a `onStatusChange: (id: string, status: ConnectionStatus) => void` callback; `getEvents(start, end)` instantiates a sub-provider per connection using a `makeProvider(conn: Connection): DataProvider` switch on `conn.type` (WebCal → `WebCalProvider([{id, name, url, color}], proxyUrl)`, CalDAV → `CalDAVProvider(url, username, password, proxyUrl)`); fans out via `Promise.allSettled`; for fulfilled results maps events to add `customColor: conn.color`, `eventTypeId: "custom"`, and namespaced `id: \`${conn.id}::${event.id}\``; calls `onStatusChange(conn.id, "active")` on success and `onStatusChange(conn.id, "error")` on rejection; `createEvent`, `updateEvent`, `deleteEvent` throw `"read-only: write operations not supported in v1"`
- [x] T004 Update `src/context/DataProviderContext.tsx` — replace `useBackendStore` with `useConnectionStore`; add `useState<ConnectionStatusMap>({})` for live status tracking; instantiate `MultiSourceProvider` in `useMemo` keyed on `connections` array (use `JSON.stringify(connections)` as memo key or spread individual connection ids); pass `onStatusChange` callback that calls `setStatusMap`; export `useConnectionStatusMap(): ConnectionStatusMap` hook from this file; retain `DevDataProviderContext` export unchanged

**Checkpoint**: App boots with an empty connections list; mock provider still works for existing demo data; `npx tsc -b` and `npm run lint` pass.

---

## Phase 3: User Story 1 — Connect a Cloud Calendar Provider (Priority: P1) 🎯 MVP

**Goal**: Users can add a WebCal or CalDAV connection via a settings dialog and see their events appear in the main calendar view within 10 seconds.

**Independent Test**: Add a public WebCal ICS URL (e.g. a public Google Calendar export link) via the Add Source dialog; events must appear in the calendar. Remove the connection; events must disappear. No other user stories required.

- [x] T005 [US1] Create `src/components/settings/AddConnectionModal.tsx` — Radix `Dialog` component accepting props `{ open: boolean; onOpenChange: (open: boolean) => void; onAdd: (conn: Omit<Connection, "id">) => void; existingColors: string[] }`; implement a two-step wizard using local `useState`: Step 1 renders two large radio-style buttons ("WebCal — ICS feed" and "CalDAV — CalDAV server") with a [Next →] button; Step 2 conditionally renders the WebCal form (Step 2a) or CalDAV form (Step 2b) based on selected type; include a [← Back] button on Step 2 that returns to Step 1; dialog title updates per step
- [x] T006 [US1] Add WebCal form (Step 2a) inside `src/components/settings/AddConnectionModal.tsx` — fields: Name (text, required, max 80 chars), Calendar URL (text, required, validated to start with `https://`, `http://`, or `webcal://`), Colour (8 fixed hex swatches: `["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6"]`, auto-select first colour not in `existingColors`), and an Advanced collapsible section containing an optional CORS Proxy URL field; [Test] button and [Add Source] button (disabled until required fields are valid); inline validation error messages below each invalid field
- [x] T007 [US1] Add CalDAV form (Step 2b) inside `src/components/settings/AddConnectionModal.tsx` — fields: Name (text, required, max 80 chars), Server URL (text, required, must start with `https://` or `http://`), Username (text, required), Password (password input, required, masked), Colour (same 8-swatch picker as WebCal, same auto-select logic), Advanced collapsible with optional CORS Proxy URL; same [Test] and [Add Source] button behaviour as Step 2a
- [x] T008 [US1] Add [Test] button connection logic inside `src/components/settings/AddConnectionModal.tsx` — on click: set local `testStatus: "testing"` state (disables button, shows spinner + "Testing…"); for WebCal, `fetch()` the URL (with proxy prefix if provided) and check for `200` response; for CalDAV, instantiate `CalDAVProvider` and call `getEvents(new Date(), new Date())` catching errors; on success set `testStatus: "ok"` (show green checkmark + "Connection OK" for 3 s then reset to idle); on failure set `testStatus: "error"` with a short message from the caught error; test state does NOT persist — only validates, never saves
- [x] T009 [US1] Update `src/components/settings/BackendSettings.tsx` — remove the existing single-backend UI; render an `<AddConnectionModal>` instance controlled by local `open` state; add a "[+ Add Source]" button (primary style, top-right of the Data Sources section header) that sets `open: true`; pass `onAdd` handler that calls `useConnectionStore().addConnection` with a generated UUID; pass `existingColors` derived from `useConnectionStore().connections.map(c => c.color)`; retain the existing settings page tab structure — only the content inside the "Backend" / "Data Sources" tab changes

**Checkpoint**: Open Settings → Data Sources; click [+ Add Source]; complete WebCal form with a valid ICS URL; click [Add Source]; connection appears in settings (as a placeholder entry — full list UI comes in US2); events from that feed appear in the main calendar view within 10 seconds.

---

## Phase 4: User Story 2 — View and Manage Connected Providers (Priority: P2)

**Goal**: Users can see all active connections with live status indicators, remove a connection with confirmation, and understand at a glance whether each connection is healthy.

**Independent Test**: Simulate an active connection in the store; verify the list displays name, type badge, status badge (active/error/unchecked/loading), and a working remove button with confirmation. Remove action clears events from the calendar. No US3 required.

- [x] T010 [US2] Create `src/components/settings/ConnectionList.tsx` — renders a `<ul>` of `<ConnectionRow>` items; each row shows: a 16×16 colour swatch circle (`background-color: connection.color`), the connection name (truncated at 40 chars with CSS `truncate`), a type badge (`"WebCal"` or `"CalDAV"` in a muted pill), a status badge (see T011), and a remove icon button (`Trash2` from lucide-react) with `aria-label="Remove [name]"`; shows an empty-state message ("No data sources connected. Add a WebCal subscription or CalDAV account.") when `connections` is empty; accepts props `{ connections: Connection[]; statusMap: ConnectionStatusMap; onRemove: (id: string) => void }`
- [x] T011 [US2] Add status badge to `ConnectionRow` inside `src/components/settings/ConnectionList.tsx` — renders a `<span role="status" aria-live="polite">` with text and colour based on `ConnectionStatus`: `unchecked` → grey "—", `loading` → `<Loader2>` spinner icon + "Syncing", `active` → `CheckCircle2` icon (green) + "Active", `error` → `AlertCircle` icon (amber) + "Error"; derive each connection's status from `statusMap[connection.id] ?? "unchecked"`
- [x] T012 [US2] Add remove confirmation to `ConnectionRow` inside `src/components/settings/ConnectionList.tsx` — when the trash icon is clicked, replace the row's action area inline with a compact confirmation: "Remove [name]?" with [Cancel] (resets to normal row) and [Remove] (calls `onRemove(connection.id)`) buttons; do NOT use a modal/dialog for this — keep it inline within the row to avoid blocking the list; use local `useState<boolean>` per row for `confirming` state
- [x] T013 [US2] Integrate `ConnectionList` into `src/components/settings/BackendSettings.tsx` — render `<ConnectionList>` above the [+ Add Source] button; wire `connections` from `useConnectionStore()`; wire `statusMap` from `useConnectionStatusMap()` (exported by `DataProviderContext.tsx` in T004); wire `onRemove` to `useConnectionStore().removeConnection`; when a connection is removed, `DataProviderContext` re-instantiates `MultiSourceProvider` on next render cycle (automatic due to memo key change), triggering a fresh fetch that excludes the removed connection's events

**Checkpoint**: Settings → Data Sources shows the full connection list. Adding a connection shows it in the list. Status badge updates from unchecked → loading → active (or error) after each fetch. Remove button with confirmation removes the connection and its events from the calendar.

---

## Phase 5: User Story 3 — Multiple Simultaneous Provider Connections (Priority: P3)

**Goal**: Users can connect two or more CalDAV/WebCal sources simultaneously, with events from all sources visible in the unified calendar view and each source's events colour-coded.

**Independent Test**: Add two WebCal connections with different colours; events from both appear simultaneously in the calendar; each event's colour matches its source's swatch. Remove one; only that source's events disappear.

- [x] T014 [P] [US3] Verify colour application in `src/lib/multi-source-provider.ts` (T003) — read through the implementation and confirm: (a) every event returned has `customColor` set to `conn.color` and `eventTypeId` set to `"custom"`, (b) event `id` is correctly namespaced as `"${conn.id}::${originalId}"`, (c) if an existing connection's `WebCalSource.id` already matches the `conn.id` format, there is no double-prefixing; add a code comment documenting the namespacing contract; no functional changes if already correct
- [x] T015 [P] [US3] Verify colour swatch auto-selection in `src/components/settings/AddConnectionModal.tsx` (T006/T007) — confirm the initial swatch selection logic selects the first palette colour not already present in `existingColors`; if `existingColors` contains all 8 colours, default to the first palette colour (wrap around); add a JSDoc comment on the `existingColors` prop explaining the auto-selection behaviour; no UI changes if already correct
- [ ] T016 [US3] Manual end-to-end verification using `quickstart.md` test checklist — run the full checklist from `specs/001-cloud-calendar-connector/quickstart.md`; fix any issues discovered: (a) two connections showing simultaneously, (b) correct per-source colours in month/week/day views, (c) removing one connection leaves the other intact, (d) app reload persists both connections, (e) dark mode renders correctly, (f) mobile viewport (375 px) is usable

**Checkpoint**: All quickstart.md checklist items pass. Two connections with distinct colours show events simultaneously. Single-connection removal is isolated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, deprecation cleanup, and build validation across all stories.

- [x] T017 [P] Add `console.warn` deprecation notice to `useBackendStore` in `src/store/index.ts` — inside the store creator, log `"[web-cal] useBackendStore is deprecated. Use useConnectionStore instead."` on first access using a one-time flag; ensure no existing code outside the migration path still reads from `useBackendStore`
- [x] T018 [P] Audit `src/components/settings/BackendSettings.tsx` for any remaining references to `BackendType`, `BackendConfig`, or `useBackendStore` — remove or replace with connection-store equivalents; ensure the tab label in `src/pages/SettingsPage.tsx` reads "Data Sources" (update from "Backend" if present)
- [x] T019 Run full quality gate — execute `npx tsc -b`, `npm run lint`, and `npm run build` in sequence; fix every TypeScript error, lint warning, and build failure before marking complete; confirm `npm run dev` loads without console errors or warnings

**Checkpoint**: All quality gates pass. The app is ready for `/speckit.implement`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 types must exist) — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 completion (store + provider + context required)
- **Phase 4 (US2)**: Depends on Phase 2; builds on Phase 3 components but is independently testable
- **Phase 5 (US3)**: Depends on Phase 2; T014/T015 can run in parallel with Phase 4
- **Phase 6 (Polish)**: Depends on all desired stories being complete

### Within Phase 2

```
T001 (types)
  └── T002 (store)      ← parallel with T003
  └── T003 (provider)   ← parallel with T002
        └── T004 (context) ← depends on T002 + T003
```

### Within Phase 3 (US1)

```
T005 (modal shell)
  └── T006 (WebCal form)    ← sequential, same file
        └── T007 (CalDAV form)  ← sequential, same file
              └── T008 (Test button) ← sequential, same file
                    └── T009 (wire into BackendSettings)
```

### Within Phase 4 (US2)

```
T010 (ConnectionList shell)
  └── T011 (status badge)   ← sequential, same file
        └── T012 (remove confirm) ← sequential, same file
              └── T013 (wire into BackendSettings)
```

### Parallel Opportunities

- T002 and T003 (Phase 2): different files, no inter-dependency
- T014 and T015 (Phase 5): different files, both are verification tasks
- T017 and T018 (Phase 6): different files

---

## Parallel Execution Examples

### Phase 2 Parallel Pair

```
# These two can be dispatched simultaneously:
Task A: "Add useConnectionStore to src/store/index.ts"
Task B: "Create src/lib/multi-source-provider.ts"
# Then when both done:
Task C: "Update src/context/DataProviderContext.tsx"
```

### Phase 5 Parallel Pair

```
# These two can be dispatched simultaneously:
Task A: "Verify colour application in src/lib/multi-source-provider.ts"
Task B: "Verify colour auto-selection in src/components/settings/AddConnectionModal.tsx"
```

---

## Implementation Strategy

### MVP (User Story 1 only — ~9 tasks)

1. Complete Phase 1: T001
2. Complete Phase 2: T002 → T003 (parallel) → T004
3. Complete Phase 3: T005 → T006 → T007 → T008 → T009
4. **STOP and VALIDATE**: Add a WebCal source, confirm events appear
5. Demo/deploy if ready — delivers core value with minimal scope

### Incremental Delivery

1. Phase 1 + 2 → foundational layer ready
2. Phase 3 → **MVP**: users can connect and see events
3. Phase 4 → users can manage connections with status visibility
4. Phase 5 → full multi-source with visual differentiation
5. Phase 6 → ship-ready with passing quality gates

---

## Notes

- [P] marks tasks safe to run in parallel (different files, no blocking dependencies)
- [Story] label maps each task to a specific user story for traceability
- Each user story is independently testable without requiring later stories
- Run `npx tsc -b` after every phase to catch type errors early
- Commit after each phase checkpoint or logical task group
- `MultiSourceProvider` is the key new abstraction — get T003 right before touching UI
