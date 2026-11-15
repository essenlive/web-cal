# Implementation Plan: API serveur en lecture seule + flux .ics par preset

**Branch**: `009-server-ics-presets` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-server-ics-presets/spec.md`

## Summary

Add a server-side aggregation + feed layer alongside the existing client-only app: a Next.js route handler aggregates events (delegating actual source fetching to a self-hosted keeper.sh instance per `docs/planning/server-sync-architecture.md`), applies overcal's existing rules/types/presets resolution, and serves each preset as its own stable, token-protected `.ics` endpoint. Configuration (sources/types/rules/presets) is loaded server-side from the same settings-export JSON the client already produces — no new admin UI this phase, and the existing client is not wired up to this server yet.

## Technical Context

**Language/Version**: TypeScript ~5.9 (Node.js 20+ runtime) — same language as the existing client, new server runtime target
**Primary Dependencies**: Next.js App Router route handlers (reused from the existing app, one deployable unit); `ical.js` (already a dependency, used today only for parsing) reused to also *write* valid RFC 5545 `.ics` output via its `ICAL.Component`/`ICAL.Property` tree — no new writer dependency needed (research.md Decision D); keeper.sh's REST API reached with plain `fetch` (no SDK needed — it's a bearer-token JSON API); `better-sqlite3` for the config/feed-token store (new dependency, justified by `docs/planning/server-sync-architecture.md`'s own "commencer en SQLite" default: file-based, no extra service to run in the self-hosted container, synchronous API fits a small single-process aggregation job)
**Storage**: SQLite (one file) — holds the imported sources/types/rules/presets configuration, one opaque feed token per preset, and the last-aggregated-events snapshot per source (refreshed each aggregation cycle; feed requests are always served from this snapshot, never trigger a live fetch)
**Testing**: Vitest (already configured in the repo via `vitest.config.ts`) — unit tests for the extracted rules-resolution logic, the `.ics` generation, and feed-token handling; `curl`-level manual verification of a feed endpoint per quickstart.md, in place of the constitution's "manual testing in dev mode" (there is no UI to click through for this feature)
**Target Platform**: Linux server, self-hosted single Docker container (per the project's own deployment default — see Questions à trancher in `docs/planning/server-sync-architecture.md`)
**Project Type**: Web service (background scheduler + read-only HTTP API), added inside the existing repo alongside the current single-page web app — not a separate codebase
**Performance Goals**: A feed request is served from the cached snapshot in well under 1s regardless of source count (never re-fetches on request, per the spec's edge cases); one full aggregation cycle across all configured sources completes within a few minutes (spec SC-002)
**Constraints**: Strictly read-only against every source (spec FR-009/SC-005); feed URLs are opaque/unguessable tokens, since no login exists yet at this phase (spec FR-011); one broken source must never block feeds that don't depend on it (spec FR-010/SC-006)
**Scale/Scope**: Self-hosted, single-household scope (per the broader architecture plan) — on the order of a handful to a few dozen sources and presets, not a multi-tenant service

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

> **Note on applicability**: the constitution (ratified 2026-03-30) is written entirely for the client-side React app — most of its gates assume a UI is being added. This feature adds no UI; it's a backend aggregation/feed service. Gates below are marked N/A where they don't describe anything this feature touches, not skipped. The constitution's own "Technology Stack" list (React 19/Vite 7/react-router) is also stale against the project's actual current stack — CLAUDE.md records a Next.js 15.5 migration the constitution was never updated for. This plan follows CLAUDE.md (the more recently maintained source) rather than the constitution's stale list; a separate constitution amendment to reflect Next.js is worth doing but is out of scope here.

- [x] **Component-First Architecture**: N/A — no React components added by this feature.
- [x] **Type Safety**: Applies — TypeScript strict throughout, no `any`; new server types share `src/types` where the same entities apply (Rule, EventType, Connection, Preset).
- [x] **State Management Discipline**: N/A as written (it's about client Zustand/local state) — the equivalent discipline here is: the aggregation snapshot is the only server-side mutable state, written in one place (the scheduler), read everywhere else.
- [x] **Accessibility**: N/A — no UI.
- [x] **Visual Consistency**: N/A — no UI.
- [x] **Data Provider Abstraction**: Applies, extended — keeper.sh access sits behind one thin adapter module, mirroring the existing client `DataProvider` pattern, so the aggregation source could be swapped later without touching the rules/feed layer.
- [x] **Simplicity & YAGNI**: Applies — reuses the existing rules-resolution logic (extracted to be store-free, see research.md) rather than reimplementing it; no admin UI built this phase (settings-export JSON import instead, per spec Assumptions); every new dependency justified above in Technical Context.
- [x] **Technology Stack**: Partial, see note above — uses the project's actual current stack (Next.js/TypeScript), not the constitution's stale listed one.
- [x] **Performance Targets**: N/A as written (Lighthouse/bundle-size targets are client-specific) — this feature's own targets are stated in Technical Context instead.
- [x] **Security**: Applies — keeper.sh's bearer token lives only in a server-side environment variable, never reaches any client; feed URLs are opaque per-preset tokens (spec FR-011).
- [x] **Quality Gates**: Applies — `tsc -b`, `npm run lint`, `npm run build`, plus Vitest unit tests for the new server logic (no interactive "dev mode" check exists for a backend route, so quickstart.md's `curl` steps stand in for it).

## Project Structure

### Documentation (this feature)

```text
specs/009-server-ics-presets/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── feed-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Single project (existing repo) — the server lives inside the same Next.js app as a new, isolated slice, not a second codebase:

