# Phase 0 Research: Quick Hide

## Decision 1 — Where hidden state lives

**Decision**: Add `hidden?: boolean` directly to the existing `EventType` interface and to `WebCalConnection`/`CalDAVConnection`. No new Zustand store, no new persist key.

**Rationale**: `useConnectionStore` and `useEventTypeStore` already persist full records for each connection/type at keys `webcal:connections` and `proton-cal:event-types`. A visibility flag is a property *of* a connection/type, not an independent entity with its own lifecycle — it has no meaning without the record it applies to, and it must never outlive or contradict that record (e.g. after a connection is deleted, there is by construction no orphaned "hidden" entry to clean up, because the flag lives inside the record). Both stores already expose a generic `updateConnection(conn)` / `updateType(t)` action that replaces a full record — toggling `hidden` needs no new action, no new persisted key, and no migration function, since any record persisted by an earlier version of the app simply has `hidden === undefined`, which is falsy and behaves as "visible" by default.

**Alternatives considered**:
- *A new `useVisibilityStore` keyed by connection/type id* — considered because it would keep "view/UI preference" state separate from "identity/config" state (a distinction the task's own framing gestures at). Rejected because it introduces a second source of truth that must be kept in sync with `useConnectionStore`/`useEventTypeStore` (e.g. on connection deletion, the visibility store would need its own cleanup pass — exactly the kind of derived-state bookkeeping the 003 rules-engine plan explicitly chose to avoid for "broken" rule flags). A field on the record it describes needs no synchronization at all.

## Decision 2 — Where filtering happens

**Decision**: One pure predicate, `isEventHidden(event, getType, getConnection, defaultTypeId)`, exported next to `resolveEventType()`/`resolveStyle()` in `EventChip.tsx`. Each of the three calendar views (`MonthView`, `TimeGridView`, `AgendaView`) filters its raw `events` array through it once, immediately after reading `useEventsStore()`, before any layout/lane-assignment work runs.

**Rationale**: Source-hiding could instead be implemented "upstream" — e.g. excluding hidden connections before constructing `MultiSourceProvider` in `DataProviderContext`, so hidden sources' events are never fetched. That would save a network round-trip, but type-hiding *cannot* be done upstream (a fetched event's effective type is only knowable after fetch, since it depends on `eventTypeId`, connection fallback, and the application default). Splitting the two mechanisms — provider-level filtering for sources, render-level filtering for types — would mean two different places implement "visibility," doubling the surface a future change has to touch, for a bandwidth saving this feature's success criteria never asks for (SC-001–SC-005 are about interaction speed and correctness, not network usage). A single render-level predicate covering both source and type keeps "what's hidden" defined in exactly one place.

**Alternatives considered**:
- *Filter in `DataProviderContext` before fetch (sources only) + separate type filter in each view* — rejected per above: two mechanisms for one concept.
- *Filter inside `useEventsStore` itself* — rejected because the store would then need to import connection/type stores and `resolveEventType` from the components layer, inverting the existing dependency direction (stores are currently leaf modules with no cross-store or component imports) for no benefit over filtering at the three call sites that already exist.

## Decision 3 — What "resolves to a hidden type" means

**Decision**: `isEventHidden()` calls the existing `resolveEventType(event, getType, getConnection, defaultTypeId)` — the same function every view already calls to decide how to *style* an event — and checks `.hidden` on its result, rather than comparing `event.eventTypeId` directly against hidden type ids.

**Rationale**: Per spec Clarification Q1, hiding a type must hide every event currently *rendered* with it, including events that reach it only via calendar-level fallback (`connection.displayTypeId`) or the application default (`defaultEventTypeId`) — not just events with that id assigned directly. `resolveEventType()` already encodes that exact precedence chain and is already in scope at every call site that needs `isEventHidden()`, so reusing it is both more correct (no risk of the filter's notion of "effective type" drifting from the renderer's) and less code than re-implementing the chain.

**Alternatives considered**:
- *Compare `event.eventTypeId` directly against hidden type ids* — rejected: under-filters. An event whose direct `eventTypeId` doesn't match any type (common for provider-ingested events, see `multi-source-provider.ts`'s `applyConnectionMeta`) but that visually renders as a hidden type via fallback would stay on screen, contradicting FR-004 and Clarification Q1.

## Decision 4 — Toggle wiring (no new store actions)

**Decision**: The hide/show button in `Sidebar.tsx`, `ConnectionList.tsx`'s `ConnectionRow`, and `SettingsPage.tsx`'s `EventTypeRow` all call the existing `updateConnection({ ...conn, hidden: !conn.hidden })` / `updateType({ ...type, hidden: !type.hidden })` — no new `toggleConnectionHidden`/`toggleTypeHidden` action is added to either store.

**Rationale**: Both stores already expose a full-record update action used today for exactly this shape of change (`ConnectionList.tsx`'s `DisplayTypeSelector` already calls `onUpdate({ ...connection, displayTypeId: t.id })` for a similar single-field toggle). Adding a dedicated action per store per boolean would be new API surface duplicating what the generic action already does — YAGNI.

**Alternatives considered**:
- *Dedicated `toggleConnectionHidden(id)`/`toggleTypeHidden(id)` store actions* — rejected as redundant; would only save one `{ ...x, hidden: !x.hidden }` expression at each of three call sites, at the cost of two new, permanently-maintained store methods.

## Decision 5 — Quick-access surface placement

**Decision**: A new compact "Sources & Types" section is added to `Sidebar.tsx`, below the existing mini calendar, listing every connection and every event type with a color/icon swatch, label, and an `Eye`/`EyeOff` icon-button. The existing settings lists (`ConnectionList.tsx`, `SettingsPage.tsx`'s type tab) each gain the same icon-button on their existing rows.

**Rationale**: Per spec User Story 3 and its Assumptions, the "quick" part of Quick Hide requires a toggle reachable without leaving the calendar screen. `Sidebar.tsx` is the only persistent, always-visible chrome during calendar browsing (`Header.tsx` is a slim single-row toolbar with no room for a list; a new page or modal would defeat "quick"). The settings lists already exist as the canonical place users manage full configuration, so mirroring the same toggle there (rather than only in the sidebar) satisfies FR-006's "everywhere that source or type is listed" without inventing a new settings surface.

**Alternatives considered**:
- *Sidebar only, no settings-page toggle* — rejected: FR-006 requires the hidden state to be visible "everywhere that source or type is listed," and the settings lists are an existing such place; leaving them silently inconsistent (showing no hidden indicator at all) would be confusing since the same record is edited there.
- *Settings only, no sidebar section* — rejected: fails User Story 3 / SC-001's "without leaving the calendar screen" requirement outright.

## Decision 6 — Toggle control affordance

**Decision**: Plain `<button>` with `Eye`/`EyeOff` from the already-installed `lucide-react`, styled with the same `p-1.5 rounded-lg hover:bg-muted text-muted-foreground` utility pattern already used for the `Edit2`/`Trash2` buttons in `EventTypeRow` and `ConnectionRow`.

**Rationale**: No new dependency, no new visual language — matches Constitution "Visual Consistency" and the existing icon-button convention pervasive in this codebase (`Header.tsx`, `EventTypeRow`, `ConnectionRow` all use it). A Radix `Switch` (as used for the boolean prefs toggles in `SettingsPage.tsx`'s "Préférences" tab) was considered but rejected for per-row use: those toggles are for standalone settings, one per row of a static preferences panel, whereas this is a repeated per-item row action alongside other icon-buttons — an icon-button matches its siblings (Edit/Delete) better than a switch would.
