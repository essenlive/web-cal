# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

General power users who juggle multiple calendars from different providers (Google, Apple, Microsoft, and other ICS/WebCal feeds) and want to actually see them as one coherent calendar, not just overlaid in separate colors. Not scoped to a single named individual — designed for anyone who deals with calendar overload.

## Product Purpose

Merges events from multiple ICS/WebCal feeds into a single calendar view, entirely client-side (no backend, no account, no server-side data store). Success is a calendar where visual noise is under the user's control: what stands out, what recedes, and what's hidden, independent of which calendar an event originally came from.

## Positioning

The rules-driven display engine: an ordered rules engine resolves which display type (color/icon/style) an event renders with, based on conditions the user defines — not a fixed one-color-per-calendar model. A neighboring calendar app (Google Calendar, Fantastical, a native OS calendar) ties an event's look to its source calendar; this app decouples them, so styling can key off any event attribute the user chooses.

## Operating Context

- Runs entirely in the browser against ICS/WebCal feed URLs; a same-origin proxy route (`/api/proxy`) relays fetches that lack CORS headers. All connections are read-only.
- Zero connections configured → seeded local demo data, so the app is usable/explorable with no setup.
- CalDAV existed historically and a persisted CalDAV connection still opens correctly, but it is no longer offered for new connections — new sources are ICS/WebCal only.
- Core workflows: add a source, define a display type (color/icon/style), write ordered rules that assign display types to events, quick-hide a source or type, switch/save view presets, pick or edit a theme.
- All state (connections, display types, rules, hidden state, presets, themes, UI prefs) lives in `localStorage` via Zustand `persist`.

## Capabilities and Constraints

- No backend database — anything server-side is limited to the same-origin fetch proxy; it is not a data store.
- Multi-source fan-out is read-only by design (`createEvent`/`updateEvent`/`deleteEvent` throw on synced sources); only the local demo provider supports writes.
- Per-event-type display: two independent styles per type, one for all-day events and one for timed events (`block`, `avatar-tl/bl/br`, `day`).
- Rules are ordered and resolve exclusively through the rules engine — an event's own `eventTypeId` from ingestion is metadata only, never read directly for styling.

## Brand Commitments

None. No fixed name, logo, or visual identity to preserve — open canvas for the redesign. (Repo/package name is currently "web-cal" / "proton-cal" internally, not a confirmed brand commitment.)

## Evidence on Hand

No real user content, testimonials, or case studies on hand. The app ships with seeded mock demo events (used when zero connections are configured) — treat these as placeholder data, not real evidence.

## Product Principles

1. Visual control is decoupled from data source — where an event comes from should never dictate how it looks.
2. Everything stays client-side — no account, no server data store, no hosted-service trust requirement.
3. The app must remain usable with zero configuration (mock data) and scale up gracefully as sources/types/rules are added.
4. Read-only sync is a hard constraint, not a temporary gap — the UI must never imply write-back to synced calendars.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet.
