# Feature Specification: Events Performance & Sync Feedback

**Feature Branch**: `008-events-perf-caching`
**Created**: 2026-08-20
**Status**: Draft
**Input**: User description: "Events performance: caching, fetching, rules application, and display, plus UI feedback on app state. The events display is slow. We need to overhaul the whole pipeline from event fetching (currently no caching — every calendar date navigation re-fetches and re-parses every connected source's full feed from the network, even when the requested date range is already covered by data just fetched), through display-rules resolution (currently re-walks the full ordered rules list for every event on every render, in every calendar view, with no memoization), through rendering (currently re-filters the full event list per day cell instead of bucketing once, and re-renders all day cells on any local state change), through to a caching layer that avoids redundant network fetches and re-parsing when navigating within an already-fetched window. We also want visible UI feedback so the user always knows the app's current state: whether it's idle, actively syncing sources, showing stale/cached data while a background refresh runs, or hit an error — building on top of (not replacing) the existing per-connection status dots and last updated timestamp in the sidebar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant calendar navigation within loaded data (Priority: P1)

A user browsing their calendar moves between days, weeks, or months, or switches view (month/week/day/agenda), inside a range that has already been loaded this session. They expect the calendar to update immediately, with no network wait and no flash of an empty grid.

**Why this priority**: This is the core complaint — "the events display is slow" is felt every single time the user clicks next/previous or changes view, which is the single most frequent interaction in the app. Fixing this delivers the largest share of the perceived speedup on its own.

**Independent Test**: Load the calendar, navigate forward and back across several months, then return to a previously visited month. Confirm the previously visited month renders instantly with no visible loading state and no new network request for that range.

**Acceptance Scenarios**:

1. **Given** the user has already viewed March 2026, **When** they navigate away and back to March 2026 within the same session, **Then** the events for March 2026 appear immediately with no loading indicator and no new fetch to any source.
2. **Given** the user is viewing month view for a loaded month, **When** they switch to week or day view for dates inside that same month, **Then** the view switches instantly using already-loaded data.
3. **Given** the user navigates to a date range that has never been loaded this session, **When** the view updates, **Then** only the newly-needed range is fetched (not the entire multi-month window again), and a visible loading state covers just that gap until it arrives.

---

### User Story 2 - Always know whether the calendar is up to date (Priority: P2)

A user wants a quick, unobtrusive way to tell whether what they're looking at is fresh, currently being refreshed, or failed to update — without having to open the sidebar and inspect individual source status dots.

**Why this priority**: Once navigation feels instant (User Story 1), users are more likely to be looking at cached/stale data by default; they need a trustworthy signal for when that data is being refreshed or when a source has failed, or the speed gain undermines confidence in the data.

**Independent Test**: With the app open, trigger a background refresh (e.g. wait for staleness or click manual refresh) and confirm a global state indicator reflects idle → syncing → idle, and separately confirm it reflects an error state when a source fails, independent of opening the sidebar.

**Acceptance Scenarios**:

1. **Given** the calendar is idle and all sources are up to date, **When** the user looks at the app, **Then** a global indicator clearly shows an "up to date" state without requiring any interaction.
2. **Given** a background refresh of one or more sources is in progress, **When** the user looks at the app, **Then** the indicator shows a "syncing" state, and the calendar continues showing existing events (no blanking, no layout shift) until the refresh completes.
3. **Given** a source fails to refresh, **When** the refresh attempt finishes, **Then** the global indicator shows an error state, and the calendar continues showing the last known-good events for that source rather than dropping them.
4. **Given** the user opens the sidebar, **When** they look at a specific connection, **Then** its existing per-connection status dot and "last updated" timestamp still work exactly as before, now consistent with the global indicator.

---

### User Story 3 - Fast first load (Priority: P3)

A first-time visit, or a fresh page load with no cached data yet, should clearly communicate that the calendar is loading rather than appearing broken or empty.

**Why this priority**: Lower priority than P1/P2 because it only affects the first load of a session, not repeated navigation, but it's the first impression of the app and a blank grid during the initial fetch reads as broken.

**Independent Test**: Load the app fresh (no prior session cache) and confirm a loading state is visible from the moment the page renders until the first batch of events arrives, then disappears cleanly with no flash of incorrect content.

**Acceptance Scenarios**:

1. **Given** a user opens the app with no events cached yet, **When** the page first renders, **Then** the calendar area shows a clear loading state instead of an empty grid.
2. **Given** the first fetch completes, **When** events arrive, **Then** the loading state is replaced by the actual calendar with no intermediate flash of an empty or partially-styled grid.

---

### Edge Cases

