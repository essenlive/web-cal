# Phase 1 Data Model: Quick Hide

## Entities (all amendments to existing types in `src/types/index.ts`)

### EventType (amended)

| Field | Type | Notes |
|---|---|---|
| `hidden` | `boolean` (optional) | **NEW**. Defaults to falsy/absent = visible. When `true`, every event whose effective (resolved) display type is this one is excluded from all calendar views. Does not affect the type's availability in edit forms, pickers, or default-type selection. |

All other fields (`id`, `label`, `color`, `icon`, `allDayStyle`, `timedStyle`) are unchanged.

### WebCalConnection (amended)

| Field | Type | Notes |
|---|---|---|
| `hidden` | `boolean` (optional) | **NEW**. Defaults to falsy/absent = visible. When `true`, every event whose `calendarId` matches this connection's `id` is excluded from all calendar views. Does not affect the connection's status polling, credentials, or availability in any picker. |

All other fields unchanged.

### CalDAVConnection (amended)

| Field | Type | Notes |
|---|---|---|
| `hidden` | `boolean` (optional) | **NEW**. Same semantics as `WebCalConnection.hidden`. |

All other fields unchanged.

### CalendarEvent (unchanged)

No new fields. Visibility is derived, not stored — an event has no `hidden` field of its own; it is evaluated against its source's and its resolved type's `hidden` flags at render time (see Filter Contract below).

## Filter Contract

```ts
/**
 * True if this event must not be rendered anywhere, because either its
 * source connection or its resolved effective display type is hidden.
 */
function isEventHidden(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection: (calendarId: string) => Connection | undefined,
  defaultTypeId?: string,
): boolean
```

- Source check: `getConnection(event.calendarId)?.hidden === true` → hidden, short-circuits before resolving type.
- Type check: `resolveEventType(event, getType, getConnection, defaultTypeId)?.hidden === true` → hidden.
- Returns `false` (visible) in all other cases, including when the event has no resolvable connection or type at all (existing behavior for such events — e.g. rendered with default styling — is unchanged by this feature).

## State Transitions

Both `hidden` fields are simple booleans with exactly one transition: toggled by the user, in either direction, at any time, with no guard conditions (per spec Clarification Q2 — no restriction on hiding everything; per Clarification Q3 — hidden items remain fully usable elsewhere). No other part of the system ever sets or clears `hidden` automatically (it is not touched by connection creation, type creation, deletion, or migration logic).

## Persistence

No new persist key. `hidden` rides along inside the existing persisted arrays:
- `useConnectionStore` → localStorage key `webcal:connections`
- `useEventTypeStore` → localStorage key `proton-cal:event-types`

Records written before this feature shipped simply lack the field; reading `hidden` on them yields `undefined`, which every check above treats as visible. No `onRehydrateStorage` migration step is needed (unlike `useEventTypeStore`'s existing `migrateType()`, which exists to backfill *required* fields — `hidden` is optional and needs no backfill).
