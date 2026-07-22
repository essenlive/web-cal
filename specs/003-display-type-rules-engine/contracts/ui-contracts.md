# UI/Type Contracts: Display Type Rules Engine

**Branch**: `003-display-type-rules-engine` | **Date**: 2026-07-21

This is a client-only app with no external API; the "contract" is the TypeScript surface new components and stores must implement, so `EventModal`, `AddConnectionModal`, and the new `RulesPage` can all be built against a stable shape independently.

## `src/types/index.ts` additions

```ts
export type RuleMatchType = "event" | "name" | "source";

export interface Rule {
  id: string;
  matchType: RuleMatchType;
  matchValue: string;
  displayTypeId: string;
  enabled: boolean;
  createdAt: number;
}
```

## `src/store/index.ts` addition — `useRuleStore`

```ts
interface RuleStore {
  rules: Rule[];
  addRule: (r: Omit<Rule, "id" | "createdAt" | "enabled"> & { enabled?: boolean }) => void;
  updateRule: (r: Rule) => void;
  removeRule: (id: string) => void;
  reorderRule: (id: string, toIndex: number) => void;
  toggleRule: (id: string) => void;
  removeRulesForConnection: (connectionId: string) => void;
}
```

## `src/lib/rules.ts` (new module)

```ts
/** True if `pattern` is a syntactically valid RegExp. */
export function isValidPattern(pattern: string): boolean;

/** Predicate used by resolveEventType() and by the rules page match-count preview. */
export function matchesRule(event: CalendarEvent, rule: Rule): boolean;

/** First enabled, non-broken rule matching `event`, in priority order, or undefined. */
export function findMatchingRule(
  event: CalendarEvent,
  rules: Rule[],
  isBroken: (rule: Rule) => boolean,
): Rule | undefined;
```

## `src/components/events/EventChip.tsx` — `resolveEventType()` signature change

```ts
// Before:
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection?: (calendarId: string) => Connection | undefined,
  defaultTypeId?: string,
): EventType | undefined;

// After (new `rules` param inserted before defaultTypeId; all call sites updated):
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection?: (calendarId: string) => Connection | undefined,
  rules?: Rule[],
  defaultTypeId?: string,
): EventType | undefined;
```

All call sites (`MonthView.tsx`, `TimeGridView.tsx`, `AgendaView.tsx`) pass `useRuleStore().rules` alongside the existing `getType`/`getConnection` wiring — same pattern already used for those two.

## `src/lib/multi-source-provider.ts` — `applyConnectionMeta()` change

```ts
// Before: unconditionally stamps eventTypeId:"custom" + customColor
// After: leaves provider-set eventTypeId untouched; connection color becomes
// a resolveEventType() fallback level instead of an ingestion-time stamp.
function applyConnectionMeta(events: CalendarEvent[], conn: Connection): CalendarEvent[] {
  return events.map((e) => ({
    ...e,
    id: conn.type === "caldav" ? `${conn.id}::${e.id}` : e.id,
    // eventTypeId and customColor no longer set here
  }));
}
```

`resolveEventType()` gains the connection-color fallback (Level 5, per data-model.md) using `getConnection(event.calendarId)?.color` when no rule, named type, or `displayTypeId` resolved anything.

## Entry-point contracts (component responsibilities, not exact JSX)

- **`EventModal`**: gains an action ("Create a rule from this event") that opens a rule-creation flow pre-filled with `matchType: "event"`, `matchValue: event.id` — reuses the existing display-type picker already in `EventModal.tsx:161-191` to choose `displayTypeId`.
- **`AddConnectionModal`**: gains an equivalent action pre-filled with `matchType: "source"`, `matchValue: connection.id`.
- **`RulesPage`** (new, `src/views/RulesPage.tsx`, routed at `src/app/settings/rules/page.tsx`): lists `useRuleStore().rules` joined with `useEventTypeStore()` (for target name/color and broken-state) and `useConnectionStore()` (for source display name); supports create (any `matchType`), edit, drag-reorder (`reorderRule`), toggle (`toggleRule`), delete (`removeRule`). Follows the existing Sidebar row-list + modal pattern (`ConnectionRow`/`TypeRow` in `src/components/sidebar/Sidebar.tsx`) rather than introducing a new list UI convention.

