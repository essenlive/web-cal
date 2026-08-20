# Tasks: Events Performance & Sync Feedback

**Input**: Design documents from `/specs/008-events-perf-caching/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not included — this repository has no automated test framework (`package.json` has only `dev`/`build`/`lint` scripts), consistent with every prior spec under `specs/`. Verification is the manual pass in `quickstart.md` (Phase 6, T021) plus `tsc -b`/`npm run lint`/`npm run build` (T022).

**Organization**: Tasks are grouped by user story (US1/US2/US3, from spec.md's P1/P2/P3) so each can be implemented and verified independently, in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1, US2, or US3 from spec.md
- File paths are exact and relative to the repository root

---

## Phase 1: Setup

- [ ] T001 [P] Add a `SyncState` type (`"idle" | "syncing" | "error"`) to `src/types/index.ts`, next to the existing `ConnectionStatus`/`ConnectionStatusMap` types (data-model.md; consumed later by T015/T016).

**Checkpoint**: New shared type available; no behavior changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure, file-isolated building blocks that User Story 1's implementation wires together. Nothing here changes app behavior on its own.

**⚠️ CRITICAL**: T002 in particular must be correct before any user story work begins — it's the core cache data structure everything else builds on.

- [ ] T002 [P] Create `src/lib/event-cache.ts`: the `ConnectionCacheEntry` type (`coveredRanges`, `events`, `lastFetchedAt`, `fetchSeq`, `fetchKey` — data-model.md) plus pure functions `computeFetchKey(connection)` (hashes `id`+`type`+`url`+`proxyUrl`+`username`+`password` — research.md Decision E), `computeGaps(covered, requested)` (interval subtraction — research.md Decision B), `mergeFetchedRange(entry, range, events)` (drops cached events overlapping `range`, appends the new ones, unions `range` into `coveredRanges` — research.md Decision B step 4), and `isStale(entry, ttlMs)` (research.md Decision C). No React/store imports — pure and independently reasoned about.
- [ ] T003 [P] In `src/lib/rules.ts`, add a compiled-`RegExp` cache for `name`-type rules (e.g. a module-level `Map<ruleId, RegExp>`, rebuilt only when the `rules` array reference passed in changes) and have `matchesRule` use it instead of `new RegExp(rule.matchValue, "i")` on every call (research.md Decision F).
- [ ] T004 [P] In `src/store/index.ts`, add `hasLoadedOnce: boolean` (initial `false`) to `useEventsStore`, set to `true` inside `setEvents` the first time it's called with a non-empty invocation this session (data-model.md; consumed by T018/T020).

**Checkpoint**: Foundation ready — `event-cache.ts`, the rules regex cache, and the store field all exist and compile, but nothing consumes them yet.

---

## Phase 3: User Story 1 - Instant calendar navigation within loaded data (Priority: P1) 🎯 MVP

**Goal**: Repeat navigation inside an already-fetched date range is instant and hits no network; navigating to new dates only fetches the uncovered delta; stale cached data refreshes in the background without ever blanking the grid; rules resolution and rendering are no longer redone from scratch on every render.

**Independent Test**: Load the calendar, navigate across several months and back to a previously visited one — confirm instant render, no loading indicator, and no new network request in devtools for the revisited range (spec.md Acceptance Scenarios 1–3).

### Implementation for User Story 1

- [ ] T005 [US1] In `src/context/DataProviderContext.tsx`, replace the direct `provider.getEvents(start, end)` call in both the navigation effect and `refresh()` with cache-aware logic: compute gaps via `event-cache.ts`'s `computeGaps` against the connection's cache entry, serve `mergeFetchedRange`'d cached events immediately when there are no gaps, and fetch+merge only the gap sub-ranges when there are. (Depends on T002.)
- [ ] T006 [US1] In `src/context/DataProviderContext.tsx`, replace the `connectionKey` memo dependency (currently `JSON.stringify(connections.map((c) => c.id))`) with one derived from `computeFetchKey` (T002) per connection, so editing a connection's URL/proxy/credentials re-instantiates `MultiSourceProvider` and invalidates that connection's cache entry — not just adding/removing connections (research.md Decision E; fixes FR-005). (Same file as T005 — sequential, not parallel.)
- [ ] T007 [US1] In `src/context/DataProviderContext.tsx`, add the per-connection `fetchSeq` guard from `event-cache.ts`: bump it whenever a fetch is issued for a connection, and only apply a resolved fetch's result if its captured sequence still matches the connection's live `fetchSeq` (research.md Decision D; satisfies FR-012/FR-013 — rapid navigation never lets a superseded fetch overwrite newer data). (Same file — sequential.)
- [ ] T008 [US1] In `src/context/DataProviderContext.tsx`, add staleness handling: on every navigation, if the requested window's connection(s) are stale per `isStale` (T002, 5-minute TTL), kick a non-blocking background re-fetch of just the requested window, merging its result in via `mergeFetchedRange` when it lands, without ever clearing the currently-displayed `events` in between (research.md Decision C; satisfies FR-003/SC-004). Track an in-flight background-refresh flag per connection for T015 to consume. (Same file — sequential.)
- [ ] T009 [US1] In `src/context/DataProviderContext.tsx`, rewire the existing manual `refresh()` (exposed via `useSourceSync()`) to force a re-fetch by bumping `fetchSeq` and clearing `coveredRanges` for every connection, reusing the same fetch path as T005/T008 rather than a second parallel fetch implementation — and ensure it doesn't fire a duplicate fetch if a background staleness refresh (T008) is already in flight for the same connection (FR-004; edge case: manual + background dedupe). (Same file — sequential.)
- [ ] T010 [P] [US1] Create `src/hooks/useResolvedEvents.ts`: a single `useMemo` over `[events, rules, types, connections]` from the relevant stores, returning `Map<CalendarEvent["id"], { type: EventType; hidden: boolean }>` by calling the existing `resolveEventType`/`isEventHidden` from `src/components/events/EventChip.tsx` once per event (research.md Decision F). Different file from T005–T009 — can be built in parallel.
- [ ] T011 [US1] In `src/components/events/EventChip.tsx`, keep `resolveEventType`/`isEventHidden`/`resolveStyle` exported as pure functions (unchanged behavior — they're now called once per event by `useResolvedEvents`, T010, instead of ad hoc per view); remove no public API, just confirm nothing outside `useResolvedEvents` still calls them per-event in a loop. (Depends on T010.)
- [ ] T012 [US1] Refactor `src/components/calendar/MonthView.tsx`: replace `getEventsForDay`'s per-day linear filter with a single `useMemo` bucketing (already hidden-filtered) events into `Map<dayKey, CalendarEvent[]>` (research.md Decision G); consume `useResolvedEvents()` (T010) instead of calling `resolveEventType`/`isEventHidden` inline; wrap `DayCell`, `EventChip` usage sites, `AvatarBadge`, and `OverflowPopover` in `React.memo` with stable callback props (research.md Decision H). (Depends on T010.)
- [ ] T013 [P] [US1] Apply the same day-bucketing + `useResolvedEvents()` + `React.memo` treatment to `src/components/calendar/TimeGridView.tsx`. (Depends on T010; parallel with T012 — different file.)
- [ ] T014 [P] [US1] Apply the same treatment to `src/components/calendar/AgendaView.tsx`. (Depends on T010; parallel with T012/T013 — different file.)

**Checkpoint**: User Story 1 is fully functional and independently testable — cached navigation is instant, new ranges only fetch their delta, stale data refreshes in the background without blanking, and rules resolution/rendering no longer redo work on every render. No display/rules/theming/quick-hide regressions (FR-014).

---

## Phase 4: User Story 2 - Always know whether the calendar is up to date (Priority: P2)

**Goal**: A small, non-intrusive global indicator in the header shows idle/syncing/error, derived from (and always consistent with) the existing per-connection status dots and "last updated" timestamp — visible without opening the sidebar.

**Independent Test**: Trigger a background refresh (staleness or manual) and confirm the indicator goes idle → syncing → idle; point a connection at an invalid URL and confirm it shows an error state (spec.md Acceptance Scenarios 1–4).

### Implementation for User Story 2

- [ ] T015 [US2] In `src/context/DataProviderContext.tsx`, expose `isBackgroundRefreshing: boolean` and a derived `SyncState` (T001's type) from `useSourceSync()`, computed from the existing `statusMap` plus the background-refresh-in-flight tracking added in T008: `syncing` if any status is `loading` or a background refresh is running, `error` if any status is `error` and nothing is currently `loading`/refreshing, else `idle` (data-model.md). (Depends on T008.)
- [ ] T016 [P] [US2] Create `src/components/sidebar/SyncIndicator.tsx`: renders nothing in the `idle` state, a small spinner in `syncing`, and a small error badge in `error`, reading `SyncState` from `useSourceSync()` (T015); syncing/error states carry `aria-live="polite"` text and `aria-label`led icons (research.md Decision I; Constitution Accessibility gate). Can be authored in parallel with T015 (different file), wired together in T017.
- [ ] T017 [US2] Mount `<SyncIndicator />` in `src/components/sidebar/Header.tsx`, next to the "Today" button. (Depends on T015, T016.)

**Checkpoint**: User Stories 1 and 2 both work independently — the global indicator never disagrees with the sidebar's per-connection dots (FR-009).

---

## Phase 5: User Story 3 - Fast first load (Priority: P3)

**Goal**: The very first fetch of a session shows a clear loading skeleton instead of an empty/unstyled grid, replaced cleanly by real content with no flash.

**Independent Test**: Hard-reload the app and confirm a skeleton is visible immediately, replaced by real events once the first fetch completes, with no empty-grid flash (spec.md Acceptance Scenarios 1–2).

### Implementation for User Story 3

- [ ] T018 [US3] In `src/context/DataProviderContext.tsx`, ensure `setEvents` (which sets `hasLoadedOnce`, T004) is called on the very first successful fetch resolution of the session, before any cache-serve/background-refresh paths (T005–T009) could otherwise skip calling it. (Depends on T004, T005.)
- [ ] T019 [P] [US3] Create `src/components/calendar/CalendarSkeleton.tsx`: a placeholder grid matching the current view's rough layout, marked `aria-busy="true"`/`aria-hidden="true"` so it doesn't announce as real content (Constitution Accessibility gate; research.md Decision J). Independent file — can be authored in parallel with T018.
- [ ] T020 [US3] In `src/components/calendar/CalendarGrid.tsx`, render `<CalendarSkeleton />` in place of the view switcher while `!useEventsStore().hasLoadedOnce` and a fetch is in flight; every subsequent load (including background refreshes) continues to render the real grid, never the skeleton (FR-010; must not regress SC-004). (Depends on T018, T019.)

**Checkpoint**: All three user stories are independently functional. Full feature complete pending Polish.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Run the full manual QA pass in `specs/008-events-perf-caching/quickstart.md` (all 11 steps) against `npm run dev`, using the seeded demo source plus at least one real `.ics` feed.
- [ ] T022 [P] Verify `tsc -b`, `npm run lint`, and `npm run build` all pass with zero errors/warnings (Constitution Quality Gates).
- [ ] T023 Update `docs/ARCHITECTURE.md`'s "Event sync" section to document the range cache, delta-fetch behavior, stale-while-revalidate refresh, and the new global `SyncIndicator` — matching this repo's existing convention of keeping that document in sync with every shipped feature (see its "Building blocks" table).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: No dependency on Setup's T001 (different concern) but conventionally follows it; T002–T004 have no dependencies on each other. Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (T002 for T005–T009; T003 indirectly via T010; nothing needs T001/T004 directly except T004 is reused later by US3).
- **User Story 2 (Phase 4)**: Depends on T001 (`SyncState` type) and T008 (background-refresh tracking) from Phase 2/3 — cannot start until T008 is done, since it derives its state from that tracking.
- **User Story 3 (Phase 5)**: Depends on T004 (Foundational) and T005 (US1's fetch-serving path) — needs the real fetch flow in place to know when "first load" actually completes.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 — fully independently testable once Foundational is done.
- **US2 (P2)**: Reads state produced by US1's T008 (background-refresh tracking) — build after US1, or after T008 specifically if working ahead of the rest of US1.
- **US3 (P3)**: Reads T004 (Foundational) and needs US1's T005 fetch path wired up to know when the first fetch resolves — build after US1's T005, can run alongside US2.

### Parallel Opportunities

- T002, T003, T004 (Phase 2) — different files, no cross-dependency.
- T010 (Phase 3) can start as soon as Phase 2 is done, in parallel with T005–T009 (different files).
- T012, T013, T014 (Phase 3) — different view files, all depend only on T010, safe in parallel with each other.
- T016 (Phase 4) can be authored in parallel with T015 (different files), wired together in T017.
- T019 (Phase 5) can be authored in parallel with T018 (different files), wired together in T020.
- T021, T022 (Phase 6) — independent verification passes, safe in parallel.

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Create src/lib/event-cache.ts: ConnectionCacheEntry + computeFetchKey/computeGaps/mergeFetchedRange/isStale"
Task: "Add compiled-RegExp cache for name-type rules in src/lib/rules.ts"
Task: "Add hasLoadedOnce field to useEventsStore in src/store/index.ts"
```

