# Research: Custom Events Display Types

**Branch**: `002-custom-display-types` | **Date**: 2026-03-30

## Findings

---

### Decision 1: How to add timed-event style to EventType

**Decision**: Add `timedStyle: DisplayStyle` as a new field on `EventType`, alongside the existing `allDayStyle`.

**Rationale**: The existing `allDayStyle` field covers all-day events. Timed events currently hardcode `"block"` in `resolveStyle()` at `src/components/events/EventChip.tsx:44`. Adding a symmetric `timedStyle` field makes the two axes independent and explicit. The existing `migrateType()` function in `src/store/index.ts:138` already handles forward migration — we add a `timedStyle: "block"` default there so persisted records without the new field are upgraded transparently.

**Alternatives considered**:
- Reusing `allDayStyle` for both contexts (differentiated by `event.allDay`) — rejected: ambiguous API, breaks the existing clear separation
- A single `style` field applied to both contexts — rejected: loses the ability to specify different styles for timed vs all-day occurrences of the same type

---

### Decision 2: How to extend Connection with a display type

**Decision**: Add `displayTypeId?: string` as an optional field on both `WebCalConnection` and `CalDAVConnection` in `src/types/index.ts`.

**Rationale**: Both connection variants are persisted via `useConnectionStore` (Zustand persist). Adding an optional field requires no migration — Zustand/JSON deserialization leaves missing fields as `undefined`. The `displayTypeId` references an `EventType.id`. Since both connection variants share the same discriminated union `Connection`, both must carry the field to avoid narrowing issues.

**Alternatives considered**:
- A separate store mapping `connectionId → displayTypeId` — rejected: adds unnecessary indirection; the connection already owns all its configuration
- Storing display type data inline on the connection (color, icon, style) — rejected: duplicates data and creates sync problems when the display type is edited

---

### Decision 3: Display type resolution precedence chain

**Decision**: Implement a `useResolvedEventType(event)` hook that encapsulates the full lookup chain:
1. If `event.eventTypeId === "custom"` → build virtual EventType from `customColor`, `customIcon`, `customAllDayStyle`, `customTimedStyle`
2. Else if the EventType store has a matching type → use it
3. Else look up the event's calendar connection; if it has `displayTypeId` → use that EventType
4. Else fall back to the application default EventType (`useUIStore.defaultEventTypeId`)

**Rationale**: Centralizing this logic in a hook prevents each rendering component from reimplementing the precedence rules. The existing `resolveEventType()` helper in `EventChip.tsx` handles cases 1–2; we extend it (or replace it with the hook) to add case 3. The hook reads from `useEventTypeStore`, `useConnectionStore`, and `useEventsStore` — all already available.

**Alternatives considered**:
- Resolving in `DataProviderContext` at fetch time (materializing the type into each event) — rejected: the type can change after fetch, and it conflates data fetching with display logic
- Resolving inline in each component — rejected: duplicates logic and makes precedence changes require multi-file updates

---

### Decision 4: Calendar-level display type selector in settings UI

**Decision**: Add a compact inline display type dropdown to `ConnectionRow` in `src/components/settings/ConnectionList.tsx`. The selector appears after the status badge and before the remove button. Selecting "None" removes the `displayTypeId`.

**Rationale**: The row is already dense, but a small type-picker (colored dot + name + chevron) fits within the existing pattern. The `ConnectionList` component receives `onUpdate` as a new prop, mirroring the existing `onRemove` prop pattern. No new settings tab or modal is needed.

**Alternatives considered**:
- A dedicated "edit connection" modal — rejected: adds complexity for a single new field; the row pattern is sufficient
- Placing the selector in the event type settings tab — rejected: wrong mental model; display type assignment is a property of the connection, not the type

---

### Decision 5: Duplicate display type name prevention

**Decision**: Validate in `EventTypeForm` before calling `addType`/`updateType`: if the trimmed label already exists in the store (excluding the currently-edited type's own ID), show an inline error and disable the save button.

**Rationale**: The store's `addType` action does not check for duplicates. Validation in the form (not the store) keeps the store simple and keeps error UI close to the input. The store is internal; uniqueness is a UX contract, not a data integrity constraint.

---

### Decision 6: Deletion warning when display type is in use

**Decision**: Before calling `removeType`, query `useConnectionStore.connections` for any with `displayTypeId === id`, and `useEventsStore.events` for any with `eventTypeId === id`. If found, show a confirmation dialog listing the affected count. On confirm, call `removeType`; affected connections/events automatically resolve to fallback (the hook's precedence chain handles graceful degradation without needing to null-out the references).

**Rationale**: Leaving stale `displayTypeId` / `eventTypeId` references in connections/events is safe — the resolution hook's fallback chain catches missing types. Cleaning them up on deletion would require mutations to events (which may be remote/read-only via CalDAV). The warning satisfies FR-003 and FR-011.

---

### Decision 7: No changes to DataProviderContext

**Decision**: The DataProvider abstraction (`src/context/DataProviderContext.tsx`) is not modified. Display type resolution is purely a presentation concern handled in the component layer.

**Rationale**: The data provider contract (`listEvents`, `createEvent`, `updateEvent`, `deleteEvent`) operates on `CalendarEvent` objects. Display type assignment does not affect remote data; it is stored locally in `useEventTypeStore` and `useConnectionStore`. Adding display type logic to the provider would violate the abstraction boundary (Principle VI of the constitution).

---

### Decision 8: customTimedStyle for per-event "Custom" overrides

**Decision**: Add `customTimedStyle?: DisplayStyle` to `CalendarEvent`. The `resolveEventType()` helper uses it when building the virtual EventType for custom events, and `EventModal` exposes a timed style picker when "Custom" is selected.

**Rationale**: Consistent with the existing `customAllDayStyle`, `customColor`, `customIcon` pattern. The field is optional; existing custom events without `customTimedStyle` default to `"block"` via the fallback in `resolveEventType`.

---

## Key Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `timedStyle` to `EventType`; add `displayTypeId?` to both connection types; add `customTimedStyle?` to `CalendarEvent` |
| `src/store/index.ts` | Update `migrateType()` to set `timedStyle: "block"` default; update `DEFAULT_EVENT_TYPES` |
| `src/components/events/EventChip.tsx` | Update `resolveStyle()` to use `type?.timedStyle`; update `resolveEventType()` for `customTimedStyle` |
| `src/pages/SettingsPage.tsx` | Add `timedStyle` field to `EventTypeForm`; add timed style preview; duplicate name validation |
| `src/components/settings/ConnectionList.tsx` | Add `displayTypeId` selector to `ConnectionRow`; add `onUpdate` prop |
| `src/components/settings/BackendSettings.tsx` | Pass `onUpdate` to `ConnectionList` |
| `src/components/events/EventModal.tsx` | Add `customTimedStyle` picker for custom events |

## No New Files Required

All changes extend existing files. The hook for resolution (`useResolvedEventType`) can be co-located with `EventChip.tsx` or extracted to a small utility — to be decided during implementation per YAGNI.
