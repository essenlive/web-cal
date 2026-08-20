# Phase 0 Research: Events Performance & Sync Feedback

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the stack is fully known from the existing codebase. This document records the design decisions needed to turn the spec's requirements (instant cached navigation, delta fetching, stale-while-revalidate, memoized rules resolution, a global sync indicator) into a concrete implementation approach, reusing patterns already established elsewhere in this codebase.

## Decision A: Cache lives in `DataProviderContext`, not a new Zustand store

**Decision**: The event cache (covered date ranges + events + staleness bookkeeping, per connection) is implemented as a plain module, `src/lib/event-cache.ts`, holding pure data-structure/interval-math functions. The actual cache instance is a `useRef` inside `DataProviderContext`, alongside the existing `statusMap` local state.

**Rationale**: `DataProviderContext` is already the sole owner of fetch orchestration and per-connection status (`statusMap`, local `useState`, not a store — see existing code). The cache is exactly the same kind of thing: derived, session-only, fetch-orchestration bookkeeping that nothing outside this context needs to read or write directly (views only ever consume the final merged `events` array via `useEventsStore`, plus the new derived sync state). Elevating it to a Zustand store would suggest it's shared, persisted, or globally mutated state, none of which is true — per Simplicity & YAGNI, match the existing `statusMap` pattern instead of introducing a new store.

**Alternatives considered**:
- *New `useEventCacheStore` (Zustand, non-persisted, like `useEventsStore`)*: Rejected — `useEventsStore` holds the final, already-merged, already-fetched result that views render; the cache is an internal implementation detail of *how* that gets populated, one level down. Nothing needs to subscribe to cache internals from outside `DataProviderContext`.
- *Cache inside `MultiSourceProvider` instances themselves*: Rejected — `MultiSourceProvider` is re-instantiated whenever the connection set changes (see Decision E below, which also fixes when that happens), which would blow away the cache on every edit instead of selectively invalidating just the edited connection's entry.

## Decision B: Range coverage tracked as merged intervals; only uncovered gaps are fetched

**Decision**: Each connection's cache entry tracks `coveredRanges: { start: string; end: string }[]` — a sorted, non-overlapping set of ISO date intervals already fetched — plus a flat `events: CalendarEvent[]`. On a navigation request for `[reqStart, reqEnd]`:

1. Compute the gaps: the sub-intervals of `[reqStart, reqEnd]` not already covered (simple interval subtraction against the sorted `coveredRanges`).
2. If there are no gaps, serve `events` filtered to `[reqStart, reqEnd]` immediately — no fetch.
3. If there are gaps, fetch only those gap sub-ranges from the connection's provider, in parallel with any other connections' own gaps.
4. Merge: remove any cached events whose window overlaps a freshly-fetched gap (avoids duplicates when a gap partially overlaps old data at its edges), append the new events, then union the gap intervals into `coveredRanges`.

**Rationale**: This directly satisfies FR-001/FR-002/SC-001/SC-002 — repeat navigation within a loaded window costs zero network time, and navigating to adjacent unloaded time only pays for the delta. Because the app's default window is a fixed `[currentDate − 1mo, currentDate + 2mo]` slide, gaps are almost always a single contiguous slice at one edge in normal next/previous navigation, keeping the common case cheap; the general interval-subtraction approach still handles a large jump (e.g. via URL-encoded date deep link, per the existing `006-view-presets` URL state) correctly by producing multiple gap pieces if needed.

