# Data Model: Cloud Calendar Provider Connector

**Branch**: `001-cloud-calendar-connector` | **Date**: 2026-03-30

## Overview

This feature introduces the `Connection` entity as the central data model, replacing the flat `BackendConfig`. All other existing types (`CalendarEvent`, `EventType`) are unchanged except for one additive field clarification.

---

## New / Updated Types (`src/types/index.ts`)

### ConnectionStatus (new)

Runtime-only — never persisted. Represents the live health of a connection as observed during the most recent `getEvents()` call.

```typescript
export type ConnectionStatus = "unchecked" | "loading" | "active" | "error";
```

| Value | Meaning |
|-------|---------|
| `unchecked` | Initial state on app load before first fetch attempt |
| `loading` | `getEvents()` in-flight for this connection |
| `active` | Last fetch succeeded |
| `error` | Last fetch failed (network error, auth failure, parse error) |

---

### WebCalConnection (new)

A read-only ICS/WebCal subscription.

```typescript
export interface WebCalConnection {
  type: "webcal";
  id: string;          // Stable UUID, generated at creation time
  name: string;        // User-supplied display name (e.g. "Work Holidays")
  url: string;         // https:// or webcal:// URL pointing to an .ics feed
  color: string;       // Hex color string from the 8-color palette (e.g. "#6366f1")
  proxyUrl?: string;   // Optional CORS proxy prefix URL
}
```

**Validation rules**:
- `url` must be non-empty and begin with `https://`, `http://`, or `webcal://`
- `name` must be non-empty (max 80 chars)
- `color` must be one of the 8 palette values or any valid hex string

---

### CalDAVConnection (new)

A CalDAV server connection (RFC 4791). Read-only in v1.

```typescript
export interface CalDAVConnection {
  type: "caldav";
  id: string;          // Stable UUID, generated at creation time
  name: string;        // User-supplied display name (e.g. "Nextcloud – Personal")
  url: string;         // CalDAV principal or calendar collection URL
  username: string;    // Account username or email
  password: string;    // Account password or app-specific password
  color: string;       // Hex color string from the 8-color palette
  proxyUrl?: string;   // Optional CORS proxy prefix URL
}
```

**Validation rules**:
- `url` must be non-empty and begin with `https://` or `http://`
- `username` must be non-empty
- `password` stored as-is in localStorage (user responsibility to use app passwords)
- `name` must be non-empty (max 80 chars)

---

### Connection (new discriminated union)

```typescript
export type Connection = WebCalConnection | CalDAVConnection;
```

The `type` field is the discriminant. TypeScript's exhaustive narrowing applies:

```typescript
function makeProvider(conn: Connection): DataProvider {
  switch (conn.type) {
    case "webcal":
      return new WebCalProvider([{ id: conn.id, name: conn.name, url: conn.url, color: conn.color }], conn.proxyUrl);
    case "caldav":
      return new CalDAVProvider(conn.url, conn.username, conn.password, conn.proxyUrl);
  }
}
```

---

### ConnectionStatusMap (runtime, not persisted)

Managed in `DataProviderContext` local state, not in the Zustand store.

```typescript
export type ConnectionStatusMap = Record<string, ConnectionStatus>;
// key: Connection.id, value: ConnectionStatus
```

---

## Updated Store (`src/store/index.ts`)

### useConnectionStore (new)

Persists to localStorage under key `"webcal:connections"`.

```typescript
interface ConnectionStore {
  connections: Connection[];
  addConnection: (conn: Omit<Connection, "id">) => void;  // generates UUID
  removeConnection: (id: string) => void;
  updateConnection: (conn: Connection) => void;
}
```

**Migration**: `onRehydrateStorage` checks for legacy `webcal:backend` key and converts existing WebCal sources or CalDAV config to `Connection[]` entries before removing the old key.

### useBackendStore (deprecated — no new reads)

Retained in code to avoid breaking any hypothetical external consumers; emits a `console.warn` deprecation notice on first use.

---

## Updated CalendarEvent (`src/types/index.ts`)

No structural changes. The `customColor` field (already present) is the mechanism by which `MultiSourceProvider` propagates per-connection colour to the renderer. No new fields are added.

```typescript
// Existing — shown for reference only, no changes
export interface CalendarEvent {
  id: string;           // Namespaced: "${connectionId}::${providerEventId}"
  customColor?: string; // Set by MultiSourceProvider to connection.color when type === "caldav"
  // ... all other fields unchanged
}
```

---

## State Transitions: ConnectionStatus

```
         app load
             │
             ▼
        [unchecked]
             │
     getEvents() called
             │
             ▼
         [loading]
          /       \
    success        failure
       │               │
       ▼               ▼
    [active]        [error]
       │               │
   next fetch       next fetch
       │               │
       └───────┬────────┘
               ▼
           [loading]  (cycle repeats)
```

Error recovery: status returns to `loading` on the next scheduled or manual refresh. There is no terminal/permanent error state — every fetch attempt resets to `loading` first.

---

## Entity Relationship Summary

```
useConnectionStore
  └── Connection[]
        ├── WebCalConnection  ──► WebCalProvider (1 source per connection)
        └── CalDAVConnection  ──► CalDAVProvider (discovers calendar collections)
                                       │
                                       ▼
                              MultiSourceProvider
                                       │
                              Promise.allSettled()
                                       │
                                       ▼
                              merged CalendarEvent[]
                                       │
                                       ▼
                              useEventsStore.events
```
