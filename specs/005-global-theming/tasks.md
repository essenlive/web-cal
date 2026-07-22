# Tasks: Global Theming

**Input**: Design documents from `/specs/005-global-theming/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated (repo has no test framework configured; see plan.md Complexity Tracking).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup

*No setup needed — this feature extends the existing Next.js app only, no new project/tooling. Proceed to Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, theme resolution helpers, and the persisted store slice that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add `ThemeMode` and `Theme` types to `src/types/index.ts` (per data-model.md: `id`, `name`, `mode: "light"|"dark"`, `accent: string` hex)
- [x] T002 [P] Create `src/lib/theme.ts` with: `hexToHsl(hex)`, `hslToHex(h,s,l)`, `BUILTIN_THEMES` constant (`"light"` = `{name:"Light", mode:"light", accent:"#3e50f4"}`, `"dark"` = `{name:"Dark", mode:"dark", accent:"#5666f5"}` — matching the existing `hsl(234 89% 60%)` / `hsl(234 89% 65%)` primary values converted to hex), `getAllThemes(customThemes)`, `getActiveTheme(customThemes, selectedThemeId)` (falls back to `BUILTIN_THEMES[0]` if not found), and `resolveThemeCssVars(theme)` returning `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring` per the hue/saturation-swap formula in research.md Decision 1
- [x] T003 Add `useThemeStore` to `src/store/index.ts`: state `{ customThemes: Theme[], selectedThemeId: string }`, actions `addTheme`, `updateTheme`, `removeTheme`, `selectTheme`; persisted via Zustand `persist` under key `"proton-cal:themes"` with `partialize` returning both fields; `selectedThemeId`'s initial value is computed by a guarded, browser-only read of `localStorage.getItem("proton-cal:ui")` — if `state.darkMode === true`, seed `"dark"`, else seed `"light"` (research.md Decision 3 / spec FR-014)
- [x] T004 Update `src/app/providers.tsx`: replace the `useUIStore().darkMode`-only effect with one that reads `useThemeStore()`, computes `activeTheme = getActiveTheme(customThemes, selectedThemeId)`, and in a `useEffect` keyed on `[activeTheme.id, activeTheme.mode, activeTheme.accent]` sets `document.documentElement.classList.toggle("dark", activeTheme.mode === "dark")` and calls `document.documentElement.style.setProperty(k, v)` for each entry of `resolveThemeCssVars(activeTheme)`

**Checkpoint**: `tsc -b` compiles with zero errors. `npm run dev` loads the app unchanged in appearance (Header still has the old toggle button at this point — it gets replaced in US1). Manually setting `localStorage["proton-cal:themes"]` and reloading demonstrably changes the app's accent color, confirming the plumbing works ahead of any UI.

---

## Phase 3: User Story 1 — Switch Between Themes (Priority: P1) 🎯 MVP

**Goal**: The header toggle is replaced by a theme selector popover listing "Light" and "Dark" (and, once US2 exists, custom themes). Selecting a theme applies it app-wide immediately and the choice persists across reloads.

**Independent Test**: Open the theme selector, choose "Dark", confirm the whole app switches instantly, reload the page, confirm "Dark" is still active.

### Implementation for User Story 1

- [x] T005 [US1] Create `src/components/sidebar/ThemeSelector.tsx`: a Radix `Popover.Root`/`Popover.Trigger`/`Popover.Content` (styled like the existing `OverflowPopover` in `src/components/calendar/MonthView.tsx`). Trigger button replaces the old Sun/Moon button. Content lists `getAllThemes(customThemes)` (from `useThemeStore()`) as rows: a small color-dot swatch (`style={{ backgroundColor: theme.accent }}`), the theme name, and a `Check` icon (lucide-react) shown when `theme.id === selectedThemeId`; clicking a row calls `selectTheme(theme.id)` and closes the popover. Include a trailing "+ New theme" button (non-functional stub in this task — wired up in US2 T008).
- [x] T006 [US1] Update `src/components/sidebar/Header.tsx`: remove the `darkMode`/`toggleDark` destructuring from `useUIStore()` and the `Sun`/`Moon` toggle `<button>`; render `<ThemeSelector />` in the same position (Right section, before the Settings `<Link>`).

**Checkpoint**: Selector lists "Light" and "Dark" only (no custom themes yet). Switching between them is instant and app-wide. Reloading the page preserves the selection. User Story 1 is independently complete and testable.

---

## Phase 4: User Story 2 — Create and Name a Custom Theme (Priority: P2)

**Goal**: Users can create a new named theme (name + base mode + accent color) from the header selector; it appears in the list and can be selected, applying its base mode and accent color app-wide.

**Independent Test**: Create a theme named "Forest" (dark base, green accent) via the selector's "+ New theme" action, confirm it appears in the list, select it, confirm the app renders with a dark background and green primary/accent/focus-ring color.

### Implementation for User Story 2

- [x] T007 [US2] Create `src/components/sidebar/ThemeEditorDialog.tsx`: a Radix `Dialog.Root`/`Dialog.Content` (styled like `AddConnectionModal`'s dialog chrome). Props: `{ open, onOpenChange, theme?: Theme }`. Fields: Name `<input>`; Mode — two buttons ("Light"/"Dark") styled like `AddConnectionModal`'s webcal/caldav type picker; Accent — preset color swatches (reuse the `PRESET_COLORS` array style from `src/views/SettingsPage.tsx`) plus a native `<input type="color">` for a custom pick, styled like `EventTypeForm`'s color row. Validation: disable Save when `name.trim()` is empty or when `name.trim().toLowerCase()` matches any existing theme name (from `getAllThemes(customThemes)`) other than the theme being edited — show inline errors matching `EventTypeForm`'s `isDuplicate` pattern. When `theme` prop is absent (create mode), Save calls `useThemeStore().addTheme({ name, mode, accent })` and closes the dialog.
- [x] T008 [US2] Wire up the "+ New theme" button added in T005: in `src/components/sidebar/ThemeSelector.tsx`, add local state for a `ThemeEditorDialog` (`open`, and `undefined` theme for create mode), render `<ThemeEditorDialog open={...} onOpenChange={...} />` (no `theme` prop), and open it when "+ New theme" is clicked

**Checkpoint**: Creating "Forest" works end-to-end: appears in the selector, selectable, and applies dark mode + green accent throughout the UI (primary buttons, active view-switcher tab, focus rings). Duplicate and empty names are rejected. User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 — Edit and Delete Custom Themes (Priority: P3)

**Goal**: Users can edit an existing custom theme's name/mode/accent, and delete custom themes they no longer want. Built-in themes offer no edit/delete affordance.

**Independent Test**: Edit an existing custom theme's accent color, confirm the change applies immediately if it's the active theme; delete a different custom theme and confirm it disappears from the selector; delete the currently-active custom theme and confirm the app falls back to "Light".

### Implementation for User Story 3

- [x] T009 [US3] Extend `src/components/sidebar/ThemeEditorDialog.tsx` for edit mode: when the `theme` prop is present, pre-fill Name/Mode/Accent from it, and Save calls `useThemeStore().updateTheme({ ...theme, name, mode, accent })` instead of `addTheme`. Add a "Delete" button (shown only when `theme` is present) that requires one inline confirm click (state flag, matching `SettingsPage`'s lightweight `deletingTypeId` confirm pattern, without a "used by N" message since themes have no cross-references) before calling `useThemeStore().removeTheme(theme.id)` and closing the dialog.
- [x] T010 [US3] In `src/components/sidebar/ThemeSelector.tsx`, add a small edit (`Edit2`, lucide-react) icon button to each row whose `theme.id` is not one of `BUILTIN_THEMES`' ids, opening `ThemeEditorDialog` in edit mode (`theme={thatTheme}`) for that row; built-in rows ("Light", "Dark") render no edit or delete affordance at all.

**Checkpoint**: Editing a custom theme live-updates the app when it's active. Deleting the active custom theme falls back to "Light" (verifying `getActiveTheme`'s fallback from T002 actually gets exercised through the UI). Built-ins remain immutable in the UI. All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and end-to-end verification across all three stories.

- [x] T011 [P] Run `tsc -b` and `npm run lint`; fix any type or lint violations introduced across `src/types/index.ts`, `src/lib/theme.ts`, `src/store/index.ts`, `src/app/providers.tsx`, `src/components/sidebar/Header.tsx`, `src/components/sidebar/ThemeSelector.tsx`, `src/components/sidebar/ThemeEditorDialog.tsx`
- [x] T012 Run `npm run build` and confirm it succeeds (per constitution Code Quality Gates)
- [x] T013 Manually walk through `specs/005-global-theming/quickstart.md`'s "For QA / manual verification" steps 1–9 in `npm run dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only.
- **User Story 2 (Phase 4)**: Depends on Phase 2. Adds the "+ New theme" wiring into the `ThemeSelector` built in US1 (T005), so in practice implement after US1, though the dialog component itself (T007) has no code dependency on US1's files.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and on `ThemeEditorDialog` existing (T007, from US2) since it extends the same file for edit mode.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- T005 (ThemeSelector) before T006 (wiring it into Header) — same story, sequential, same-ish area of the tree.
- T007 (ThemeEditorDialog create mode) before T008 (wiring "+ New theme" to it).
- T009 (ThemeEditorDialog edit mode) before T010 (wiring per-row edit icon to it).

### Parallel Opportunities

- T001 and T002 can run in parallel (different files: `types/index.ts` vs `lib/theme.ts`) — T003 depends on both.
- Within Phase 6, T011 and T013 can run in parallel; T012 (`npm run build`) is best run after T011's fixes land.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: theme selector replaces the toggle, Light/Dark switching works and persists.
4. This alone is a strict superset of the old toggle's behavior and is shippable on its own.

### Incremental Delivery

1. Foundational → Phase 3 (US1, MVP: selector replaces toggle) → Phase 4 (US2: create custom themes) → Phase 5 (US3: edit/delete) → Phase 6 (polish).
2. Each phase leaves the app in a fully working state — no phase depends on a *later* phase's code.