## Parallel Example: Phase 3 (User Story 1), after T010 lands

```bash
Task: "Apply day-bucketing + useResolvedEvents + React.memo to src/components/calendar/MonthView.tsx"
Task: "Apply day-bucketing + useResolvedEvents + React.memo to src/components/calendar/TimeGridView.tsx"
Task: "Apply day-bucketing + useResolvedEvents + React.memo to src/components/calendar/AgendaView.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1) — T005 through T014.
3. **STOP and VALIDATE**: run quickstart.md steps 1–3, 6, 9–11 (the US1-relevant checks) manually.
4. This alone delivers the largest share of the perceived speedup (spec.md User Story 1's "Why this priority").

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 (Phase 3) → validate independently → this is the MVP.
3. Add US2 (Phase 4) → validate the global indicator against quickstart.md step 7.
4. Add US3 (Phase 5) → validate the first-load skeleton against quickstart.md step 8.
5. Polish (Phase 6) → full quickstart.md pass + quality gates + docs update.

### Notes

- [P] tasks touch different files with no unmet dependency — safe to hand to parallel workers/agents.
- T005–T009 all edit `src/context/DataProviderContext.tsx` and are intentionally sequential (same-file conflict avoidance), even though they're all `[US1]`.
- No test tasks are included (no automated test framework in this repo — see Tests note above); Phase 6's T021 is the verification pass in place of automated tests.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently before moving on.
