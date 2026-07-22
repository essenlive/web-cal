# Tasks: Settings Side Drawer

**Input**: Design documents from `/specs/007-settings-side-drawer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No automated test framework exists in this repo (see plan.md Technical Context). Verification tasks below point at `quickstart.md` manual steps instead of automated test tasks.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md priorities P1/P2/P3) so each can be delivered and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single Next.js project — all paths are under `src/`, per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Build the one new reusable primitive every story needs. No new dependency, no new tooling — reuses the already-installed `@radix-ui/react-dialog`.

- [X] T001 Create `Sheet` primitive in `src/components/ui/sheet.tsx`: `Sheet`, `SheetTrigger`, `SheetPortal`, `SheetClose`, `SheetOverlay`, `SheetContent` (right-anchored: `fixed inset-y-0 right-0 h-full w-full sm:w-[420px]`, slide-in-from-right animation, own close (X) button), `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` — mirror the structure of `src/components/ui/dialog.tsx` exactly, built on the same `@radix-ui/react-dialog` import, only the `SheetContent` positioning/animation classes differ from `DialogContent`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared drawer state + shell that every user story plugs into.

**⚠️ CRITICAL**: No user story task can start until this phase is complete.

- [X] T002 In `src/store/index.ts`, add to `useUIStore`: `activeDrawer: { panel: "connection" | "eventType" | "rules" | "theme" | "preferences"; editId?: string } | null` plus `openDrawer(panel, editId?)` and `closeDrawer()` actions; add `activeDrawer` to the store's initial state and exclude it from the existing `partialize` (so it is never persisted to `proton-cal:ui`, matching research.md Decision 2).
- [X] T003 Create `src/components/settings/SettingsDrawer.tsx`: reads `activeDrawer` from `useUIStore`, renders a single `Sheet` (`open={activeDrawer !== null}`, `onOpenChange` calling `closeDrawer()` on close), and switches its body on `activeDrawer.panel` — start with an empty/placeholder body per panel case; each user story phase below fills in one case.
- [X] T004 Mount `<SettingsDrawer />` once in `src/components/sidebar/Sidebar.tsx` (it will replace the individual `<AddConnectionModal>`, `<EventTypeModal>`, `<RulesModal>` render sites removed in later phases).

**Checkpoint**: Drawer shell renders and opens/closes via store state, with no panel content wired up yet.

---

## Phase 3: User Story 1 - Live preview for event types & theme (Priority: P1) 🎯 MVP

**Goal**: Editing an event type's color or the theme updates the calendar immediately, with the calendar still visible behind the drawer.

**Independent Test**: Open the event type editor (or theme editor) from the sidebar, change a value, and confirm the calendar stays visible and updates live without closing the panel (quickstart.md Section 1).

### Implementation for User Story 1

- [X] T005 [P] [US1] In `src/components/settings/EventTypeModal.tsx`, remove the component's own `Dialog`/`DialogContent` wrapper so it exports content-only (form body + existing add/edit/delete logic and props unchanged).
- [X] T006 [P] [US1] In `src/components/sidebar/ThemeEditorDialog.tsx`, remove its own `Dialog`/`DialogContent` wrapper the same way, keeping the theme form content and existing props.
- [X] T007 [US1] In `src/components/settings/SettingsDrawer.tsx`, render the `EventTypeModal` content (from T005) when `activeDrawer.panel === "eventType"` (passing `editId` through as the type being edited) and the `ThemeEditorDialog` content (from T006) when `activeDrawer.panel === "theme"`.
- [X] T008 [US1] In `src/components/sidebar/Sidebar.tsx`, remove the local `typeModalOpen`/`editingType` state and the `<EventTypeModal>` render site; replace the "add type" and per-type "edit" triggers with `openDrawer("eventType")` / `openDrawer("eventType", type.id)`.
- [X] T009 [US1] In `src/components/sidebar/ThemeSelector.tsx`, replace its existing dialog-open trigger with `openDrawer("theme")`.
- [X] T010 [US1] Manually verify quickstart.md Section 1 (event type color change and theme change both update the still-visible calendar immediately).

**Checkpoint**: User Story 1 is fully functional and independently testable — event type + theme editing now live in the drawer.

---

## Phase 4: User Story 2 - Connections & rules without losing calendar context (Priority: P2)

**Goal**: Adding/editing a connection and managing rules happens in the same drawer pattern, calendar still visible throughout.

**Independent Test**: Open "Add/Edit Connection" and "Rules" independently from the sidebar; confirm both render as drawer content with the calendar visible, and all existing add/edit/delete/reorder actions still work (quickstart.md Section 2).

### Implementation for User Story 2

- [X] T011 [P] [US2] In `src/components/settings/AddConnectionModal.tsx`, remove its own `Dialog`/`DialogContent` wrapper so it exports content-only (form body + existing add/edit/delete logic and props unchanged).
- [X] T012 [P] [US2] In `src/views/RulesPage.tsx`, remove the exported `RulesModal`'s own `Dialog` wrapper; keep the rules list content, and handle "edit rule" as local view-state within this same content component (list view vs. rule-form view) rather than a nested dialog — this is what keeps only one panel ever open (FR-005) without adding new global state.
- [X] T013 [US2] In `src/components/settings/RuleModal.tsx`, remove its own `Dialog`/`DialogContent` wrapper so it's a content-only form, used inline by the rules content component from T012 (not rendered as its own `Sheet`/`Dialog`).
- [X] T014 [US2] In `src/components/settings/SettingsDrawer.tsx`, render the `AddConnectionModal` content (from T011, passing `editId`) when `activeDrawer.panel === "connection"`, and the rules content (from T012) when `activeDrawer.panel === "rules"`.
- [X] T015 [US2] In `src/components/sidebar/Sidebar.tsx`, remove the local `addConnOpen`/`editingConn` state and `<AddConnectionModal>` render site, and the `rulesModalOpen` state and `<RulesModal>` render site; replace their triggers with `openDrawer("connection")` / `openDrawer("connection", conn.id)` and `openDrawer("rules")`.
- [X] T016 [US2] Manually verify quickstart.md Section 2 (add connection, edit connection, reorder rule, edit rule — calendar stays visible and updates throughout).

**Checkpoint**: User Stories 1 AND 2 both work independently — connections and rules now live in the drawer alongside event types and theme.

---

## Phase 5: User Story 3 - Preferences accessible without leaving the calendar (Priority: P3)

**Goal**: Preferences (week start, 24h clock, date format) open in the drawer instead of navigating to a separate `/settings` page; the `/settings` URL keeps working.

**Independent Test**: Open Preferences from the sidebar and toggle "24h format"; confirm the change applies to the still-visible calendar without a page navigation occurring, and that visiting `/settings` directly still works (quickstart.md Section 3).

### Implementation for User Story 3

- [X] T017 [US3] In `src/views/SettingsPage.tsx`, extract the "Préférences" section (the three `Switch` rows) into a content-only component, dropping the full-page header/layout wrapper.
- [X] T018 [US3] In `src/components/settings/SettingsDrawer.tsx`, render the preferences content (from T017) when `activeDrawer.panel === "preferences"`.
- [X] T019 [US3] Update `src/app/settings/page.tsx` to be a client component that, on mount, calls `openDrawer("preferences")` and `router.replace("/")` instead of rendering `SettingsPage` directly — this is what keeps the existing `/settings` bookmark/link working per FR-007.
- [X] T020 [US3] In `src/components/sidebar/Sidebar.tsx`, change the Settings (gear) icon from `<Link href="/settings">` to a button calling `openDrawer("preferences")`.
- [X] T021 [US3] Manually verify quickstart.md Section 3 (preferences toggle updates calendar live; direct `/settings` visit still opens the drawer).

**Checkpoint**: All three user stories are independently functional — every settings surface now lives in the one drawer.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the cross-cutting requirements that span all five panels, then clean up.

- [X] T022 [P] Manually verify FR-005 (opening a different panel while one is open replaces its content, never stacks) and FR-004 (Escape / outside-click / close-button all dismiss every panel) — quickstart.md Sections 4-5.
- [X] T023 [P] Manually verify FR-008 (drawer remains fully usable at mobile width) — quickstart.md Section 6.
- [X] T024 Manually verify existing keyboard shortcuts (arrow-key navigation, 1/2/3 preset switching) are unaffected, per quickstart.md Section 7.
- [X] T025 Run `npm run build` and `npm run lint`; fix any resulting errors.
- [X] T026 Remove dead code left behind by the conversions above: unused `Dialog`/`DialogContent` imports in the five converted components, and any now-unused local open-state in `Sidebar.tsx` / `RulesPage.tsx` / `app/settings/page.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (`Sheet` primitive) — BLOCKS all user stories.
- **User Stories (Phase 3-5)**: All depend on Phase 2 completion. Each story phase touches its own files (see below) so they can proceed in priority order or in parallel if staffed.
- **Polish (Phase 6)**: Depends on all three user stories being complete (it verifies cross-cutting behavior across all five panels).

