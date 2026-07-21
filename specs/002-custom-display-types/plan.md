# Implementation Plan: Custom Events Display Types

**Branch**: `002-custom-display-types` | **Date**: 2026-03-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-custom-display-types/spec.md`

## Summary

Extend the existing event type system to support a `timedStyle` property (currently timed events always render as "block" regardless of type), allow calendar connections to specify a default display type for all their events, and add `customTimedStyle` for per-event custom overrides. All changes are additive to existing types, stores, and components — no new dependencies or stores required.

## Technical Context

**Language/Version**: TypeScript 5.9+ / React 19.2.0
**Primary Dependencies**: Zustand 5.0.11, Tailwind CSS 3.4, Radix UI, lucide-react, date-fns 4.1.0, react-router 7
**Storage**: localStorage via Zustand persist middleware (`proton-cal:event-types`, `webcal:connections`)
**Testing**: `npm test && npm run lint` (TypeScript strict + ESLint)
**Target Platform**: Browser (PWA, all modern browsers)
**Project Type**: Web application (SPA/PWA)
**Performance Goals**: Calendar render < 500ms for 100 events; bundle < 300KB gzipped
**Constraints**: No external data changes (display types are local-only); CalDAV/WebCal providers unchanged
**Scale/Scope**: Single-user local config; ~7 files modified, 0 new files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Component-First Architecture**: Changes extend existing components (`EventChip`, `EventTypeForm`, `ConnectionRow`, `EventModal`) with clear single responsibilities. No monolithic handlers introduced.
- [x] **Type Safety**: All new fields are explicitly typed (`timedStyle: DisplayStyle`, `displayTypeId?: string`, `customTimedStyle?: DisplayStyle`). No `any` added (existing `Icons as any` usage is unchanged and pre-existing).
- [x] **State Management Discipline**: New fields go into existing Zustand stores with persist. Display type resolution is pure presentation logic in component layer, not mixed into stores or provider.
- [x] **Accessibility**: Existing Radix UI and Tailwind patterns extended. New selectors follow existing button/toggle patterns with keyboard support.
- [x] **Visual Consistency**: New UI elements (timed style picker, connection display type selector) use existing `STYLE_OPTIONS`, color/icon patterns, and Tailwind classes from the current codebase.
- [x] **Data Provider Abstraction**: DataProviderContext is not modified. Display type is presentation-only; no CalDAV/WebCal logic touched.
- [x] **Simplicity & YAGNI**: No new abstractions beyond extending existing helpers. `resolveEventType()` extended in-place. No separate hook unless complexity warrants it during implementation.
- [x] **Technology Stack**: React 19, TypeScript 5.9+, Vite, Tailwind, Radix, Zustand, lucide-react — all unchanged.
- [x] **Performance Targets**: Changes are reactive Zustand reads; no additional network requests or expensive computations. Calendar render cost unchanged.
- [x] **Security**: No new data leaving the browser. `displayTypeId` is a local reference. No credential handling.
- [x] **Quality Gates**: TypeScript strict compilation must pass; `npm run lint` zero warnings; `npm run build` must succeed.

## Project Structure

### Documentation (this feature)

```text
specs/002-custom-display-types/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — entity definitions and resolution chain
├── quickstart.md        # Phase 1 — developer guide
├── contracts/
│   └── ui-contracts.md  # Phase 1 — TypeScript interface contracts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts              ← Add timedStyle, displayTypeId?, customTimedStyle?
├── store/
│   └── index.ts              ← Update migrateType(), DEFAULT_EVENT_TYPES
├── components/
│   ├── events/
│   │   ├── EventChip.tsx     ← Update resolveEventType(), resolveStyle()
│   │   └── EventModal.tsx    ← Add customTimedStyle picker for "custom" events
│   └── settings/
│       ├── ConnectionList.tsx ← Add display type selector to ConnectionRow
│       └── BackendSettings.tsx ← Wire onUpdate + eventTypes props
└── pages/
    └── SettingsPage.tsx      ← Add timedStyle picker + duplicate name validation to EventTypeForm
```

**Structure Decision**: Single-project SPA. All changes within `src/`. No new directories needed.

## Complexity Tracking

No constitution violations. All changes are straightforward extensions of existing patterns.
