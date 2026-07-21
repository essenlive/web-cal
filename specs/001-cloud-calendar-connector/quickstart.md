# Quickstart: Cloud Calendar Provider Connector

**Branch**: `001-cloud-calendar-connector` | **Date**: 2026-03-30

A concise guide for developers implementing or testing this feature.

---

## What Is Being Built

A multi-connection data source layer that lets users connect any number of CalDAV servers and WebCal (ICS) subscriptions simultaneously. Events from all connections are merged into the main calendar view with colour-coded source differentiation.

---

## Key Files

| File | Role |
|------|------|
| `src/lib/multi-source-provider.ts` | **NEW** — composite `DataProvider`; fans out to sub-providers |
| `src/types/index.ts` | **UPDATED** — `Connection`, `WebCalConnection`, `CalDAVConnection`, `ConnectionStatus` |
| `src/store/index.ts` | **UPDATED** — `useConnectionStore`; legacy migration from `useBackendStore` |
| `src/context/DataProviderContext.tsx` | **UPDATED** — constructs `MultiSourceProvider` from connection store |
| `src/components/settings/ConnectionList.tsx` | **NEW** — list UI with status badges |
| `src/components/settings/AddConnectionModal.tsx` | **NEW** — Radix Dialog for adding connections |
| `src/components/settings/BackendSettings.tsx` | **UPDATED** — shell replaced by new components |

---

## How to Add a Connection (User Flow)

1. Open **Settings** → **Data Sources** tab.
2. Click **[+ Add Source]**.
3. Select type: **WebCal** (ICS URL) or **CalDAV** (server + credentials).
4. Fill in the form, optionally click **[Test]** to verify connectivity.
5. Click **[Add Source]** — connection appears in the list with `unchecked` status.
6. The app fetches events automatically; status updates to `active` or `error`.

---

## How `MultiSourceProvider` Works

```
MultiSourceProvider.getEvents(start, end)
  │
  ├── for each Connection in store.connections:
  │     makeProvider(conn).getEvents(start, end)  ← parallel
  │
  └── Promise.allSettled(promises)
        ├── fulfilled: events mapped with connection color + namespaced IDs
        └── rejected:  status set to "error"; empty array for that connection
              │
              └── merged result returned to DataProviderContext
```

`getEvents()` never throws — it always resolves. A connection failure is surfaced via the `ConnectionStatusMap` in context state, not as an exception.

---

## Connection ID Namespacing

Every event returned by `MultiSourceProvider` has its `id` prefixed:

```
"${connection.id}::${originalEventId}"
```

This prevents ID collisions when two CalDAV servers happen to use the same event UID, or when the same WebCal feed is added twice under different names.

---

## Colour Assignment

`MultiSourceProvider` sets `customColor: connection.color` and `eventTypeId: "custom"` on every event it returns from that connection. The existing `EventChip` renderer already handles this display path.

---

## Store Migration (Existing Users)

On first load after the upgrade, `useConnectionStore`'s `onRehydrateStorage` checks for the legacy `webcal:backend` localStorage key:

- If `type === "webcal"`: each entry in `webcalSources` becomes a `WebCalConnection`.
- If `type === "caldav"` with a URL set: becomes one `CalDAVConnection`.
- The legacy key is then removed.

New users start with an empty `connections: []` array.

---

## Running Locally

```bash
# Install dependencies (if not already done)
npm install

# Start dev server
npm run dev

# Type-check
npx tsc -b

# Lint
npm run lint

# Production build
npm run build
```

---

## Manual Test Checklist

- [ ] Add a WebCal connection with a public ICS URL (e.g. a public Google Calendar ICS link) → events appear
- [ ] Add a CalDAV connection to a test server (e.g. local Baikal or Radicale) → events appear
- [ ] Verify events from each source show the correct colour
- [ ] Remove one connection → only that source's events disappear
- [ ] Add two connections → both show simultaneously without interference
- [ ] Reload app → connections persist; events re-fetch
- [ ] Enter an invalid URL → status shows `error`; other connections unaffected
- [ ] Dark mode → all new UI elements render correctly
- [ ] Mobile viewport (375px) → settings dialog scrolls; form usable
