# Research: Cloud Calendar Provider Connector

**Branch**: `001-cloud-calendar-connector` | **Date**: 2026-03-30

## 1. Multi-Provider Aggregation Pattern

**Decision**: Composite provider (`MultiSourceProvider`) implementing `DataProvider`, fanning out `getEvents()` calls to all active sub-providers in parallel via `Promise.allSettled`, then merging results.

**Rationale**: `Promise.allSettled` (vs `Promise.all`) is critical here — a single failing connection (network error, expired credentials) must not block events from healthy connections. The existing `DataProvider` interface is unchanged, so all calendar views continue to call `useDataProvider().getEvents()` with no modifications. This is the simplest path: one new file, no new context or routing.

**Alternatives considered**:
- *Separate context per connection*: Would require every calendar component to aggregate results itself — high coupling, significant refactor.
- *Sequential fetching*: Simpler to implement but slow; a hanging connection would delay all others.
- *Event streaming / subscription*: Overcomplicated for a PWA with no server-side push.

---

## 2. Connection State Model

**Decision**: Replace the flat `BackendConfig` (type + fields) with a `Connection[]` array where each item is a discriminated union: `WebCalConnection | CalDAVConnection`. Status (`active | error | loading | unchecked`) is a runtime-only field derived during `getEvents()` calls, NOT persisted.

**Rationale**: A discriminated union on `type` gives TypeScript exhaustive narrowing for free — no casting needed when constructing provider instances. Runtime status is volatile (changes on every fetch attempt) so persisting it would create stale-state bugs on reload. The store persists only the connection *config*; the context tracks live *status* in local state.

**Alternatives considered**:
- *Single object with optional fields*: Works but requires runtime null-checks for every field; no compile-time exhaustiveness.
- *Persisting status*: Would show stale "active" badges after a crash; cleaner to re-derive on mount.

---

## 3. Connection Identity & Event Namespacing

**Decision**: Each `Connection` carries a stable `id: string` (UUID generated at creation time). Event IDs from sub-providers are namespaced as `${connectionId}::${providerEventId}` to guarantee global uniqueness across multiple connections to the same CalDAV server.

**Rationale**: The existing `WebCalProvider` already uses a composite ID pattern (`${source.id}::${uid}`). Extending this to CalDAV connections eliminates a class of ID collisions that would cause events from different connections to silently overwrite each other in `useEventsStore`.

**Alternatives considered**:
- *Hash-based namespacing*: Deterministic but complex; UUID is simpler and sufficient for a single-user app.
- *Provider-scoped stores*: Separate event arrays per provider — would require touching every calendar component that reads events.

---

## 4. Colour Differentiation Strategy

**Decision**: Each `Connection` stores a `color: string` (hex). `MultiSourceProvider` attaches `customColor` to every event it returns from that connection, overriding `eventTypeId` with `"custom"`. The existing `EventChip` rendering path already handles `customColor` for `eventTypeId === "custom"`.

**Rationale**: The `CalendarEvent` type already has `customColor` and the rendering already supports it — zero new display logic needed. The 8-colour palette from the existing WebCal source picker is reused.

**Alternatives considered**:
- *New `sourceColor` field on CalendarEvent*: Cleaner semantically but requires touching types, store, and every event renderer.
- *CSS class per connection*: Requires dynamic stylesheet injection or Tailwind JIT safelist — unnecessary complexity.

---

## 5. Settings UI Architecture

**Decision**: Replace the single `BackendSettings.tsx` tab with a `ConnectionList` + `AddConnectionModal` pattern. The list shows all connections with a colour swatch, name, type badge, and live status indicator. Add/Remove are the only management operations for v1 (re-auth handled by remove + re-add, not inline).

**Rationale**: The spec requires displaying connection status and allowing removal (FR-004, FR-005). Re-auth inline (FR-006) adds significant state machine complexity (token refresh vs. full re-auth varies per protocol). For CalDAV (Basic Auth), "re-auth" is simply editing credentials — equivalent to adding a new connection. Deferring inline re-auth reduces v1 scope to a manageable UI surface.

**Alternatives considered**:
- *Inline edit connection*: Useful but doubles the form surface; deferred to v2.
- *Wizard-style flow*: Step-by-step connection setup; unnecessary for 2-field CalDAV and 1-field WebCal forms.

---

## 6. Backward Compatibility with Existing BackendStore

**Decision**: On app load, `useConnectionStore` runs a one-time migration: if the legacy `webcal:backend` localStorage key exists with type `"webcal"` or `"caldav"`, convert it to a `Connection[]` entry and remove the old key. `useBackendStore` is kept but marked deprecated (no new code reads it).

**Rationale**: Existing users have saved configuration. Silently losing it on upgrade is unacceptable. A migration shim in the store's `onRehydrateStorage` callback handles this transparently.

**Alternatives considered**:
- *Keep BackendStore*: Creates two sources of truth for connection config; confusing and error-prone.
- *No migration*: Users lose their existing CalDAV/WebCal config silently — bad UX.

---

## 7. CORS Proxy Scope

**Decision**: CORS proxy is a per-connection setting (each `CalDAVConnection` and `WebCalConnection` has an optional `proxyUrl`). The proxy field UI is shown as a collapsible "Advanced" section.

**Rationale**: Different connections may route through different proxies (e.g., corporate CalDAV behind a company proxy, public WebCal without proxy). The existing providers already accept `proxyUrl` as a constructor arg.

**Alternatives considered**:
- *Global proxy setting*: Simpler UI but prevents per-connection proxy customisation that real users need.
