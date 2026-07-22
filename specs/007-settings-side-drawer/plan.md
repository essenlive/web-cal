# Implementation Plan: Settings Side Drawer

**Branch**: `007-settings-side-drawer` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-settings-side-drawer/spec.md`

## Summary

Replace the settings-related popups in the app — the five centered-modal / full-page settings surfaces (Preferences, Add/Edit Connection, Event Type editor, Rules manager, Theme editor) plus the keyboard-shortcuts popover — with the real shadcn/ui `Drawer` component (built on `vaul`), anchored to the right edge, so the calendar stays visible and live behind it and every settings surface shares one consistent component and animation. Event-related popups (the single-event preview and the multi-event "+N more" selector) intentionally remain centered `Dialog`s — see the Revision note. A single piece of transient UI state (which settings panel is active, plus its edit target) replaces the independent open-booleans that used to be scattered across `Sidebar.tsx`/`RulesPage.tsx`, so only one settings panel can ever be showing (satisfies FR-005) and every panel is dismissed the same way (Escape / outside click / close button / swipe, all free from `vaul`).

**Revision note**: The first implementation pass built a hand-rolled `ui/sheet.tsx` on the already-installed `@radix-ui/react-dialog` to avoid a new dependency. The user then explicitly asked for the actual shadcn `Drawer` component and its animation, and for the same treatment to apply to every popup in the app — which was done, converting the event-detail and day-overflow popups to `Drawer` too. A further follow-up then asked to keep event-related content (single-event preview, multi-event selector) as popup modals after all, so those two were reverted back to `Dialog`. See research.md Decisions 1 and 3 for the full history.

## Technical Context

**Language/Version**: TypeScript ~5.9.3, React 19.2.0
**Primary Dependencies**: Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, `vaul` ^1.1.2 (powers the canonical shadcn `Drawer` component, used for settings surfaces), `tailwindcss-animate` ^1.0.7 (required by the canonical `Drawer`'s overlay fade classes), `@radix-ui/react-dialog` (used for the event-detail and day-overflow `Dialog`s), lucide-react.
**Storage**: localStorage via Zustand `persist` middleware — no new persisted key; the drawer's "which panel is open" state is transient UI state added to the existing `useUIStore` and excluded from its `partialize`, same pattern already used there for other non-persisted fields
**Testing**: No automated test framework in this repo (see `package.json` scripts: `dev`/`build`/`lint` only) — verified manually via `npm run dev` plus a headless-Chromium (Playwright) smoke pass, exercising every settings action listed in spec SC-003
**Target Platform**: Web (desktop + mobile browsers), responsive per existing Tailwind breakpoints
**Project Type**: Single Next.js web app (no frontend/backend split)
**Performance Goals**: Drawer open/close feels instant (vaul's own transition, not Tailwind's `animate-*` utilities, drives the actual motion)
**Constraints**: Must not regress existing keyboard shortcuts (arrow-key navigation, 1/2/3 preset switching) which already guard against typing in inputs (`CalendarPage.tsx`) — same guard applies whether a panel is a centered modal or a side drawer, so no new guard logic is required
**Scale/Scope**: 5 settings surfaces (Preferences, Connections, Event Types, Rules, Theme) plus a 6th "shortcuts" panel, all converted to one drawer shell; the event-detail popup and the day-overflow popup separately converted to their own `Drawer` instances; ~13 files touched, plus one new `ui/drawer.tsx` primitive (`ui/sheet.tsx` and `ui/dialog.tsx` both deleted)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Component-First Architecture**: One new `SettingsDrawer` shell component + existing modal bodies extracted to content-only components, each keeping its single responsibility (connection form, event type form, rules list, theme editor, preferences, shortcuts reference).
- [x] **Type Safety**: `activeDrawer` state is a discriminated union (`{ panel: "connection" | "eventType" | "rules" | "theme" | "preferences" | "shortcuts"; ... } | null`), no `any`.
- [x] **State Management Discipline**: "Which panel is open" is cross-cutting UI state → belongs in the Zustand `useUIStore`, not component-local state (it used to be duplicated across `Sidebar.tsx` and `RulesPage.tsx` local `useState`, which is what caused the stacking problem FR-005 calls out). Content stays controlled/immutable.
- [x] **Accessibility**: The canonical shadcn `Drawer` (via `vaul`) preserves focus trap, Escape-to-close, and ARIA roles for free — same or better guarantees than the Radix Dialog-based modals it replaced.
- [x] **Visual Consistency**: `ui/drawer.tsx` is the canonical shadcn/ui recipe, using this project's `cn()`; dark/light theme handled by existing CSS variables, no new theme logic. Every popup in the app now shares this one component.
- [x] **Data Provider Abstraction**: N/A — presentation-only change, no data access logic touched.
- [x] **Simplicity & YAGNI**: One new dependency pair (`vaul`, `tailwindcss-animate`), added on explicit user instruction to use the real component rather than a hand-rolled approximation — an explicit request is one of the stated exceptions to the default no-new-dependency bias. No new persisted store key. `ui/dialog.tsx` and `@radix-ui/react-dialog` were deleted once nothing consumed them anymore (net reduction in primitives).
- [x] **Technology Stack**: `vaul`/`tailwindcss-animate` added deliberately per user request; everything else uses already-approved stack items (Next.js, Zustand, Tailwind, lucide-react).
- [x] **Performance Targets**: No meaningful new render cost — same form components, different popup shell.
- [x] **Security**: N/A — no credentials or secrets involved in this change.
- [x] **Quality Gates**: Verified with `npm run build` and `npm run lint` (clean at the pre-existing baseline), plus a headless-Chromium pass through every panel (per SC-003) and the event-detail/day-overflow popups.

## Project Structure

### Documentation (this feature)

```text
specs/007-settings-side-drawer/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # SKIPPED — no external interface (internal UI-only feature)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
  app/
    settings/page.tsx        # existing route — becomes a client redirect that opens
                              # the Preferences panel in the drawer instead of rendering a page
  components/
    ui/
      drawer.tsx               # canonical shadcn Drawer (vaul-based) — settings surfaces only
      dialog.tsx               # restored — event-detail and day-overflow popups use this, not Drawer
    settings/
      SettingsDrawer.tsx       # single shell; switches content by activeDrawer.panel (6 panels)
      AddConnectionModal.tsx   # content-only form
      EventTypeModal.tsx       # same
      RuleModal.tsx            # content-only form with a primitive-agnostic header (no
                                # DrawerHeader/DrawerTitle) — embedded inside both a Drawer
                                # (Rules panel, connection editor) and a Dialog (event detail)
    sidebar/
      Sidebar.tsx               # local open-booleans removed, calls useUIStore openDrawer(...)
      ThemeEditorDialog.tsx     # content-only
      ThemeSelector.tsx         # trigger updated to openDrawer("theme"); its own theme-picker
                                # Popover is intentionally left as-is (a selection menu, not a modal)
      ShortcutsHelp.tsx         # Popover replaced by ShortcutsPanel, a 6th drawer panel
    events/
      EventDetail.tsx           # single-event preview — stays a centered Dialog (reverted from Drawer)
    calendar/
      MonthView.tsx             # multi-event "+N more" selector — stays a centered Dialog (reverted)
  views/
    RulesPage.tsx               # rules list is drawer content (RulesPanel)
    SettingsPage.tsx            # Preferences JSX is drawer content (PreferencesPanel)
  store/
    index.ts                    # useUIStore gains `activeDrawer` (+ open/close actions),
                                 # excluded from persist via existing `partialize`
```

**Structure Decision**: Single Next.js project (existing `src/` layout, no new top-level directories). No `tests/` directory exists or is introduced — this repo has no automated test framework (manual verification via `npm run dev`/`build`/`lint`, per CLAUDE.md Commands and existing project convention).

## Complexity Tracking

*No constitution violations — this section is intentionally empty.*
