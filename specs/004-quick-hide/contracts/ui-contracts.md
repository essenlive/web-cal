# UI Contracts: Quick Hide

TypeScript interface contracts for the new/amended surfaces. No REST/network contracts apply (client-side-only feature).

## `isEventHidden` (new export, `src/components/events/EventChip.tsx`)

```ts
/**
 * True if `event` must be excluded from every calendar view because its
 * source connection is hidden, or because its resolved effective display
 * type is hidden. Pure function — no hooks, same calling convention as the
 * existing resolveEventType()/resolveStyle().
 */
export function isEventHidden(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection: (calendarId: string) => Connection | undefined,
  defaultTypeId?: string,
): boolean;
```

Call sites (all three follow the identical pattern — filter immediately after reading raw events, before any date/lane/day-grouping logic runs):

```ts
// MonthView.tsx / TimeGridView.tsx (inside the component body, after getConnection is defined)
const events = useMemo(
  () => allEvents.filter((e) => !isEventHidden(e, getType, getConnection, defaultEventTypeId)),
  [allEvents, getType, getConnection, defaultEventTypeId],
);

// AgendaView.tsx (not memoized elsewhere in this file today, so a plain filter matches existing style)
const events = allEvents.filter((e) => !isEventHidden(e, getType, getConnection, defaultEventTypeId));
```

## `EventType` (amended, `src/types/index.ts`)

```ts
export interface EventType {
  id: string;
  label: string;
  color: string;
  icon: string;
  allDayStyle: DisplayStyle;
  timedStyle: DisplayStyle;
  /** When true, events resolving to this type are excluded from all calendar views. Config is preserved. */
  hidden?: boolean;
}
```

## `WebCalConnection` / `CalDAVConnection` (amended, `src/types/index.ts`)

```ts
export interface WebCalConnection {
  // ...existing fields unchanged...
  /** When true, this connection's events are excluded from all calendar views. Config/credentials are preserved. */
  hidden?: boolean;
}

export interface CalDAVConnection {
  // ...existing fields unchanged...
  /** When true, this connection's events are excluded from all calendar views. Config/credentials are preserved. */
  hidden?: boolean;
}
```

## Sidebar quick-toggle section (new, `src/components/sidebar/Sidebar.tsx`)

No new exported component — an internal, file-local presentational block (not exported, not reused elsewhere, so no separate contract file is warranted per Constitution Simplicity/YAGNI):

```ts
interface VisibilityItem {
  id: string;
  label: string;
  color: string;
  /** lucide-react icon name; omitted for connections (color swatch used instead) */
  icon?: string;
  hidden?: boolean;
  onToggle: () => void;
}
```

Rendered as two labeled groups ("Sources", "Types") beneath the existing mini calendar, each row showing a swatch/icon, the label (dimmed when hidden), and an `Eye`/`EyeOff` button calling `onToggle`.

## Existing rows gain a toggle prop (no new component contracts)

- `ConnectionList.tsx`'s `ConnectionRow` already receives `onUpdate: (conn: Connection) => void` — the new hide/show button calls `onUpdate({ ...connection, hidden: !connection.hidden })` inline; no prop signature change.
- `SettingsPage.tsx`'s `EventTypeRow` gains one new prop:

```ts
function EventTypeRow({ type, onEdit, onDelete, onToggleHidden }: {
  type: EventType;
  onEdit: (t: EventType) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (t: EventType) => void; // caller does updateType({ ...t, hidden: !t.hidden })
}): JSX.Element;
```
