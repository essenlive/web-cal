# UI Contracts: Custom Events Display Types

**Branch**: `002-custom-display-types` | **Date**: 2026-03-30

This is a single-page application with no external API surface. Contracts here define the TypeScript interface changes that form the boundaries between layers.

---

## TypeScript Interface Contracts

### EventType (src/types/index.ts)

```typescript
export interface EventType {
  id: string;
  label: string;
  color: string;
  icon: string;
  allDayStyle: DisplayStyle;
  timedStyle: DisplayStyle;   // ← ADDED
}
```

**Invariants**:
- `label` is non-empty after trim
- `label` is unique across all `EventType` records in the store
- `timedStyle` is always a valid `DisplayStyle` value

---

### CalendarEvent (src/types/index.ts)

```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  calendarId: string;
  eventTypeId: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  customColor?: string;
  customIcon?: string;
  customAllDayStyle?: DisplayStyle;
  customTimedStyle?: DisplayStyle;   // ← ADDED
}
```

**Invariants**:
- `customTimedStyle` is only meaningful when `eventTypeId === "custom"`

---

### Connection variants (src/types/index.ts)

```typescript
export interface WebCalConnection {
  type: "webcal";
  id: string;
  name: string;
  url: string;
  color: string;
  proxyUrl?: string;
  displayTypeId?: string;   // ← ADDED — references EventType.id
}

export interface CalDAVConnection {
  type: "caldav";
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  color: string;
  proxyUrl?: string;
  displayTypeId?: string;   // ← ADDED — references EventType.id
}
```

---

## Component Prop Contracts

### ConnectionList (src/components/settings/ConnectionList.tsx)

```typescript
export interface ConnectionListProps {
  connections: Connection[];
  statusMap: ConnectionStatusMap;
  eventTypes: EventType[];           // ← ADDED — for the display type selector
  onRemove: (id: string) => void;
  onUpdate: (conn: Connection) => void;  // ← ADDED — for display type assignment
}
```

---

## resolveEventType Contract (src/components/events/EventChip.tsx)

The existing `resolveEventType` signature is extended to accept a connection lookup:

```typescript
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection?: (calendarId: string) => Connection | undefined,  // ← ADDED
  defaultTypeId?: string,                                           // ← ADDED
): EventType | undefined
```

Resolution order:
1. `event.eventTypeId === "custom"` → virtual EventType from custom fields (including `customTimedStyle`)
2. `getType(event.eventTypeId)` → named type from store
3. `getConnection(event.calendarId)?.displayTypeId` → calendar-level type
4. `getType(defaultTypeId)` → application default

---

## resolveStyle Contract (src/components/events/EventChip.tsx)

```typescript
// Before — timed events always returned "block"
export function resolveStyle(
  type: EventType | undefined,
  _view: CalendarView,
  allDay: boolean
): DisplayStyle

// After — timed events use type.timedStyle
// Signature unchanged; behaviour changes
```

**Breaking change in behaviour**: timed events no longer always return `"block"`. They return `type?.timedStyle ?? "block"`. This is intentional and is the primary behaviour change of this feature.
