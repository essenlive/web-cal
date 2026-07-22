# Implementation Plan: Global Theming

**Branch**: `005-global-theming` | **Date**: 2026-07-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-global-theming/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the binary `darkMode` boolean toggle in `useUIStore` with a new `useThemeStore` Zustand slice that manages a list of named themes (2 built-in: "Light"/"Dark", plus user-created custom ones) and a `selectedThemeId`. Each theme is `{ id, name, mode: "light"|"dark", accent: hexColor }`. A new `src/lib/theme.ts` module converts a theme's `accent` hex + `mode` into the existing HSL CSS custom properties (`--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring`) by re-deriving hue/saturation from the picked color while reusing the app's existing lightness values per mode — so accent color changes without inventing new design tokens. `src/app/providers.tsx` applies the resolved theme's `mode` (as the existing `.dark` class) and CSS variable overrides on `<html>` in a `useEffect`, replacing its current `darkMode`-only effect. The Header's toggle button becomes a `ThemeSelector` popover (Radix Popover) listing all themes with a checkmark on the active one and an "Edit" affordance on custom ones; a `ThemeEditorDialog` (Radix Dialog, modeled on the existing `AddConnectionModal`/`EventTypeForm` patterns) handles create/edit/delete of custom themes inline from that popover — no Settings page changes. A one-time migration reads the legacy `proton-cal:ui` `darkMode` value to seed `selectedThemeId` on first load for existing users.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 / React 19.2.0
**Primary Dependencies**: Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, Radix UI (`@radix-ui/react-popover`, `@radix-ui/react-dialog` — both already dependencies), lucide-react
**Storage**: localStorage via Zustand `persist` middleware — new key `proton-cal:themes`, alongside existing `proton-cal:ui`, `proton-cal:event-types`, `webcal:connections`
**Testing**: `npm test && npm run lint` (no test runner currently configured in this repo — see Complexity Tracking; TypeScript strict + ESLint are the enforced gates)
**Target Platform**: Browser (PWA, all modern browsers), Next.js App Router client components
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Theme switch applies within a single animation frame (no visible flash); consistent with existing dark-mode toggle's `useEffect`-driven `classList.toggle`
**Constraints**: No new npm dependencies (native `<input type="color">` for accent picking, no color-picker library); accent color scope limited to the existing primary/accent/ring CSS variable trio, not a full palette editor
**Scale/Scope**: Single-user local config; ~2 new files (`src/lib/theme.ts`, `src/components/sidebar/ThemeEditorDialog.tsx`) + 1 new component (`ThemeSelector`, colocated in `Header.tsx` or split out) + edits to `src/store/index.ts`, `src/types/index.ts`, `src/app/providers.tsx`, `src/components/sidebar/Header.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Component-First Architecture**: New `ThemeSelector` (popover) and `ThemeEditorDialog` (create/edit/delete form) are separate, single-responsibility components, following the existing `AddConnectionModal` pattern.
- [x] **Type Safety**: New `Theme` interface in `src/types/index.ts`; no `any` introduced. `useThemeStore` fully typed like existing `useEventTypeStore`/`useConnectionStore`.
- [x] **State Management Discipline**: New global concern → new Zustand `persist` store slice (`useThemeStore`), not crammed into `useUIStore`. CSS variable application is a side effect isolated in `providers.tsx`'s `useEffect`, matching the existing `darkMode` effect it replaces.
- [x] **Accessibility**: Popover/Dialog via Radix (existing dependency) — full keyboard nav and focus management for free. Color swatch buttons follow the existing `role="radio"`/`aria-checked` pattern from `AddConnectionModal`'s `ColorPicker`.
- [x] **Visual Consistency**: Tailwind CSS + Radix, no inline styles except the dynamic accent color (already an established exception in this codebase, e.g. `EventTypeRow`, `ColorPicker`). Dark/light support is preserved and generalized, not replaced.
- [x] **Data Provider Abstraction**: Not touched — this feature has no relationship to calendar data providers.
- [x] **Simplicity & YAGNI**: Theme = name + mode + one accent color, matching the existing CSS variable set exactly (no new tokens invented). No color-picker dependency added. No Settings-page section added — CRUD lives in the same popover/dialog reachable from the header, per `/speckit.clarify` decision.
- [x] **Technology Stack**: Uses only already-approved/present dependencies (Zustand, Radix Popover/Dialog, Tailwind, lucide-react). Note: constitution v1.0.0 text still says "Vite 7" / "react-router-dom"; the repo has since been migrated to Next.js 15.5 App Router (commit `5835a49`, prior to this feature) — this plan follows the actual current stack, not the stale constitution wording. No new deviation introduced by this feature.
- [x] **Performance Targets**: No network requests added; theme application is a synchronous DOM/style write in a `useEffect`, same cost class as the existing dark-mode toggle.
- [x] **Security**: No secrets, no new data leaving the browser. Theme data (name/mode/hex color) is non-sensitive local preference data.
- [x] **Quality Gates**: `tsc -b` and `npm run lint` must pass; `npm run build` must succeed. (`npm test` has no script defined in this repo — pre-existing condition, not introduced by this feature; see Complexity Tracking.)

## Project Structure

### Documentation (this feature)

```text
specs/005-global-theming/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md         # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── ui-contracts.md  # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                          ← Add `Theme` interface
├── store/
│   └── index.ts                          ← Add `useThemeStore` (new persisted slice); leave `useUIStore.darkMode` as read-only migration source (deprecated, kept for one-time read; see research.md)
├── lib/
│   └── theme.ts                          ← NEW: hex↔HSL helpers, `resolveThemeCssVars(theme)`, built-in theme constants
├── app/
│   └── providers.tsx                     ← Replace `darkMode`-only effect with active-theme resolution + CSS var application
└── components/
    └── sidebar/
        ├── Header.tsx                    ← Replace toggle button with `<ThemeSelector />`
        ├── ThemeSelector.tsx              ← NEW: Radix Popover, lists themes, triggers ThemeEditorDialog
        └── ThemeEditorDialog.tsx          ← NEW: Radix Dialog, create/edit/delete a custom theme
```

**Structure Decision**: Single Next.js App Router project (existing structure, no new top-level directories). All new files live under existing `src/lib/`, `src/types/`, `src/store/`, `src/components/sidebar/` — following the same per-concern placement used by `002-custom-display-types` (event types) and `001-cloud-calendar-connector` (connections). No new project, no new build target.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `npm test` has no script / no test framework in `package.json` | Pre-existing repo condition (verified: no test runner in `devDependencies`, no `tests/` directory, no `*.test.*` files anywhere in `src/`) — not something this feature introduces or is scoped to fix | Adding a test framework (Vitest, etc.) to make `npm test` pass would be a new dependency and a scope expansion far beyond "global theming"; out of scope per task constraints ("don't introduce new dependencies") |