```text
src/
  server/                      # NEW — everything this feature adds, kept out of src/components, src/store, src/app (client-only today)
    aggregation/
      keeper-client.ts         # thin fetch-based adapter over keeper.sh's REST API (list_calendars/get_events-equivalent)
      scheduler.ts             # recurring aggregation cycle; writes the per-source snapshot, never blocks on one failing source
      snapshot-store.ts        # SQLite-backed read/write of the last-aggregated-events snapshot
    rules/
      resolve.ts                # store-free port of resolveEventType/isEventHidden (see research.md) — takes defaultType as a parameter instead of reading useEventTypeStore
    feeds/
      ics-writer.ts             # builds a valid .ics string (via ical-generator) from a preset's visible events
      tokens.ts                 # per-preset opaque feed token generation/lookup
    config/
      import.ts                 # loads a settings-export JSON (same format as the client's /data export) into the SQLite store
      db.ts                      # SQLite schema + connection (better-sqlite3)
  app/
    api/
      feed/[token]/route.ts     # NEW — GET, returns the matching preset's .ics content
      admin/import/route.ts     # NEW — POST, accepts a settings-export JSON to (re)configure the server
  lib/
    rules.ts                    # UNCHANGED — matchesRule/findMatchingRule already store-free, reused as-is by src/server/rules/resolve.ts
  types/
    index.ts                    # UNCHANGED — Rule/EventType/Connection/Preset types reused as-is

tests/
  server/
    rules-resolve.test.ts       # unit: ported resolution matches existing EventChip resolveEventType/isEventHidden behavior
    ics-writer.test.ts          # unit: generated .ics is valid and matches expected visible-event set
    scheduler.test.ts           # unit: one failing source doesn't block others; snapshot updates per cycle
```

**Structure Decision**: Single project, extended in place — this is explicitly phase 2 of a larger plan (`docs/planning/server-sync-architecture.md`) that keeps the client and server in the same repo for now (no `backend/`/`frontend/` split). The only genuinely new client-visible surface is two Next.js route handlers (`/api/feed/[token]`, `/api/admin/import`); everything else is new, server-only code under `src/server/`, isolated from the existing client code so this phase cannot regress the client-only app. `src/lib/rules.ts` and `src/types` are reused unmodified — the one real refactor is extracting `resolveEventType`/`isEventHidden` out of `EventChip.tsx` into a store-free function (research.md Decision), shared by both the browser and `src/server/rules/resolve.ts`.

## Complexity Tracking

No unjustified Constitution Check violations — every N/A above is a gate that doesn't describe this feature (no UI added), and every new dependency is justified inline in Technical Context. Nothing to track here.

**Post-Phase 1 re-check**: design (data-model.md, contracts/, quickstart.md) introduced nothing beyond what Technical Context already declared — same two new dependencies (`ical-generator`, `better-sqlite3`), same reuse of `src/lib/rules.ts`/`src/types`, one extraction (`resolveEventType`/`isEventHidden` made store-free, research.md Decision A). Constitution Check verdict is unchanged.

## Revision 2026-11-15: keeper.sh replaced by connectors

Decision (Quentin): keeper.sh brings far more than needed (accounts, billing, MCP, web UI, Postgres + Redis, AGPL). The server now reads and writes through its own small *connectors* (`src/server/connectors/`): ICS/WebCal (read-only, reusing the shared `src/lib/ics-parse.ts`) and CalDAV (read + create, via `tsdav`, verified against a real Radicale). Endpoint credentials are attached to a connection id through an `endpoints` array in the import JSON and stored encrypted (AES-256-GCM, `SECRET_KEY`). `POST /api/events` creates an event on a writable endpoint. Anything above that mentions keeper.sh, `KEEPER_*` or `keeper-client.ts` is superseded by this section; Google/Microsoft OAuth endpoints, update and delete are deferred.
