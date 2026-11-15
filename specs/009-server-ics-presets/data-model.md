# Phase 1 Data Model: API serveur en lecture seule + flux .ics par preset

All entities below are server-side (SQLite, `src/server/config/db.ts`). Where an entity's shape already exists client-side in `src/types/index.ts`, the server reuses the same TypeScript type rather than defining a parallel one — only new, server-only entities (`FeedToken`, `SourceSnapshot`) are introduced here.

## Reused client entities (unchanged shape, imported from settings-export JSON)

- **Connection** (`WebCalConnection | DemoConnection`, `src/types/index.ts`): a calendar source. The server only ever needs `WebCalConnection` entries (`type: "webcal"`) — a `DemoConnection` in an imported export is accepted but produces no server-side fetch (it has no network source to aggregate; see Assumptions in spec.md).
- **EventType** (`src/types/index.ts`): display type a rule resolves to; only `hidden` and `id` matter to this feature (style fields are irrelevant without a UI, but kept as-is so round-tripping the export stays lossless).
- **Rule** (`src/types/index.ts`): ordered rule list; resolution logic (`matchesRule`/`findMatchingRule` in `src/lib/rules.ts`) is reused unmodified.
- **Preset** (`src/types/index.ts`): a saved `connections`/`eventTypes` visibility combination. Each `Preset` gains exactly one new server-side companion row: `FeedToken` (below) — the `Preset` type itself is not modified.

## New server-only entities

### FeedToken

One per `Preset`, created the first time that preset's configuration is imported/seen by the server.

| Field | Type | Notes |
|---|---|---|
| `presetId` | string | FK → `Preset.id` (from the imported config) |
| `token` | string | Opaque random identifier; this is what appears in the feed URL (`/api/feed/[token]`), never the preset's own id (research.md Decision E) |
| `createdAt` | number (epoch ms) | For diagnostics only |

**Lifecycle**: created when a preset is first seen on import; looked up by `token` on every feed request; deleted when its preset is removed from a later import (spec FR-008 — deleting the preset must stop serving its feed).

### SourceSnapshot

One per `Connection`, holding the last successfully aggregated result for that source.

| Field | Type | Notes |
|---|---|---|
| `connectionId` | string | FK → `Connection.id` |
| `events` | `CalendarEvent[]` (JSON) | The connection's events as last successfully fetched via keeper.sh; `CalendarEvent` is the existing client type, unchanged |
| `lastSyncedAt` | number (epoch ms) \| null | Null before the first successful cycle |
| `lastError` | string \| null | Set when the most recent attempt for this connection failed; does not clear `events`/`lastSyncedAt` (spec FR-010: a failing source keeps serving its last-known-good events) |

**Lifecycle**: written only by the aggregation scheduler, once per connection per cycle; read by the feed-generation path, which never triggers a fetch itself (always serves from this table).

### Imported configuration (sources/types/rules/presets)

Stored as the same shapes `src/types/index.ts` already defines, keyed by their own `id` fields, replaced wholesale on each settings-export import (`src/server/config/import.ts`) — there is no partial-update story for this phase, matching the client's existing all-or-nothing export/import behavior (`settings-export.ts`).

## Relationships

```text
Connection 1──* CalendarEvent (via SourceSnapshot.events, not a normalized table)
Connection 1──1 SourceSnapshot
Preset     1──1 FeedToken
Preset     *──* Connection   (via Preset.connections visibility map, existing shape)
Preset     *──* EventType    (via Preset.eventTypes visibility map, existing shape)
Rule       *──1 EventType    (via Rule.displayTypeId, existing shape)
```

## Validation rules (beyond existing client-side ones)

- A `FeedToken.token` MUST be unique across all presets (collision regenerates a new token rather than erroring the import).
- An imported `Preset` with no corresponding `Connection`/`EventType` entries in its visibility maps is valid — it simply means "no restriction," identical to today's client behavior.
- `SourceSnapshot.events` is only ever replaced atomically per connection (never partially merged) — a cycle either produces a fresh `events` array for that connection or leaves the previous one untouched on failure, never a mix of the two.