---

## Amendment (2026-07-22)

### `src/types/index.ts` changes

```ts
export type RuleMatchType = "event" | "name" | "source" | "all"; // was: "event" | "name" | "source"

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
  // customColor / customIcon / customAllDayStyle / customTimedStyle — REMOVED
}

// WebCalConnection / CalDAVConnection — displayTypeId field REMOVED
```

### `src/lib/rules.ts` signature change

```ts
// Before:
export function findMatchingRule(
  event: CalendarEvent,
  rules: Rule[],
  isBroken: (rule: Rule) => boolean,
): Rule | undefined;

// After — always returns a Rule (catch-all guarantees a match); takes getType
// directly instead of a caller-supplied isBroken predicate:
export function findMatchingRule(
  event: CalendarEvent,
  rules: Rule[],
  getType: (id: string) => EventType | undefined,
): Rule;
```

### `src/components/events/EventChip.tsx` — `resolveEventType()` collapses

```ts
// Before (base 003 feature):
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection?: (calendarId: string) => Connection | undefined,
  rules?: Rule[],
  defaultTypeId?: string,
): EventType | undefined;

// After — getConnection and defaultTypeId both drop out; return type is no
// longer optional (a match, and a resolvable type for it, is guaranteed):
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  rules: Rule[],
): EventType;
```

### `src/store/index.ts` — `useRuleStore` additions

```ts
interface RuleStore {
  rules: Rule[];
  addRule: (r: Omit<Rule, "id" | "createdAt" | "enabled"> & { enabled?: boolean }) => void;
  updateRule: (r: Rule) => void;
  removeRule: (id: string) => void;      // no-op for the matchType:"all" rule's id
  reorderRule: (id: string, toIndex: number) => void; // catch-all always re-sorts to last
  toggleRule: (id: string) => void;      // no-op for the catch-all — enabled stays true
  removeRulesForConnection: (connectionId: string) => void;
}
```

`defaultEventTypeId` is removed from whatever store held it (`useUIStore`) — superseded by the catch-all rule's `displayTypeId`.

### `src/components/ui/combobox.tsx` (new)

```ts
interface ComboboxOption {
  value: string;   // event id or connection id
  label: string;   // event title or connection name — never the raw id
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;   // e.g. "Search events…" / "Search sources…"
  emptyText?: string;     // shown when the filter matches nothing
}

export function Combobox(props: ComboboxProps): JSX.Element;
```

Built on `@radix-ui/react-popover` (already installed) + a plain substring filter over `options` — single-select, no new dependency.

### `RuleModal` — matchValue input per matchType

```
matchType === "name"                    → text input (regex/plain text), unchanged
matchType === "event"                   → <Combobox options={events.map(e => ({ value: e.id, label: e.title }))} />
matchType === "source"                  → <Combobox options={connections.map(c => ({ value: c.id, label: c.name }))} />
matchType === "all" (catch-all only)    → not user-creatable; only displayTypeId is editable
```

### `EventDetail` (renamed from `EventModal`, read-only)

```ts
interface EventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
  onCreateRule: (prefill: { matchType: "event" | "name"; matchValue: string }) => void;
}
```

No `onSave`/`createEvent`/`updateEvent` props — nothing in this view can mutate the event. Displays, in addition to existing read-only fields (title/time/location/notes): the matched rule's description (`matchType`, resolved label via the same event-title/connection-name lookup the `Combobox` uses — never a raw id) and its 1-based priority position among `rules`, or "Default" when only the catch-all matched.