**Alternatives considered**:
- *Cache by whole month "buckets" (e.g. `Map<"2026-03", events[]>`)*: Rejected — simpler to reason about, but the app's fetch window isn't month-aligned (it's `currentDate ± N months` from an arbitrary day), so bucket edges wouldn't match request edges and every navigation would still look like a partial-bucket miss most of the time, defeating the purpose.
- *Cache the full history ever requested with no eviction*: Considered acceptable for a first version (see Assumptions in spec.md — session-only cache) — no eviction/LRU is implemented, since a single user session's calendar browsing is bounded in practice and this is explicitly out of scope per the spec's session-only assumption.

## Decision C: Staleness is a single per-connection timestamp with a 5-minute TTL, refreshed in the background

**Decision**: Each connection's cache entry also holds `lastFetchedAt: number | null`. `lastFetchedAt` resets to `Date.now()` whenever any fetch (gap-fill or staleness refresh) for that connection succeeds. A connection is stale when `Date.now() - lastFetchedAt > STALE_TTL_MS` (5 minutes). On every navigation, after serving covered data instantly (Decision B), if the connection is stale, kick a **background** re-fetch of the *currently requested* window (not the whole covered range) and merge its result in when it lands — same merge step as Decision B step 4 — without ever clearing `events` in between.

**Rationale**: 5 minutes matches typical calendar-feed update cadence (most WebCal/CalDAV sources are not updated more than a few times an hour) while still feeling "live" for the common case of leaving the tab open. Re-fetching only the requested window (not the whole covered range) on staleness keeps a background refresh cheap — the user is looking at that window right now, so that's the data worth refreshing first; older covered ranges the user has scrolled away from go stale too but are only refreshed the next time they're actually revisited (lazy revalidation), avoiding wasted work refreshing ranges nobody is looking at.

**Alternatives considered**:
- *Per-sub-range TTL (track `fetchedAt` per interval, not one timestamp per connection)*: Rejected — adds real complexity (interval-keyed timestamps, partial staleness) for a benefit the spec doesn't ask for; the spec's staleness requirement (FR-003) is satisfied by "the data you're currently looking at gets refreshed periodically," which a single per-connection timestamp + refresh-on-revisit already provides.
- *No TTL, only manual refresh*: Rejected — contradicts FR-003's explicit "MUST refresh stale data automatically in the background."

## Decision D: Superseded/duplicate fetches are discarded via a per-connection sequence token, not `AbortController`

**Decision**: Each connection's cache entry also holds `fetchSeq: number`, incremented every time a new fetch is issued for that connection (gap-fill, staleness refresh, or manual refresh). When a fetch's promise resolves, its result is only merged into the cache if its captured sequence number still equals the connection's current `fetchSeq`; otherwise it's silently discarded. Issuing a new fetch for a connection while one is already in flight simply bumps the sequence (superseding it) rather than waiting for or cancelling the network request itself.

**Rationale**: Satisfies FR-012/FR-013 (no duplicate concurrent application of stale results, superseded in-flight fetches never overwrite newer data) with a small, purely-local check — no change to the `DataProvider` interface, no `AbortSignal` threading through three provider classes (`WebCalProvider`, `CalDAVProvider`, `MultiSourceProvider`) and the `/api/proxy` route. The in-flight network request for a superseded fetch still completes, but its result is inert once it lands.

**Alternatives considered**:
- *`AbortController` plumbed through `DataProvider.getEvents(start, end, signal?)`*: Rejected for this iteration — it does save the wasted network transfer (a real, if minor, resource cost), but requires changing the read-only `DataProvider` interface (Constitution Principle VI) across every implementation (`MockDataProvider`, `WebCalProvider`, `CalDAVProvider`, `MultiSourceProvider`, the demo provider) and the proxy route, for a correctness property the sequence-token approach already guarantees. Worth revisiting later if wasted-bandwidth becomes a measured problem; out of scope here (Simplicity & YAGNI).

## Decision E: Fix connection-change detection to key off fetch-relevant fields, not just `id`

**Decision**: `DataProviderContext`'s `connectionKey` (currently `JSON.stringify(connections.map((c) => c.id))`, `DataProviderContext.tsx:50`) is changed to key off every field that affects what gets fetched: `id`, `type`, `url`, `proxyUrl`, and (for legacy CalDAV) `username`/`password`. The provider `useMemo` re-instantiates, and the connection's cache entry is invalidated, whenever this key changes — not just when a connection is added or removed.

**Rationale**: This is a pre-existing latent bug, found while researching this feature: today, editing a connection's URL or proxy (without changing its `id`) does not change `connectionKey`, so `MultiSourceProvider` is never re-instantiated with the edited config — the app keeps fetching the *old* URL until the connection list's id-set itself changes (e.g. adding/removing some other connection incidentally forces a re-render with a new key). The spec's FR-005 ("editing a connection MUST invalidate and refresh its cached data") cannot be correctly satisfied while this bug exists, since the provider wouldn't even see the new URL, cache or no cache. This fix is a small, necessary part of this feature rather than a separate effort, since caching is what makes the bug's symptom (serving old data indefinitely) actually visible/persistent instead of "eventually correct after some unrelated re-render."

**Alternatives considered**:
- *Leave it and only invalidate the cache, not the provider*: Rejected — invalidating a cache that's still being fed by a provider configured with the old URL would just cause the stale data to be immediately re-fetched right back into the cache.

## Decision F: Rules resolution memoized once per (events, rules, types) via a shared hook, precompiled regexes

**Decision**: A new hook, `useResolvedEvents()` (`src/hooks/useResolvedEvents.ts`), computes a `Map<string, ResolvedEvent>` (keyed by event id) in a single `useMemo` over `[events, rules, types, connections]`, calling the existing `resolveEventType`/`isEventHidden` logic from `lib/rules.ts` exactly once per event per relevant change, instead of once per event *per render per view*. `MonthView`, `TimeGridView`, and `AgendaView` all consume this same map instead of each calling `resolveEventType`/`isEventHidden` independently (removing the current triplicated hidden-filtering logic in the process). Within `matchesRule` (`lib/rules.ts`), `name`-type rules' `RegExp` objects are constructed once when the `rules` array changes (cached alongside the rule, e.g. in a small `Map<ruleId, RegExp>` rebuilt only when `rules` changes) rather than via `new RegExp(...)` on every match check.

**Rationale**: Directly addresses the diagnosed bottleneck — rule resolution was being redone from scratch for every event on every render in three separate places. Because Zustand gives a new array reference whenever `rules`/`types`/`connections` actually change (and a stable reference otherwise), reference-equality `useMemo` dependencies correctly invalidate exactly when needed with no manual diffing. This also directly satisfies FR-006/FR-007: resolution happens once per real change, and because it's still derived (not a separately-persisted cache that could drift), a rules/types change is guaranteed to produce a new resolution on the very next render — no staleness risk.

**Alternatives considered**:
- *Memoize `resolveEventType` itself with a general-purpose memoization utility keyed by event+rules+types identity*: Rejected — same effect, more machinery (a caching utility, cache-size/eviction concerns) than a single `useMemo` in one hook shared by three call sites.

## Decision G: Day-bucketing replaces per-cell/per-day linear filtering

**Decision**: `MonthView.getEventsForDay()` (`MonthView.tsx:366`), and the equivalent per-day filtering in `TimeGridView`/`AgendaView`, are replaced by a single `useMemo` that buckets the (already hidden-filtered) event list into `Map<dayKey, CalendarEvent[]>` once per `events` change, where `dayKey` is a `yyyy-MM-dd` string. Each day cell/row then does a single `Map.get(dayKey)` instead of an `O(events)` scan.

**Rationale**: Turns the grid's total per-render cost from `O(days × events)` to `O(events)` for the bucketing pass plus `O(1)` per cell lookup — directly targets the diagnosed `MonthView` bottleneck. All-day multi-day events are bucketed into every day they span (same span logic `getEventsForDay` already uses), so the "event spanning a cache boundary" edge case in spec.md is a display-layer non-issue: by the time bucketing runs, the event object already has its full, correct `start`/`end` from the merged cache (Decision B's merge step guarantees a fetched event's full record replaces any partial/stale version, never a truncated one).

**Alternatives considered**:
- *Keep per-day filtering but memoize its result per day*: Rejected — would need 42+ separate memo cells (one per visible day) with manual cache-key management; a single bucketing pass is simpler and asymptotically better.

## Decision H: `React.memo` on leaf render components, with stable callback/prop identities

**Decision**: `DayCell`, `EventChip`, `AvatarBadge`, and `OverflowPopover` are wrapped in `React.memo`. Their callback props (`onEventClick`, `getType`) are already stable across renders in the current code (`useCallback`/store-returned stable functions) or are made stable as part of this change; the resolved-type/style values they receive come from the shared `useResolvedEvents()` map (Decision F) rather than being recomputed inline, so the same event + same resolution map reference produces the same props and a `memo` bail-out.

**Rationale**: Prevents an unrelated local state change (e.g. opening one day's overflow popover) from re-rendering and re-resolving all other day cells in the grid, addressing the diagnosed lack of render isolation.

**Alternatives considered**:
- *`useMemo`-wrap each cell's JSX inline instead of `React.memo` on the component*: Rejected — `React.memo` is the idiomatic React tool for this and keeps `DayCell` a normal, testable component (Constitution Principle I) rather than inlining memoization logic into the parent.

## Decision I: A new, minimal `SyncIndicator` in the `Header`, derived from existing status data — no new store

**Decision**: A new component, `src/components/sidebar/SyncIndicator.tsx`, is added to `Header.tsx` (next to the "Today" button). It derives its state purely from `useConnectionStatusMap()` (already exists) plus a new `isBackgroundRefreshing: boolean` flag exposed alongside `lastUpdated`/`refresh` from `useSourceSync()` (Decision C's background staleness refresh sets this while in flight): **idle** (nothing shown — see Rationale) when every connection is `active`/`unchecked` and no background refresh is running; **syncing** (small spinner) when any connection is `loading` or a background refresh is running; **error** (small badge) when at least one connection is `error` and none are currently `loading`/refreshing.

**Rationale**: FR-008/FR-009 ask for a global indicator that's consistent with, and additive to, the existing per-connection dots — deriving it from the same `statusMap` (rather than introducing parallel state that could drift from it) makes that consistency automatic. Showing nothing in the idle state (rather than a persistent "all good" icon) is what "non-intrusive" (spec.md, User Story 2) means in practice: the indicator should only draw the eye when there's something to know, matching this app's existing quiet-by-default visual language (toasts only on error/success, not on every successful background action).

**Alternatives considered**:
- *Always-visible three-state icon (idle/syncing/error), never hidden*: Rejected — spec explicitly calls for "non-intrusive"; a persistently visible icon in the header competes with the date title and view switcher for attention on every glance at the app.

## Decision J: First-load skeleton gated on "cache has never been populated this session", not on `isLoading` alone

**Decision**: A new `CalendarSkeleton` component (grid of empty day cells matching the current view's layout) renders in place of `CalendarGrid` (`CalendarPage.tsx`) exactly while `useEventsStore().events` has never been set this session (a new `hasLoadedOnce: boolean` flag on `useEventsStore`, set `true` the first time `setEvents` is called) **and** a fetch is currently in flight. Every subsequent load (including the first stale-while-revalidate refresh) reuses the existing calendar (no skeleton), consistent with Decision B/C never blanking the grid.

**Rationale**: Satisfies FR-010/SC-005 precisely — the skeleton is a first-impression-only affordance, not a general-purpose "loading" replacement for the grid (that would reintroduce the blanking behavior this whole feature is trying to remove).

**Alternatives considered**:
- *Show the skeleton any time `isLoading` is true, at any point in the session*: Rejected — directly contradicts FR-003/SC-004 (background refreshes must never blank/replace the visible grid).
