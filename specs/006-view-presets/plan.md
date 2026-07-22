# Implementation Plan: View Presets

**Branch**: `006-view-presets` | **Date**: 2026-07-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-view-presets/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a new `usePresetStore` Zustand slice that lets users save the current combination of connection/event-type `hidden` flags (already introduced by `004-quick-hide`) under a name, and re-apply it later in one click. A `Preset` is `{ id, name, connections: Record<connectionId, hidden>, eventTypes: Record<eventTypeId, hidden> }` — a snapshot of booleans only, nothing else. `applyPreset` writes those booleans back onto the live connections/event types via the existing `updateConnection`/`updateType` actions, mirroring how `useConnectionStore.removeConnection` already reaches into `useRuleStore` today. The UI is a new "Presets" section in `Sidebar.tsx`, built the same way as the existing "Sources"/"Types" sections (using the existing `SectionHeader` + row-list pattern) rather than a Radix Popover/Dialog — presets are expected to be a frequent, primary action (this feature is the explicit foundation for a future keyboard-shortcut 1/2/3… switcher), so keeping them always visible in the sidebar outranks the theme selector's low-frequency popover treatment. Rename and "update to current state" both reuse the single `updatePreset(preset)` full-object-replace action (same convention as `updateTheme`/`updateType`); delete and duplicate-name-overwrite reuse the existing two-step `confirmingDelete` inline-confirm pattern from `EventTypeModal`/`ThemeEditorDialog`.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 / React 19.2.0
**Primary Dependencies**: Next.js 15.5 (App Router), Zustand 5.0.11, Tailwind CSS 3.4, lucide-react — no new dependency (no Radix needed; see research.md Decision 3)
**Storage**: localStorage via Zustand `persist` middleware — new key `webcal:presets`, alongside existing `proton-cal:ui`, `proton-cal:event-types`, `proton-cal:themes`, `webcal:connections`, `webcal:rules`
**Testing**: `npm run lint` + `tsc -b` (no test runner configured in this repo — pre-existing condition, see Complexity Tracking)
**Target Platform**: Browser (PWA, all modern browsers), Next.js App Router client components
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Applying a preset is a synchronous loop over existing in-memory arrays (typically 1-10 connections/types) calling existing store actions — no measurable cost beyond what individual hide-toggles already cost today
**Constraints**: No new npm dependencies; presets capture only connection/event-type visibility, not calendar view/date/theme (spec Assumptions) — those are separate backlog items that will build on top of this one
**Scale/Scope**: Single-user local config; ~1 new file (`src/lib/presets.ts`) + 1 new component (`PresetSelector.tsx`) + edits to `src/store/index.ts`, `src/types/index.ts`, `src/components/sidebar/Sidebar.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Component-First Architecture**: New `PresetSelector` is a single, self-contained section component following the existing `Sidebar.tsx` "Sources"/"Types" section pattern (reuses `SectionHeader`, adds a sibling `PresetRow`).
- [x] **Type Safety**: New `Preset` interface in `src/types/index.ts`; no `any` introduced. `usePresetStore` fully typed like existing `useEventTypeStore`/`useConnectionStore`/`useThemeStore`.
- [x] **State Management Discipline**: New global, cross-cutting concern → new Zustand `persist` store slice (`usePresetStore`), not crammed into an existing store. Cross-store reads/writes (`applyPreset`/`addPreset` reaching into `useConnectionStore`/`useEventTypeStore`) reuse the existing precedent set by `removeConnection` → `useRuleStore.getState().removeRulesForConnection(id)`.
- [x] **Accessibility**: Plain semantic list/button markup, same as the existing "Sources"/"Types" rows it's modeled on (no new interactive primitive introduced, so no new a11y surface beyond what those rows already establish).
- [x] **Visual Consistency**: Tailwind CSS only, matching `ConnectionRow`/`TypeRow` styling exactly (size, spacing, hover states, group-hover icon reveal).
- [x] **Data Provider Abstraction**: Not touched — this feature has no relationship to calendar data providers, only to connection/event-type visibility, which is orthogonal to the provider interface.
- [x] **Simplicity & YAGNI**: One field (name) per preset → no dialog, no popover, no new dependency (research.md Decision 3). Reuses existing `updatePreset`-as-full-replace and `confirmingDelete` idioms instead of inventing new ones. No preset limit, no per-device/per-account scoping — matches spec Assumptions exactly, nothing extra.
- [x] **Technology Stack**: Uses only already-approved/present dependencies (Zustand, Tailwind, lucide-react). Note: constitution v1.0.0 text still says "Vite 7" / "react-router-dom"; the repo has since been migrated to Next.js 15.5 App Router (pre-existing drift, also noted in `005-global-theming/plan.md`) — this plan follows the actual current stack, not the stale constitution wording. No new deviation introduced by this feature.
- [x] **Performance Targets**: No network requests added; applying a preset is a synchronous in-memory loop over already-small arrays (connections/types), same cost class as toggling one item's visibility today.
- [x] **Security**: No secrets, no new data leaving the browser. Preset data (name + boolean maps keyed by existing ids) is non-sensitive local preference data.
- [x] **Quality Gates**: `tsc -b` and `npm run lint` must pass; `npm run build` must succeed. (`npm test` has no script defined in this repo — pre-existing condition, not introduced by this feature; see Complexity Tracking.)

## Project Structure

### Documentation (this feature)

```text
specs/006-view-presets/
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
│   └── index.ts                          ← Add `Preset` interface
├── store/
│   └── index.ts                          ← Add `usePresetStore` (new persisted slice)
├── lib/
│   └── presets.ts                        ← NEW: capturePresetState() helper
└── components/
    └── sidebar/
        ├── Sidebar.tsx                    ← Add a "Presets" section (above "Sources"), mount <PresetSelector />
        └── PresetSelector.tsx             ← NEW: section list — save/apply/rename/update/delete presets
```

**Structure Decision**: Single Next.js App Router project (existing structure, no new top-level directories). All new files live under existing `src/lib/`, `src/types/`, `src/store/`, `src/components/sidebar/` — following the same per-concern placement used by `004-quick-hide` and `005-global-theming`. No new project, no new build target, no new dependency.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `npm test` has no script / no test framework in `package.json` | Pre-existing repo condition (same as noted in `005-global-theming/plan.md`) — not something this feature introduces or is scoped to fix | Adding a test framework (Vitest, etc.) to make `npm test` pass would be a new dependency and a scope expansion far beyond "view presets"; out of scope per task constraints ("don't introduce new dependencies") |
