# Phase 0 Research: API serveur en lecture seule + flux .ics par preset

## Decision A — How the rules engine runs server-side

**Decision**: Extract `resolveEventType` and `isEventHidden` out of `src/components/events/EventChip.tsx` into a new store-free module (`src/server/rules/resolve.ts`, sharable by both server and client), taking the default `EventType` as an explicit parameter instead of calling `useEventTypeStore.getState()` directly. `src/lib/rules.ts` (`matchesRule`, `findMatchingRule`) needs no change — it's already pure, no browser/store dependency.

**Rationale**: `resolveEventType`/`isEventHidden` currently read `useEventTypeStore.getState()` directly — a Zustand store initialized with the `persist` middleware against `localStorage`. Importing that module server-side would pull in a browser-only dependency (`localStorage` doesn't exist in Node) just to get one value (the default type), which is already available to the caller in every call site. Passing it as a parameter removes the coupling with no behavior change — `EventChip.tsx`'s own call site becomes `resolveEventType(event, getType, rules, useEventTypeStore.getState().getDefaultType())`, i.e. the same value, just supplied explicitly.

**Alternatives considered**:
- *Reimplement the resolution logic separately server-side*: rejected — duplicating the exact same matching semantics (rule order, tiering, catch-all fallback) in two places is exactly the kind of drift the spec's P3/SC-003 ("a feed always matches the rules") is designed to prevent.
- *Mock `localStorage` in the Node process so the Zustand store can initialize unchanged*: rejected — fragile (a global polyfill for one import), and leaves a server process depending on a client-persistence abstraction it has no real use for.

## Decision B — Talking to keeper.sh

**Decision**: A single adapter module (`src/server/aggregation/keeper-client.ts`) wraps keeper.sh's REST API (`/api/v1`) with plain `fetch` calls (`list_calendars`, `get_events`) and a bearer token read from a server-side environment variable. No SDK/client library dependency.

**Rationale**: keeper.sh's API is a small, bearer-token-authenticated JSON REST API (confirmed via its own documentation — see `docs/planning/server-sync-architecture.md`'s benchmark section). A generic `fetch` wrapper is simpler than adding a dependency for a handful of endpoints, and keeps the surface this feature actually depends on explicit and easy to swap later (per the constitution's Data Provider Abstraction principle, extended server-side).

**Alternatives considered**:
- *keeper.sh's MCP server instead of its REST API*: rejected for this feature — MCP is designed for an AI agent's tool-calling loop (OAuth 2.1, tool-shaped calls), not a recurring background job; the REST API is the natural fit for a scheduler.

## Decision C — Persistence for config, tokens, and the aggregated snapshot

**Decision**: SQLite via `better-sqlite3`, one file, holding three things: the imported settings (sources/types/rules/presets, same shape as the client's export), one opaque feed token per preset, and the last-aggregated-events snapshot per source.

**Rationale**: Matches the default already chosen in `docs/planning/server-sync-architecture.md`'s Questions à trancher ("commencer en SQLite"). A single file needs no extra service in the self-hosted container (unlike Postgres), and `better-sqlite3`'s synchronous API is a good fit for a small, single-process scheduler with no concurrent-writer story to solve yet.

**Alternatives considered**:
- *Plain JSON files on disk*: rejected — works for the config import, but the aggregated-events snapshot needs range/lookup queries (which events does preset X currently resolve to) that a flat file makes clumsy; SQLite costs almost nothing extra here and avoids a later migration.
- *Postgres*: rejected for this phase — explicitly deferred in the architecture doc unless the worker's multi-process needs force it; this feature is single-process.

## Decision D — Generating valid `.ics` output

**Decision**: Use `ical-generator` (a small, focused RFC 5545 writer) rather than hand-building ICS text.

**Rationale**: The existing codebase only *parses* ICS (`webcal-provider.ts`'s `parseICS`) — it has no writer, and RFC 5545's escaping/folding/timezone rules are exactly the kind of text-format detail that's easy to get subtly wrong by hand (and hard to notice until some calendar client chokes on it). A small, single-purpose library is a justified exception to "no new dependency," per the constitution's Simplicity principle, which asks for dependencies to be justified by concrete need rather than banning them outright.

**Alternatives considered**:
- *Hand-write the ICS string*: rejected — correctness risk (escaping, line folding, `VALARM`/recurrence edge cases) for no real savings over a small library.

## Decision E — Feed URL protection (no auth exists yet)

**Decision**: Each preset's feed is served at `/api/feed/[token]`, where `token` is a per-preset opaque random identifier generated at creation time (not the preset's own id, which is otherwise visible in client-exported settings JSON).

**Rationale**: Per spec FR-011, with no passphrase/QR auth yet (that's a later phase), URL secrecy is the only protection available. Using a separate random token instead of the preset's existing id avoids leaking a working feed URL to anyone who merely sees an exported settings file or a UI listing preset names.

**Alternatives considered**:
- *Use the preset id directly as the URL*: rejected — preset ids aren't designed to be secrets (they appear in exported JSON, URLs, etc.), so reusing one as the sole access control would be weaker than a dedicated token.
- *Build real auth now instead of a token*: rejected — out of scope for this phase per the spec's own Assumptions (auth is phase 4); a token is the minimum viable protection until then.

All unknowns from the Technical Context are resolved above; no `NEEDS CLARIFICATION` markers remain.