### User Story Dependencies

- **US1 (P1)**: `EventTypeModal.tsx`, `ThemeEditorDialog.tsx`, `ThemeSelector.tsx` — no dependency on US2/US3.
- **US2 (P2)**: `AddConnectionModal.tsx`, `RulesPage.tsx`, `RuleModal.tsx` — no dependency on US1/US3 (only shares `SettingsDrawer.tsx` and `Sidebar.tsx`, edited in non-overlapping regions).
- **US3 (P3)**: `SettingsPage.tsx`, `app/settings/page.tsx` — no dependency on US1/US2.

Note: T007/T014/T018 all edit `SettingsDrawer.tsx`, and T008/T015/T020 all edit `Sidebar.tsx` — these are sequential *within* that shared file across stories, not a story-level dependency (each adds its own `case`/trigger without touching the others').

### Parallel Opportunities

- Within US1: T005 and T006 (different files).
- Within US2: T011 and T012 (different files).
- Across stories, once Phase 2 is done: the content-conversion tasks (T005-T006, T011-T013, T017) can all be done in parallel by different people, since each touches a distinct component file. The shared-file wiring tasks (`SettingsDrawer.tsx`, `Sidebar.tsx`) should be applied sequentially to avoid merge conflicts.
- T022 and T023 (Polish) are independent verification passes and can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Different files, can run together:
Task: "Remove Dialog wrapper from src/components/settings/EventTypeModal.tsx"
Task: "Remove Dialog wrapper from src/components/sidebar/ThemeEditorDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Sheet primitive) + Phase 2 (drawer state + shell).
2. Complete Phase 3 (US1: event types + theme in the drawer).
3. **STOP and VALIDATE** with quickstart.md Section 1 — this alone already delivers the feature's core value (live preview) for the two most frequently-edited settings surfaces.

### Incremental Delivery

1. Setup + Foundational → drawer shell exists but is empty.
2. Add US1 → validate → the two highest-friction editors (event type, theme) no longer hide the calendar.
3. Add US2 → validate → connections and rules join the drawer.
4. Add US3 → validate → preferences join the drawer; `/settings` still resolves.
5. Polish → cross-cutting checks (mutual exclusion, dismissal, mobile, shortcuts) + build/lint clean.
