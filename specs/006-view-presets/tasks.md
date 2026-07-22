# Tasks: View Presets

**Input**: Design documents from `/specs/006-view-presets/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated (repo has no test framework configured; see plan.md Complexity Tracking).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup

*No setup needed — this feature extends the existing Next.js app only, no new project/tooling/dependency. Proceed to Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `Preset` type, the state-capture helper, and the persisted store slice that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] Add `Preset` interface to `src/types/index.ts` (per data-model.md: `id: string`, `name: string`, `connections: Record<string, boolean>`, `eventTypes: Record<string, boolean>`)
- [x] T002 [P] Create `src/lib/presets.ts` with `capturePresetState(connections, types): Pick<Preset, "connections" | "eventTypes">` (takes the live arrays as arguments rather than reading the stores itself, to avoid a circular import between `lib/presets.ts` and `store/index.ts`)
- [x] T003 Add `usePresetStore` to `src/store/index.ts`: state `{ presets: Preset[] }`; actions `addPreset(name)` (generates `id` via `crypto.randomUUID()`, calls `capturePresetState()`, appends to `presets`), `updatePreset(preset)` (full-object replace by `id`, matching the existing `updateTheme`/`updateType`/`updateConnection` convention), `removePreset(id)` (filters out by `id`), `applyPreset(id)` (finds the preset; for each connection in `useConnectionStore.getState().connections` whose `id` is a key in `preset.connections`, calls `updateConnection({ ...c, hidden: preset.connections[c.id] })`; same loop for `useEventTypeStore.getState().types` against `preset.eventTypes`); persisted via Zustand `persist` under key `"webcal:presets"` (depends on T001, T002)

**Checkpoint**: `tsc -b` compiles with zero errors. No UI yet — store is exercisable only via devtools/console at this point, confirming the plumbing works ahead of any UI.

---

## Phase 3: User Story 1 — Save the current visibility state as a preset (Priority: P1) 🎯 MVP

**Goal**: A new "Presets" section in the sidebar lets the user save the current connection/event-type visibility combination under a name.

**Independent Test**: Hide a subset of connections/event types, save the current state as a preset named "Work", change visibility again, confirm "Work" still appears in the list.

### Implementation for User Story 1

- [x] T004 [US1] Create `src/components/sidebar/PresetSelector.tsx`: a self-contained section (styled like the existing "Sources"/"Types" sections in `Sidebar.tsx` — label + a "+" icon button). Clicking "+" swaps it for an inline `<input>` (local state); submitting (Enter; Escape/blur cancels — see below) with a non-empty trimmed name (FR-009) checks `usePresetStore().presets` for a case-insensitive name collision — if none, calls `addPreset(name)`; if one exists, arms a two-step inline confirm (pressing Enter again with the same match still pending) before calling `updatePreset({ ...matchedPreset, ...capturePresetState() })` instead (FR-010). Below the header, render one row per `preset` in `presets`.
  - Implementation note: simplified "Enter/blur commits" to "Enter commits; Escape **or blur** cancels" for the add-new input, so clicking away never silently creates a half-typed preset — a small, deliberate deviation from the literal task wording, kept because it removes a footgun (Escape-then-blur double-fire) for no loss of capability.
  - T006 and T007-T009's row affordances (click-to-apply, rename, update, delete) were implemented in this same pass rather than as separate edits to the same ~200-line file — see note under Implementation Strategy.
- [x] T005 [US1] Mount `<PresetSelector />` in `src/components/sidebar/Sidebar.tsx` as a new section positioned above the existing "Sources" section (research.md Decision 5), with the same `border-t border-border` divider used between the existing sections (depends on T004)

**Checkpoint**: Saving a preset under a name works, duplicate/empty names are handled per FR-009/FR-010, and saved presets survive a reload (persisted). User Story 1 is independently complete and testable.

---

## Phase 4: User Story 2 — Apply a saved preset (Priority: P2)

**Goal**: Clicking a saved preset instantly re-applies its saved visibility combination to every connection and event type.

**Independent Test**: With two presets saved with different visibility combinations, selecting each in turn changes which connections/event types are shown, matching exactly what was saved — including when the preset references a since-deleted item (skipped, no error) or predates a newly-added item (left untouched).

### Implementation for User Story 2

- [x] T006 [US2] In `src/components/sidebar/PresetSelector.tsx`, make each preset row clickable: `onClick` calls `applyPreset(preset.id)` from `usePresetStore()` (depends on T004)

**Checkpoint**: Applying a preset works end-to-end, including the missing/new-item edge cases already handled by `applyPreset`'s key-lookup loop (T003). User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 — Manage saved presets (Priority: P3)

**Goal**: Users can rename a preset, re-capture its state, or delete it.

**Independent Test**: With one or more presets saved, rename one, update another to the current visibility state, and delete a third — each operation is reflected immediately in the list.

### Implementation for User Story 3

- [x] T007 [US3] In `src/components/sidebar/PresetSelector.tsx`, add a rename (pencil) icon per row: clicking it turns that row into an inline `<input>` pre-filled with the current name (local per-row editing state); Enter commits via `updatePreset({ ...preset, name: newName })` after the same empty/duplicate validation as T004 (FR-006, FR-009); a duplicate name shows an inline error and blocks commit rather than offering rename-as-overwrite (renaming onto another preset's name would raise an ambiguous "whose state wins" question that FR-010 doesn't actually require solving — it's satisfied here via the "choose a different name" branch); Escape or blur cancels without changes (depends on T004)
- [x] T008 [US3] In `src/components/sidebar/PresetSelector.tsx`, add an "update to current state" icon button per row (`RefreshCw` from lucide-react): `onClick` calls `updatePreset({ ...preset, ...capturePresetState() })` — no confirmation needed, since it only affects the preset being clicked (FR-007) (depends on T004)
- [x] T009 [US3] In `src/components/sidebar/PresetSelector.tsx`, add a delete icon per row using the existing two-step `confirmingDelete` pattern (per-row local state, matching `ThemeEditorDialog.tsx`/`EventTypeModal.tsx`): first click arms a "confirm?" state, second click while armed calls `removePreset(preset.id)` (FR-008) (depends on T004)

**Checkpoint**: Full preset CRUD works — save, apply, rename, update, delete. All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and end-to-end verification across all three stories.

- [x] T010 [P] Run `tsc -b` and `npm run lint`; fix any type or lint violations introduced across `src/types/index.ts`, `src/lib/presets.ts`, `src/store/index.ts`, `src/components/sidebar/PresetSelector.tsx`, `src/components/sidebar/Sidebar.tsx` — both clean; the 9 pre-existing lint errors/1 warning elsewhere in the repo are unchanged (confirmed via `git stash` diff against the base branch)
- [x] T011 Run `npm run build` and confirm it succeeds (per constitution Code Quality Gates) — succeeded
- [x] T012 Manually walk through `specs/006-view-presets/quickstart.md`'s "For QA / manual verification" steps in `npm run dev` — driven via a scripted Playwright session (save "Work"/"Personal", duplicate-name overwrite-confirm flow, apply, rename to "Home", two-step delete of "Work"); zero console/page errors, all assertions passed, screenshots confirm correct visual styling matching the existing Sources/Types sections

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only.
- **User Story 2 (Phase 4)**: Depends on Phase 2, and extends the row markup `PresetSelector.tsx` established in US1 (T004) — implement after US1.
- **User Story 3 (Phase 5)**: Depends on Phase 2, and likewise extends `PresetSelector.tsx`'s row markup from US1 (T004) — implement after US1 (independent of US2's click-to-apply handler).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- T004 (create `PresetSelector.tsx`) before T005 (mount it in `Sidebar.tsx`).
- T007, T008, T009 all extend the same row markup in `PresetSelector.tsx` — sequential, not parallel, to avoid edit conflicts in the same file region.

### Parallel Opportunities

- T001 and T002 can run in parallel (different files: `types/index.ts` vs `lib/presets.ts`) — T003 depends on both.
- Once US1 (T004/T005) lands, US2 (T006) and US3 (T007-T009) touch the same file (`PresetSelector.tsx`) and are simplest done sequentially by one person, even though they serve independent stories.
- Within Phase 6, T010 and T012 can run in parallel; T011 (`npm run build`) is best run after T010's fixes land.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: presets can be saved and are listed; duplicate/empty names handled; survives reload.
4. Note: without US2 (apply), saved presets can't yet be *used* — US1 alone is a weaker standalone MVP than usual (unlike `005-global-theming`'s US1, which was fully usable on its own). Shipping US1+US2 together is the practical minimum demo.

### Incremental Delivery

1. Foundational → Phase 3 (US1: save) → Phase 4 (US2: apply — first point where the feature delivers its core value) → Phase 5 (US3: manage) → Phase 6 (polish).
2. Each phase leaves the app in a fully working state — no phase depends on a *later* phase's code.

### Actual execution note

In practice, T004-T009 were all written in a single pass of `PresetSelector.tsx` rather than staged as separate edits — since US2 and US3 only add a handful of lines to rows T004 already scaffolds (an `onClick`, two icon buttons, one inline-edit branch), re-opening the same ~200-line file three times to add them incrementally would have been pure staging overhead with no independent-testability benefit (there's only one person implementing, not a team working in parallel). All acceptance scenarios for US1/US2/US3 were still verified independently in the Phase 6 QA pass.
