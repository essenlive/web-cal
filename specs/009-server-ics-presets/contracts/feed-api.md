# Contract: Feed & config-import endpoints

Both endpoints are Next.js App Router route handlers, added under `src/app/api/`. Neither is reachable by the existing client in this phase (spec Assumptions: client wiring is phase 3).

## `GET /api/feed/[token]`

Returns the `.ics` feed for the preset owning `token`.

**Request**: no body, no query params. `token` is the opaque identifier from `FeedToken.token` (data-model.md), not a preset id.

**Response — 200 OK**
- `Content-Type: text/calendar; charset=utf-8`
- Body: a valid RFC 5545 calendar (`VCALENDAR`/`VEVENT`s), containing exactly the events that resolve to a visible type/source under that preset's visibility settings (spec FR-005), built from the current `SourceSnapshot` rows — never triggers a live fetch (spec edge case: frequent polling must not re-fetch sources).
- An empty-but-valid calendar (`VCALENDAR` with zero `VEVENT`s) when the preset currently has no visible events (spec FR-007).

**Response — 404 Not Found**
- `token` doesn't match any current `FeedToken` — covers both "never existed" and "preset was deleted" (spec FR-008): deleting a preset removes its `FeedToken` row, so its feed starts 404ing immediately on the next request, with no separate cleanup step needed.

**Response — 500 Internal Server Error**
- Reserved for genuine server faults (e.g. the SQLite file is unreadable). A single source being down is explicitly NOT a 500 for feeds that don't depend on it (spec FR-010) — other sources' events still render; only that source's contribution is simply whatever its last-good `SourceSnapshot` held.

**Acceptance scenarios covered**: spec User Story 1 (all three scenarios), User Story 3 (scenario 1), edge cases "preset deleted," "all events hidden," "high-frequency polling."

## `POST /api/admin/import`

Replaces the server's entire configuration (sources/types/rules/presets) from a settings-export JSON — the same format/shape the client's existing `/data` export already produces (`settings-export.ts`), reused as-is rather than inventing a new schema for this phase.

**Request**
- `Content-Type: application/json`
- Body: the settings-export JSON object (connections, event types, rules, presets — themes/UI-prefs fields are accepted but ignored, since they're not meaningful without a UI).
- Auth: none in this phase, beyond this endpoint only being reachable on the self-hosted instance's own network per the broader architecture plan's "no account yet" direction (spec Assumptions) — not internet-exposed by default deployment.

**Response — 200 OK**
```json
{ "importedPresets": 3, "importedConnections": 2, "feedUrls": [
  { "presetId": "...", "presetName": "Work only", "url": "/api/feed/<token>" }
] }
```
- Every imported `Preset` gets or keeps a `FeedToken`; the response lists each preset's resulting feed path so the administrator can copy it into a calendar app.

**Response — 400 Bad Request**
- Body isn't valid JSON, or doesn't match the expected settings-export shape (missing required top-level keys).

**Acceptance scenarios covered**: spec Assumptions ("administrator configures sources... by importing the same settings-export JSON").
