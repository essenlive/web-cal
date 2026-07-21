# Data Model: Custom Events Display Types

**Branch**: `002-custom-display-types` | **Date**: 2026-03-30

## Changed Entities

### EventType *(extended)*

Adds `timedStyle` to cover timed (scheduled) event rendering — previously hardcoded to `"block"`.

```
EventType {
  id:          string        — stable identifier (UUID or slug for defaults)
  label:       string        — user-visible name; MUST be unique (validated in UI)
  color:       string        — hex color, e.g. "#3b82f6"
  icon:        string        — lucide-react icon name, e.g. "Users"
  allDayStyle: DisplayStyle  — rendering mode for all-day events (unchanged)
  timedStyle:  DisplayStyle  — rendering mode for timed/scheduled events (NEW)
                               default: "block"
}
```

**Validation rules**:
- `label` must be non-empty after trimming
- `label` must be unique across all EventTypes (checked in UI before save)
- `timedStyle` defaults to `"block"` for migrated records without this field

**State transitions**:
- Created → user-defined (visible in all selectors)
- Updated → all referencing events and connections reflect change immediately (reactive via Zustand)
- Deleted → referencing connections/events fall back to the resolution chain's next level; no cleanup of references needed

---

### CalendarEvent *(extended)*

Adds `customTimedStyle` to support per-event timed style overrides in "Custom" mode.

```
CalendarEvent {
  id:                string         — stable event identifier
  title:             string
  calendarId:        string         — references Connection.id
  eventTypeId:       string         — references EventType.id, or "custom"
  start:             string         — ISO timestamp
  end:               string         — ISO timestamp
  allDay:            boolean
  location?:         string
  notes?:            string
  customColor?:      string         — only when eventTypeId === "custom"
  customIcon?:       string         — only when eventTypeId === "custom"
  customAllDayStyle?: DisplayStyle  — only when eventTypeId === "custom"
  customTimedStyle?:  DisplayStyle  — only when eventTypeId === "custom" (NEW)
}
```

**Validation rules**:
- `customTimedStyle` is only meaningful when `eventTypeId === "custom"`; ignored otherwise
- If absent in a "custom" event, defaults to `"block"` in `resolveEventType()`

---

### WebCalConnection *(extended)*

```
WebCalConnection {
  type:           "webcal"
  id:             string     — stable UUID
  name:           string
  url:            string
  color:          string
  proxyUrl?:      string
  displayTypeId?: string     — references EventType.id (NEW); optional
}
```

---

### CalDAVConnection *(extended)*

```
CalDAVConnection {
  type:           "caldav"
  id:             string
  name:           string
  url:            string
  username:       string
  password:       string
  color:          string
  proxyUrl?:      string
  displayTypeId?: string     — references EventType.id (NEW); optional
}
```

**Validation rules**:
- `displayTypeId` is optional; `undefined` means "no calendar-level display type"
- If the referenced EventType is deleted, the field becomes a dangling reference; the resolution chain gracefully falls through to the next level

---

## Display Type Resolution Chain

The following precedence is applied when rendering any event. The first matching level wins:

```
Level 1 (highest): eventTypeId === "custom"
  → Build virtual EventType from:
      color:        event.customColor    ?? "#6366f1"
      icon:         event.customIcon     ?? "Calendar"
      allDayStyle:  event.customAllDayStyle ?? "block"
      timedStyle:   event.customTimedStyle  ?? "block"  ← NEW

Level 2: EventType store has matching EventType for event.eventTypeId
  → Use that EventType's color, icon, allDayStyle, timedStyle

Level 3: event's Connection (by event.calendarId) has displayTypeId set
  → Look up that EventType in the store
  → Use its color, icon, allDayStyle, timedStyle

Level 4 (lowest): UIStore.defaultEventTypeId
  → Look up that EventType in the store
  → Use its color, icon, allDayStyle, timedStyle
```

**resolveStyle() changes** (in `EventChip.tsx`):

```
// Before:
if (!allDay) return "block";
return type?.allDayStyle ?? "day";

// After:
if (!allDay) return type?.timedStyle ?? "block";
return type?.allDayStyle ?? "day";
```

---

## Persistence

| Store | Key | Fields added | Migration needed |
|-------|-----|-------------|-----------------|
| `useEventTypeStore` | `proton-cal:event-types` | `timedStyle` | Yes — `migrateType()` adds `timedStyle: "block"` default |
| `useConnectionStore` | `webcal:connections` | `displayTypeId` | No — optional field, undefined on old records |
| `useEventsStore` | (not persisted) | `customTimedStyle` | No — session-only |

---

## No New Stores

All changes are additions to existing persisted stores. No new Zustand stores are introduced.