- What happens when a user rapidly clicks "next" through many months before any single fetch completes? (Superseded in-flight fetches for ranges the user has already navigated past must not overwrite newer data with stale results, and must not pile up redundant outstanding requests.)
- What happens when a connection's configuration changes (URL edited, connection deleted, proxy changed) while its data is cached? (The cached data for that connection must be invalidated and not shown as if still valid.)
- What happens when a manual refresh is triggered while a background staleness-triggered refresh is already in progress for the same source? (Only one refresh per source should be in flight at a time; the manual trigger should not start a redundant duplicate request.)
- What happens when every source fails on a background refresh but cached data exists? (The last known-good cached events remain visible; the app must not clear the calendar just because a refresh failed.)
- What happens when the display rules or event types change (e.g. a rule is reordered, a type is deleted) while events are already loaded? (The calendar must re-resolve and re-render with the new rules/types immediately — the performance work must not introduce a stale-resolution bug where cached fetch data shows outdated styling.)
- What happens when hide/show toggles are flipped on a source or type? (Must still take effect immediately, exactly as today, regardless of caching changes.)
- What happens when the same event's date/window spans a cached boundary (e.g. a multi-day event starting in a cached range and ending in an uncached one)? (The event must render fully and consistently, not be cut off at the cache boundary.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST serve previously-fetched event data for a requested date range instantly, without issuing a new network request, when that range is already covered by data fetched earlier in the session.
- **FR-002**: When a requested date range is only partially covered by already-fetched data, the system MUST fetch only the uncovered portion, not the entire requested range.
- **FR-003**: The system MUST treat fetched event data as eligible to go stale after a period of time, and MUST refresh stale data automatically in the background without removing or blanking the currently displayed events while the refresh is in progress.
- **FR-004**: The system MUST allow a user-initiated manual refresh of a source (existing "refresh" action) to invalidate and re-fetch that source's data immediately, regardless of staleness state.
- **FR-005**: The system MUST invalidate any cached data associated with a connection when that connection is added, edited (URL, proxy, or credentials), or removed, so stale configuration never continues to be served.
- **FR-006**: The system MUST resolve each event's effective display type, style, and visibility (hidden/shown) exactly once per relevant change (event data changes, or rules/types/connections change) and reuse that resolution across all calendar views (month, week/day, agenda), rather than recomputing it independently in each view on every render.
- **FR-007**: A change to display rules, event types, or hide/show state MUST be reflected in the calendar's rendering immediately, with the same correctness as today — caching or memoization introduced by this feature MUST NOT cause events to render with outdated styling or visibility.
- **FR-008**: The system MUST display a global, non-intrusive indicator of the app's current sync state, distinct from the existing per-connection status list, with at least these states: up to date (idle), syncing (a fetch is in progress), and error (at least one source failed on its most recent attempt).
- **FR-009**: The existing per-connection status indicators and "last updated" timestamp MUST continue to function unchanged and MUST remain consistent with the new global indicator (e.g. the global indicator shows "syncing" whenever any per-connection status is "loading").
- **FR-010**: The system MUST show a distinct loading state for the calendar grid during the first fetch of a session (before any data has been cached), replacing today's behavior of an empty or unstyled grid.
- **FR-011**: When a background refresh fails for one or more sources, the system MUST continue displaying the last known-good cached events for those sources (not clear them) and MUST surface the failure through the global indicator and the existing per-source error toast/status, without changing existing error-reporting behavior for that source.
- **FR-012**: The system MUST NOT allow more than one in-flight fetch per source at a time; a new fetch request for a source (from navigation, staleness, or manual refresh) that arrives while a fetch for that source is already in flight MUST either reuse the in-flight request's result or supersede it cleanly, rather than issuing a duplicate concurrent request.
- **FR-013**: When rapid navigation supersedes an in-flight fetch for a range the user has since navigated away from, the system MUST discard the superseded result rather than let it overwrite more current data.
- **FR-014**: All existing display-type styles, rules-engine matching/priority behavior, quick hide behavior, theming, and multi-source merge/namespacing behavior documented in `docs/ARCHITECTURE.md` MUST continue to work exactly as before — this feature changes performance characteristics only, not display or matching behavior.

### Key Entities *(include if feature involves data)*

- **Cached range**: A record, per connection, of which date span(s) have been fetched and when, used to determine what's already covered versus what needs fetching and when data becomes stale.
- **Sync state**: The app-wide derived state (idle / syncing / error) shown by the global indicator, aggregated from all per-connection statuses.
- **Resolved event**: The cached result of applying the display-rules engine to a raw event — its effective display type, style, and hidden/shown flag — kept in sync with the underlying event, rules, and type data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Navigating to a previously-viewed date range within the same session updates the calendar in under 100ms, with no visible loading state.
- **SC-002**: Navigating to a new, never-loaded date range only waits on the network for the uncovered portion of that range, not the full multi-month window the app currently fetches on every navigation.
- **SC-003**: Users can tell the app's current sync state (up to date / syncing / error) at a glance, without opening the sidebar, in 100% of states.
- **SC-004**: A background refresh never causes the calendar to visibly empty or flash blank; existing events remain visible throughout.
- **SC-005**: First load shows a loading state within one frame of page render and transitions cleanly to real content with no flash of incorrect or empty state.
- **SC-006**: Repeated interactions that change local UI state only (opening a popover, toggling a hide/show flag, resizing) do not perceptibly re-render or delay unrelated parts of the calendar grid.
- **SC-007**: No existing documented display, rules, quick-hide, theming, or multi-source behavior regresses, verified against the scenarios already described in `docs/ARCHITECTURE.md`.

## Assumptions

- "Session" means the lifetime of the loaded web app (a single browser tab/page load); the specification does not require the event cache to persist across a full page reload or browser restart, though a future iteration could choose to persist it.
- A reasonable default staleness window (the point at which cached data is refreshed in the background) is on the order of a few minutes; the exact figure is a tuning decision left to planning rather than a hard product requirement.
- The "global indicator" is a new, small piece of UI (e.g. in the header) additive to the existing sidebar status list — it does not replace or relocate the existing per-connection dots or "last updated" timestamp.
- Read-only data sources (WebCal/CalDAV feeds) are assumed not to support fine-grained partial fetches by date range at the protocol level for all providers; "fetching only the uncovered portion" refers to the app's own cache boundary tracking, not necessarily a partial-range request to every external server (though conditional requests, e.g. ETag/Last-Modified, are a reasonable implementation detail where supported).
- This feature is a non-visual/behavioral performance and feedback overhaul — it does not add, remove, or change any display type, rule-matching rule, theming option, or connection type.
