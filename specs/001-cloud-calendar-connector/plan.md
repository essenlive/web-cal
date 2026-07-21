# Implementation Plan: Cloud Calendar Provider Connector

**Branch**: `001-cloud-calendar-connector` | **Date**: 2026-03-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-cloud-calendar-connector/spec.md`

## Summary

Enable users to connect one or more CalDAV and WebCal (ICS) calendar sources simultaneously, replacing the current single-backend model with a multi-connection architecture. Events from all active connections are merged into the unified calendar view with per-connection colour differentiation. The existing `WebCalProvider` and `CalDAVProvider` implementations are reused as-is; the primary work is a new composite provider, an updated connection store, and a revised settings UI.

## Technical Context

**Language/Version**: TypeScript ~5.9.3
**Primary Dependencies**: React 19.2.0, Zustand 5.0.11, date-fns 4.1.0, Radix UI, Tailwind CSS 3.4, lucide-react, react-router 7
**Storage**: localStorage via Zustand `persist` middleware (`webcal:connections` key)
**Testing**: Manual testing in dev mode (`npm run dev`)
**Target Platform**: Desktop web browsers (PWA, Vite 7)
**Project Type**: Progressive Web App (SPA)
**Performance Goals**: Events from all connections appear within 10 s of successful authorisation; UI interactions < 100 ms
**Constraints**: Offline-capable PWA; credentials/tokens stored in localStorage only; no application backend server; CORS proxies user-configurable
**Scale/Scope**: Single-user; up to ~10 simultaneous calendar connections is the practical limit

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see ✅ markers.*

- [x] **Component-First Architecture**: New UI broken into `ConnectionList`, `AddConnectionModal`, and provider-specific form components, each independently testable.
- [x] **Type Safety**: All new code uses TypeScript strict mode. `Connection` union type uses a discriminated union on `type: "webcal" | "caldav"`. No `any` types.
- [x] **State Management Discipline**: Connection config persisted in new `useConnectionStore` (Zustand persist). Event fetching remains in `DataProviderContext`. Local UI state (modal open/close, form fields) uses `useState`.
- [x] **Accessibility**: Radix UI `Dialog` for add-connection modal, `Select` for provider type, keyboard-navigable connection list, ARIA status indicators for connection state.
- [x] **Visual Consistency**: Tailwind CSS only; Radix primitives for interactive elements; dark/light theme via existing CSS custom properties; connection colour indicators follow existing palette.
- [x] **Data Provider Abstraction**: New `MultiSourceProvider` implements `DataProvider` interface and delegates to individual `WebCalProvider` / `CalDAVProvider` instances. All calendar views consume `useDataProvider()` without change.
- [x] **Simplicity & YAGNI**: Reuses all three existing providers unchanged. `MultiSourceProvider` is the only new lib file. No new routing, no new global contexts.
- [x] **Technology Stack**: React 19, TypeScript 5.9+, Vite 7, Tailwind, Radix, Zustand, date-fns, lucide-react — all approved.
- [x] **Performance Targets**: Parallel fan-out in `MultiSourceProvider.getEvents()` keeps latency to the slowest single connection; no additional bundle weight; existing calendar render path unchanged.
- [x] **Security**: Credentials stay in localStorage; user-supplied CORS proxy only; no shared proxy introduced.
- [x] **Quality Gates**: `tsc -b`, `npm run lint`, `npm run build` must all pass with zero errors/warnings.

*No constitution violations — Complexity Tracking section omitted.*

## Project Structure

### Documentation (this feature)

```text
specs/001-cloud-calendar-connector/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── settings-ui.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
src/
├── types/
│   └── index.ts                       UPDATED — add Connection union type + ConnectionStatus
│
├── lib/
│   ├── data-provider.ts               no change
│   ├── webcal-provider.ts             no change
│   ├── caldav-provider.ts             no change
│   ├── mock-data-provider.ts          no change
│   └── multi-source-provider.ts       NEW — composite provider
│
├── store/
│   └── index.ts                       UPDATED — add useConnectionStore; deprecate useBackendStore
│
├── context/
│   └── DataProviderContext.tsx        UPDATED — instantiate MultiSourceProvider from connection store
│
└── components/
    └── settings/
        ├── BackendSettings.tsx        UPDATED — replaced by multi-connection UI shell
        ├── ConnectionList.tsx         NEW — lists active connections with status badges
        └── AddConnectionModal.tsx     NEW — Radix Dialog with provider-type form
```

**Structure Decision**: Single web-app project, feature-scope additions within existing `src/` tree. No new top-level directories required.
