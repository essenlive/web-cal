# Quickstart: validating the phase-2 server

This phase is validated directly — no client UI change exists to click through. Steps assume the app is running locally (`npm run dev`) with a keeper.sh instance reachable and its bearer token set in the environment (`KEEPER_API_TOKEN`, `KEEPER_BASE_URL`).

## 1. Import a configuration

Export settings from the existing client app (`/data` → export) and POST it to the server:

```bash
curl -X POST http://localhost:3000/api/admin/import \
  -H "Content-Type: application/json" \
  --data-binary @settings-export.json
```

Expect a `200` with a `feedUrls` array — one entry per preset in the imported file.

## 2. Wait for one aggregation cycle

The scheduler runs on its own; no manual trigger exists in this phase. Check server logs for a completed cycle (or inspect `SourceSnapshot.lastSyncedAt` directly in the SQLite file) before fetching a feed for the first time.

## 3. Fetch a preset's feed

```bash
curl http://localhost:3000/api/feed/<token-from-step-1>
```

Expect:
- `Content-Type: text/calendar; charset=utf-8`
- A `BEGIN:VCALENDAR` / `END:VCALENDAR` body
- Only events matching that preset's visible sources/types — cross-check against the same preset selected in the running client app, pointed at the same sources.

## 4. Subscribe from a real calendar app

Paste the feed URL into Google Calendar ("Other calendars → From URL") or Apple Calendar ("File → New Calendar Subscription"). Confirm the events shown match step 3.

## 5. Verify the read-only / failure-isolation guarantees

- Confirm no write ever reaches a source: there is no code path in this feature that calls anything but keeper.sh's read endpoints (`list_calendars`/`get_events`) — this is verified by code review / the unit tests in `tests/server/scheduler.test.ts`, not by a runtime check.
- Temporarily break one source's URL in the imported config, re-import, and confirm feeds for *other*, healthy sources still return successfully (spec FR-010/SC-006).

## 6. Verify deletion stops the feed

Re-import a configuration with one preset removed. Confirm its old feed URL now returns `404` (spec FR-008).
