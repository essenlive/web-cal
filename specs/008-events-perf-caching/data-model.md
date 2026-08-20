# Phase 1 Data Model: Events Performance & Sync Feedback

All entities here are **session-only, in-memory** (not persisted to `localStorage` — see spec.md Assumptions). None replace or restructure any existing persisted type in `src/types/index.ts` (`CalendarEvent`, `EventType`, `Rule`, `Connection` are unchanged).

## ConnectionCacheEntry

One per connection (keyed by `Connection.id`), owned by `DataProviderContext` (Decision A), backing instance stored in `src/lib/event-cache.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| `coveredRanges` | `{ start: string; end: string }[]` | Sorted, non-overlapping ISO date intervals already fetched for this connection (Decision B). Empty array = nothing fetched yet. |
| `events` | `CalendarEvent[]` | The connection's own fetched events across all covered ranges (before namespacing/merge into the app-wide `useEventsStore`). |
| `lastFetchedAt` | `number \| null` | `Date.now()` of the connection's most recent successful fetch (gap-fill, staleness refresh, or manual refresh). `null` before the first fetch. Drives staleness (Decision C). |
| `fetchSeq` | `number` | Incremented every time a fetch is issued for this connection. A resolved fetch is only applied if its captured value still matches the live `fetchSeq` (Decision D). |
| `fetchKey` | `string` | Hash of the connection's fetch-relevant fields (`id`, `type`, `url`, `proxyUrl`, `username`, `password`). When a connection's live `fetchKey` no longer matches the cache entry's `fetchKey`, the entry is discarded and rebuilt from empty (Decision E). |

**Lifecycle**:
- Created empty the first time a connection is seen.
- Extended (covered ranges unioned, events merged — see Decision B step 4) on every successful gap-fill or staleness-refresh fetch.
- Fully discarded and rebuilt when `fetchKey` changes (connection edited) or the connection is removed (entry dropped entirely).
- Never evicted/pruned by size or age otherwise (session-only, no LRU — see spec.md Assumptions).

## SyncState *(derived, not stored)*

Computed on read from existing `ConnectionStatusMap` (`useConnectionStatusMap()`) plus a new `isBackgroundRefreshing: boolean` alongside the existing `lastUpdated`/`refresh` in `useSourceSync()`'s context value. Not a new store — see Decision I.

| State | Condition |
| --- | --- |
| `idle` | No connection status is `loading`, and no background staleness refresh is in flight. |
| `syncing` | At least one connection status is `loading`, or a background staleness refresh is in flight. |
| `error` | At least one connection status is `error` and no connection is currently `loading`/refreshing (error takes a back seat to an active retry-in-progress state). |

## ResolvedEvent *(derived, not stored)*

Computed on read by `useResolvedEvents()` (Decision F), one entry per currently-fetched event, discarded and recomputed (not incrementally patched) whenever its inputs change.

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `EventType` | Result of today's `resolveEventType()` — the event's effective display type after rules resolution, falling back to the default type. Unchanged logic, just computed once and shared. |
| `hidden` | `boolean` | Result of today's `isEventHidden()` — whether the event's source connection or resolved type is hidden. |

`useResolvedEvents()` returns `Map<CalendarEvent["id"], ResolvedEvent>`, recomputed via a single `useMemo` keyed on `[events, rules, types, connections]` (all four are needed: `rules`/`types` for resolution itself, `connections` for the hidden-source check `isEventHidden` already performs).

## `CalendarEvent`, `EventType`, `Rule`, `Connection`

**Unchanged.** This feature does not add, remove, or rename any field on these existing types (`src/types/index.ts`) — it only changes how often and where they're computed from.

## `EventsStore` (existing, `src/store/index.ts`) — one new field

| Field | Type | Notes |
| --- | --- | --- |
| `hasLoadedOnce` | `boolean` | New. `false` until `setEvents` is called for the first time this session; drives the first-load skeleton (Decision J). Not persisted (this store already isn't). |
