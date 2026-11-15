# Feature Specification: API serveur en lecture seule + flux .ics par preset

**Feature Branch**: `009-server-ics-presets`
**Created**: 2026-11-15
**Status**: Draft
**Input**: User description: "API serveur en lecture seule qui reproduit l'agrégation multi-sources actuelle (fetch + cache + résolution des règles d'overcal) et expose des flux .ics générés à partir des presets existants. Le serveur agrège les sources (via keeper.sh en self-hosted, voir docs/planning/server-sync-architecture.md), overcal applique son moteur de règles/types/presets par-dessus, et chaque preset devient une URL de flux .ics stable, consommable par un calendrier tiers. C'est la phase 2 du chantier d'architecture serveur décrit dans docs/planning/server-sync-architecture.md (et dans le document de planification interactif discuté avec Quentin) : lecture seule uniquement, pas d'auth passphrase/QR encore, pas d'écriture d'événements, le client overcal existant n'est pas encore branché sur cette API — on valide le serveur seul via le flux .ics généré."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subscribe to a preset from any calendar app (Priority: P1)

An overcal user has already set up sources, display types, rules, and presets (saved combinations of what's visible). They want to see one of their presets — say, "Work only" — in their phone's native calendar app, or in Google/Apple/Outlook calendar, without opening overcal.

**Why this priority**: This is the entire point of the server-side aggregation work — without a consumable feed, nothing the server computes reaches the user anywhere outside the overcal web app. It's the smallest slice that proves the server pipeline (fetch → aggregate → apply rules → export) end to end.

**Independent Test**: Can be fully tested by taking a preset's feed URL, subscribing to it from a standard calendar app (or `curl`-ing it), and confirming the returned calendar only contains the events that preset shows in the overcal web app.

**Acceptance Scenarios**:

1. **Given** a preset named "Work only" that hides a personal source, **When** its feed URL is fetched, **Then** the returned calendar file contains only events from the non-hidden source(s), matching what the overcal web app shows for that preset.
2. **Given** a brand new preset with no visibility restrictions, **When** its feed URL is fetched, **Then** the returned calendar file contains every currently aggregated event.
3. **Given** a feed URL that has never been fetched before, **When** it is fetched for the first time, **Then** it returns a valid calendar file without requiring any prior manual trigger.

---

### User Story 2 - Feeds stay current without anyone having overcal open (Priority: P2)

The user isn't actively using the overcal web app — no browser tab is open — but still expects the feeds they've subscribed to elsewhere to reflect new, changed, or deleted events from their sources.

**Why this priority**: The current client-only design only ever syncs while a tab is open. Moving sync to the server is the core value of this phase — a feed that only updates when a browser happens to be open isn't meaningfully different from what exists today.

**Independent Test**: Can be fully tested by adding/changing an event in a source calendar, waiting for one aggregation cycle with no overcal browser tab open anywhere, then re-fetching a feed URL and confirming the change is reflected.

**Acceptance Scenarios**:

1. **Given** no overcal browser tab is open anywhere, **When** a new event is added to a configured source, **Then** a feed covering that source reflects the new event within one aggregation cycle.
2. **Given** a source becomes temporarily unreachable, **When** a feed is fetched during that outage, **Then** the feed still returns the last successfully aggregated events for the other sources rather than failing outright.

---

### User Story 3 - A preset's feed always matches its rules (Priority: P3)

The user edits their display rules or a preset's visibility (hides a source, renames a rule, changes which type a rule resolves to) and expects every feed tied to that preset to immediately reflect the new resolution — not a stale snapshot.

**Why this priority**: The rules engine is overcal's core value; a feed that silently drifts from what the rules actually resolve to would undermine trust in the whole aggregation layer. Lower priority than P1/P2 because it only matters once feeds already exist and are being iterated on.

**Independent Test**: Can be fully tested by changing a rule or a preset's visibility, then re-fetching the preset's feed and confirming the event set changes accordingly, without needing a new feed URL.

**Acceptance Scenarios**:

1. **Given** a preset's feed already has subscribers, **When** the administrator hides an additional source from that preset, **Then** the next fetch of that same feed URL excludes that source's events.
2. **Given** a rule is reordered so a different type now wins for an event, **When** that event appears in a preset's feed, **Then** it is included or excluded consistently with the new rule resolution (e.g. if the newly-resolved type is hidden).

### Edge Cases

- What happens when a preset that already has a published feed URL is deleted? The feed URL must stop serving content (consumers see it as broken/gone, not silently empty forever).
- What happens when every event under a preset is hidden? The feed must return a valid, empty calendar rather than an error.
- What happens when a configured source's credentials/URL become invalid? That source's failure must not take down feeds for presets that don't depend on it.
- What happens when a calendar app polls the feed URL very frequently (e.g. every minute)? The server must serve the last aggregated result without re-fetching every source on every request.
- What happens if two presets have identical visibility settings? Each still gets its own distinct, independent feed URL.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST aggregate events from every configured calendar source on a recurring schedule, independent of whether any overcal client is open.
- **FR-002**: System MUST apply overcal's existing display-rules resolution (rule order, name/source/catch-all matching, default type fallback) to determine, for each event, which display type it resolves to and whether it is hidden.
- **FR-003**: System MUST let each existing preset (a saved combination of source/type visibility) be exposed as its own calendar feed.
- **FR-004**: Each preset's feed MUST be reachable at its own stable, unique URL that returns a standard calendar file format readable by common calendar applications.
- **FR-005**: A feed's returned content MUST include only the events that resolve to a visible (non-hidden) type and source under that preset's visibility settings — mirroring exactly what the overcal web app would show for that preset.
- **FR-006**: System MUST keep a preset's feed URL unchanged across edits to its visibility settings or to the rules/types it depends on — only the content returned changes, not the address.
- **FR-007**: System MUST return a valid, empty calendar (not an error) when a preset currently has zero visible events.
- **FR-008**: System MUST stop serving a feed's content once its underlying preset has been deleted.
- **FR-009**: System MUST NOT create, modify, or delete any event in any configured source — aggregation is strictly read-only, exactly as today's client-only behavior.
- **FR-010**: System MUST continue serving previously aggregated events for sources that are still healthy when one configured source fails to sync, rather than failing an entire feed because of one broken source.
- **FR-011**: System MUST make a feed's URL effectively unguessable (e.g. an opaque per-preset token), since no login/authentication exists yet at this phase — URL secrecy is the only access control until passphrase/QR auth (a later phase) exists.
- **FR-012**: System MUST allow the administrator to configure sources, types, rules, and presets on the server by reusing overcal's existing settings export format, without requiring a new client to be built for this phase.

### Key Entities

- **Source**: A calendar connection (ICS/WebCal URL), same shape as today's client-side connections — now fetched and cached by the server instead of a browser.
- **Preset**: An existing overcal concept — a named, saved combination of source/type visibility — extended here to also own a feed.
- **Feed**: The server-exposed artifact tied one-to-one with a preset: an address, and the calendar-file content currently valid for that preset.
- **Aggregated Event**: An event from a source, resolved through the rules engine to its display type and visibility, as used to decide feed membership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any existing preset has a working feed URL that returns a valid calendar file on first fetch, with no manual setup step beyond the preset already existing.
- **SC-002**: A change made directly to a source calendar (new, updated, or deleted event) is reflected in the relevant feed(s) within one aggregation cycle, with zero overcal browser tabs open at any point during that cycle.
- **SC-003**: A feed's content always matches what the overcal web app would currently render for that same preset — zero observed drift between the two when compared side by side after a rules/visibility change.
- **SC-004**: Deleting a preset makes its feed stop returning content; no stale feed keeps serving indefinitely after its preset is gone.
- **SC-005**: Across the aggregation process, zero write operations (create/update/delete) are ever issued against any configured source.
- **SC-006**: One source being unreachable does not prevent any other preset's feed (one that doesn't depend on that source) from being served successfully.

