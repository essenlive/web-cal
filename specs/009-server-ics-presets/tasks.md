# Tasks: API serveur en lecture seule + flux .ics par preset

**Input**: Design documents from `/specs/009-server-ics-presets/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/feed-api.md, quickstart.md

**Tests**: Included for the three areas plan.md's Technical Context explicitly calls out for Vitest coverage (rules-resolution parity, `.ics` validity, scheduler failure-isolation) — not exhaustive, per the spec's own scope.

**Organization**: Tasks are grouped by user story (spec.md) to keep each story independently testable.

## Path Conventions

Single project (existing repo) — see plan.md's Project Structure. New code lives under `src/server/`; the two new HTTP surfaces are `src/app/api/feed/[token]/route.ts` and `src/app/api/admin/import/route.ts`; tests under `tests/server/`.

---

## Phase 1: Setup

**Purpose**: Scaffolding for the new server slice, isolated from existing client code

- [x] T001 Create the `src/server/{aggregation,rules,feeds,config}/` directory structure per plan.md's Project Structure (empty `.gitkeep`-free — populated by Phase 2 tasks)
- [x] T002 [P] Add `better-sqlite3` to `package.json` (research.md Decision C) and install — no `.ics`-writing dependency needed, `ical.js` already in `package.json` covers it (research.md Decision D)
- [x] T003 [P] Create `tests/server/` directory, confirm the existing root `vitest.config.ts` already picks it up (no new Vitest config needed — verify with an empty placeholder test)

**Checkpoint**: New directories and dependencies exist; nothing functional yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Everything every user story depends on — config storage, source access, and the one real refactor to existing code

**⚠️ CRITICAL**: No user story task can start until this phase is complete

- [x] T004 Define the SQLite schema (connections/types/rules/presets tables, `FeedToken`, `SourceSnapshot`) in `src/server/config/db.ts` per data-model.md
- [x] T005 [P] Extract `resolveEventType`/`isEventHidden` out of `src/components/events/EventChip.tsx` into a store-free `src/server/rules/resolve.ts` that takes the default `EventType` as a parameter (research.md Decision A); update `EventChip.tsx`'s own call site to pass `useEventTypeStore.getState().getDefaultType()` explicitly so client behavior is unchanged
- [x] T006 [P] Implement `src/server/aggregation/keeper-client.ts`: a `fetch`-based adapter over keeper.sh's REST API (`list_calendars`, `get_events`), reading `KEEPER_BASE_URL`/`KEEPER_API_TOKEN` from the server environment (research.md Decision B)
- [x] T007 Implement `src/server/aggregation/snapshot-store.ts`: read/write one `SourceSnapshot` row per connection (depends on T004)
- [x] T008 Implement `src/server/config/import.ts`: parse a settings-export JSON (same shape the client's `/data` export produces), write connections/types/rules/presets into SQLite, and create/delete `FeedToken` rows to match the imported preset set (depends on T004)
- [x] T009 Implement `POST /api/admin/import` in `src/app/api/admin/import/route.ts` wiring to `import.ts`, returning the `{ importedPresets, importedConnections, feedUrls }` shape from contracts/feed-api.md (depends on T008)
- [x] T010 [P] Implement `src/server/feeds/tokens.ts`: generate a unique opaque token per preset and look up a preset by token (depends on T004; research.md Decision E — token is independent of the preset's own id)

**Checkpoint**: Config can be imported and stored; sources can be fetched from keeper.sh; the rules engine can run outside the browser. No feed exists yet.

---

## Phase 3: User Story 1 - S'abonner à un preset depuis un calendrier tiers (Priority: P1) 🎯 MVP

**Goal**: A preset's feed URL returns a valid `.ics` file whose events match what the overcal web app shows for that same preset.

**Independent Test**: Import a settings export, fetch the resulting feed URL (`curl` or a real calendar app), and confirm the returned calendar's events match that preset's visibility in the running client app.

### Tests for User Story 1

- [ ] T011 [P] [US1] Unit test in `tests/server/rules-resolve.test.ts`: the extracted `src/server/rules/resolve.ts` produces identical results to the existing `EventChip.tsx` `resolveEventType`/`isEventHidden` for the same event/rules/type-map fixtures
- [ ] T012 [P] [US1] Unit test in `tests/server/ics-writer.test.ts`: given a fixed set of resolved (visible/hidden) events, the generated `.ics` string contains exactly the visible ones and round-trips cleanly back through `ical.js`'s own parser

### Implementation for User Story 1

- [ ] T013 [US1] Implement `src/server/feeds/ics-writer.ts`: given a preset, resolve each event in its sources' `SourceSnapshot`s via `rules/resolve.ts`, and build a `.ics` string with `ical.js`'s `ICAL.Component`/`ICAL.Property` tree containing only visible events (depends on T005, T007)
- [ ] T014 [US1] Implement `GET /api/feed/[token]` in `src/app/api/feed/[token]/route.ts`: look up the preset via `tokens.ts`, return `404` if unknown, else call `ics-writer.ts` and return `text/calendar; charset=utf-8` — including a valid empty calendar when zero events are visible (spec FR-007) (depends on T010, T013)
- [ ] T015 [US1] Implement `src/server/aggregation/scheduler.ts` with a single `runAggregationCycle()` function that fetches every connection via `keeper-client.ts` and writes each result through `snapshot-store.ts`; call it once, synchronously, right after a successful `POST /api/admin/import` so a freshly imported preset has non-empty data to serve (depends on T006, T007, T009) — the *recurring* timer around this same function is User Story 2's job, not this one
- [ ] T016 [US1] Manual validation: run quickstart.md steps 1–4 end to end (import → wait for the one-off cycle from T015 → fetch feed → subscribe from a real calendar app) and confirm parity with the client app for the same preset/sources

**Checkpoint**: User Story 1 is fully functional — importing a config produces working, correct feed URLs.

---

## Phase 4: User Story 2 - Les flux restent à jour sans que personne ait overcal ouvert (Priority: P2)

**Goal**: Feeds reflect source changes on their own, on a recurring schedule, and one broken source never takes down feeds that don't depend on it.

**Independent Test**: With no browser tab open anywhere, change an event in a source, wait one cycle, and confirm the relevant feed picks it up; break one source and confirm other feeds still work.

### Tests for User Story 2

- [ ] T017 [P] [US2] Unit test in `tests/server/scheduler.test.ts`: when one connection's fetch throws, `runAggregationCycle()` still updates every other connection's `SourceSnapshot`, and the failing connection's previous `events`/`lastSyncedAt` are left untouched while `lastError` is set (spec FR-010)

### Implementation for User Story 2

- [ ] T018 [US2] Extend `scheduler.ts` so `runAggregationCycle()` wraps each connection's fetch in its own try/catch (one failure never aborts the cycle for other connections) and exposes a `startScheduler(intervalMs)` that re-invokes the cycle on a recurring timer, independent of any HTTP request (depends on T015)
- [ ] T019 [US2] Confirm (and adjust if needed) that `GET /api/feed/[token]` (T014) never itself triggers a fetch — it must only ever read the latest `SourceSnapshot`, so a calendar app polling every minute doesn't cause redundant source fetches (spec edge case)
- [ ] T020 [US2] Wire `startScheduler()` to run for the lifetime of the server process (e.g. a Next.js `instrumentation.ts` hook, appropriate for the single-container self-hosted deployment target), started once at boot rather than per-request (depends on T018)

**Checkpoint**: Feeds now update on their own over time; a single source outage is isolated.

---

## Phase 5: User Story 3 - Un flux colle toujours aux règles actuelles (Priority: P3)

**Goal**: Editing rules/visibility is reflected in a preset's feed on the very next fetch, at the same URL — and deleting a preset stops its feed.

**Independent Test**: Change a rule or a preset's visibility via re-import, re-fetch the same feed URL, and confirm the event set changes with no new URL involved; delete a preset and confirm its old feed URL 404s.

### Implementation for User Story 3

- [ ] T021 [US3] Confirm `ics-writer.ts`/the feed route re-run rules resolution against the CURRENT config on every request rather than any cached resolved-event list (adjust if T013/T014 cached anything beyond the raw `SourceSnapshot`)
- [ ] T022 [US3] In `config/import.ts` (T008), ensure a re-import diffs the previous preset set against the new one: presets no longer present have their `FeedToken` row deleted (so `GET /api/feed/[token]` starts returning `404` immediately, per spec FR-008), while presets still present keep their existing token (URL stability, spec FR-006)
- [ ] T023 [US3] Manual validation: re-import with one rule/preset-visibility change and confirm the same feed URL's content changes; re-import with one preset removed and confirm its old feed URL now 404s

**Checkpoint**: All three user stories work independently and together — feeds are correct, current, and stay stable across edits.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Document the new environment variables (`KEEPER_BASE_URL`, `KEEPER_API_TOKEN`) and the admin-import workflow, extending `docs/planning/server-sync-architecture.md` (or a new `docs/server-setup.md` if it grows beyond a short section)
- [ ] T025 Run `tsc -b`, `npm run lint`, and `npm run build` to confirm the new `src/server/*` code satisfies the project's existing quality gates (constitution's Quality Gates principle)
- [ ] T026 Run quickstart.md's full 6-step validation end to end as a final acceptance pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational; builds directly on US1's `scheduler.ts` (T015) by extending it, but US1's own feed-correctness behavior doesn't require US2 to exist — US1 is testable with just the one-off cycle.
- **User Story 3 (Phase 5)**: Depends on Foundational; builds on US1's `ics-writer.ts`/route (T013/T014) and Foundational's `import.ts` (T008) — independently testable via re-import, without needing US2's recurring scheduler.
- **Polish (Phase 6)**: Depends on whichever stories were completed.

### Within Each User Story

- Tests before implementation where tests exist (US1, US2).
- Foundational pieces (rules/resolve, keeper-client, snapshot-store, tokens) before anything that calls them.
- Each story's Checkpoint marks a fully working, independently demoable increment.

### Parallel Opportunities

- T002, T003 (Setup) in parallel.
- T005, T006, T010 (Foundational) in parallel — different files, no shared dependency between them.
- T011, T012 (US1 tests) in parallel.
- Across stories: once Foundational is done, US1 and the test-writing parts of US2/US3 could start in parallel if staffed, though US2/US3's *implementation* tasks build directly on US1's `scheduler.ts`/`ics-writer.ts` files, so in practice sequential (P1 → P2 → P3) is simplest for a single implementer.

---

## Parallel Example: Foundational phase

```bash
# Launch together once T004 (schema) exists:
Task: "Extract resolveEventType/isEventHidden into src/server/rules/resolve.ts"
Task: "Implement keeper-client.ts fetch adapter"
Task: "Implement feeds/tokens.ts token generation/lookup"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Unit test rules-resolve parity in tests/server/rules-resolve.test.ts"
Task: "Unit test ics-writer output in tests/server/ics-writer.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (critical — blocks everything)
3. Phase 3: User Story 1
4. **STOP and VALIDATE** via quickstart.md steps 1–4
5. This alone already delivers the spec's core promise: a working, correct feed URL per preset — even before the recurring scheduler (US2) or edit-stability guarantees (US3) are built.

### Incremental Delivery

1. Setup + Foundational → able to import config and fetch sources once.
2. + User Story 1 → feeds exist and are correct (MVP).
3. + User Story 2 → feeds stay current on their own, failures isolated.
4. + User Story 3 → feeds stay correct and stable across edits/deletes.
5. + Polish → docs, quality gates, full quickstart pass.

## Notes

- [P] tasks touch different files with no dependency between them.
- Every task names its exact file path per plan.md's Project Structure.
- Commit after each task or logical group, per the constitution's Commit Standards (conventional commit format, e.g. `feat(server): add ics-writer`).