## Assumptions

- The administrator configures the server's sources, types, rules, and presets by importing the same settings-export JSON the overcal client already produces (via its existing `/data` export/import), rather than through a new dedicated admin UI built for this phase — this phase validates the server/feed pipeline, not a new configuration surface.
- Feed consumers are standard calendar applications that already know how to subscribe to a `.ics`/webcal URL (Google Calendar, Apple Calendar, Outlook, etc.) — no custom client is required to consume a feed.
- This is a single-household/self-hosted deployment (per the broader architecture plan): no multi-user access control is in scope for this phase beyond keeping feed URLs unguessable; real authentication (passphrase/QR) is a later phase.
- The aggregation refresh cadence targets a few minutes (consistent with the existing client's background-sync behavior) — exact timing is an implementation detail, not a scoped requirement here, as long as SC-002 holds.
- The existing overcal web client is explicitly out of scope for this phase: it is not wired up to call this server yet (that is phase 3, "sync des réglages"). This phase is validated by fetching generated feed URLs directly.
- Source aggregation itself is delegated to the already-evaluated keeper.sh self-hosted service (see `docs/planning/server-sync-architecture.md`); this feature's own scope is the layer on top of it (rules/presets resolution + feed generation), not re-implementing source fetching.

## Revision 2026-11-15: keeper.sh replaced by connectors

Decision (Quentin): keeper.sh brings far more than needed (accounts, billing, MCP, web UI, Postgres + Redis, AGPL). The server now reads and writes through its own small *connectors* (`src/server/connectors/`): ICS/WebCal (read-only, reusing the shared `src/lib/ics-parse.ts`) and CalDAV (read + create, via `tsdav`, verified against a real Radicale). Endpoint credentials are attached to a connection id through an `endpoints` array in the import JSON and stored encrypted (AES-256-GCM, `SECRET_KEY`). `POST /api/events` creates an event on a writable endpoint. Anything above that mentions keeper.sh, `KEEPER_*` or `keeper-client.ts` is superseded by this section; Google/Microsoft OAuth endpoints, update and delete are deferred.
