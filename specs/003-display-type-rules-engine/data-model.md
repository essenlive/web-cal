# Data Model: Display Type Rules Engine

**Branch**: `003-display-type-rules-engine` | **Date**: 2026-07-21

## New Entity

### Rule

```
Rule {
  id:            string   — stable UUID
  matchType:     "event" | "name" | "source"
  matchValue:    string   — meaning depends on matchType:
                            "event"  → a CalendarEvent.id
                            "name"   → a regex pattern (plain text is a valid trivial regex)
                            "source" → a Connection.id
  displayTypeId: string   — references EventType.id
  enabled:       boolean  — default true
  createdAt:     number   — epoch ms, used only to compute default insertion position
}
```

**Validation rules**:
- `matchValue` for `matchType === "name"` MUST be a syntactically valid `RegExp` (validated with `try { new RegExp(matchValue, "i") } catch`); rejected at save time otherwise (FR-007).
- No two rules may share the same `(matchType, matchValue, displayTypeId)` triple (FR-008) — exact duplicates rejected at save time.
- `displayTypeId` is not required to reference an existing `EventType` at all times — see "Broken rules" below.

**Broken rules** (derived, not stored):
- A rule is "broken" when `useEventTypeStore().getType(rule.displayTypeId)` returns `undefined` (its target display type was deleted). Broken rules are not deleted automatically, are still shown (flagged) on the global rules page, and are skipped during matching — evaluation falls through to the next matching rule or the existing legacy chain (FR-013).

**Lifecycle**:
- Created → from event modal (`matchType: "event"`, pre-filled `matchValue: event.id`), from connection modal (`matchType: "source"`, pre-filled `matchValue: connection.id`), or from the global rules page (any `matchType`, blank).
- Deleted → user action, or automatically when its `matchType === "source"` and the referenced `Connection` is deleted (FR-012).
- Reordered → array position change only (see `RuleStore` below); no field on `Rule` itself encodes priority.
- Enabled/disabled → toggled from the global rules page; disabled rules are skipped during matching but not deleted (Story 3, scenario 3).

## Store

```
RuleStore {
  rules: Rule[]                         — ARRAY ORDER IS PRIORITY (index 0 = highest)
  addRule: (r: Omit<Rule, "id" | "createdAt" | "enabled"> & { enabled?: boolean }) => void
    — `enabled` defaults to `true` when omitted; inserts at the default position for its
      matchType tier (event > name > source), newest-first within the tier (see research.md Decision 3)
  updateRule: (r: Rule) => void         — in-place field update, does not change position
  removeRule: (id: string) => void
  reorderRule: (id: string, toIndex: number) => void  — explicit user drag-reorder
  toggleRule: (id: string) => void      — flips `enabled`
  removeRulesForConnection: (connectionId: string) => void
    — called by useConnectionStore.removeConnection to satisfy FR-012
}
```

Persisted at `webcal:rules` via Zustand `persist` middleware, following the existing pattern of `useEventTypeStore` (`proton-cal:event-types`) and `useConnectionStore` (`webcal:connections`).

## Changed Behavior (no schema changes)

### CalendarEvent, EventType, Connection *(unchanged)*

No new fields added to any existing type. `Rule.matchValue` references existing `CalendarEvent.id` / `Connection.id` / `EventType.id` by string value only — no back-references stored on those entities (except the `removeRulesForConnection` cleanup hook triggered by connection deletion).

### Resolution chain (`resolveEventType()` in `EventChip.tsx`)

Extended from 4 levels to 6, per `research.md` Decision 1 & 2:

```
Level 1: event.eventTypeId === "custom" (explicit per-event hand-styling only —
         no longer stamped automatically by ingestion; see Level 5)
Level 2 (NEW): first enabled, non-broken Rule matching this event, in rules[] order
Level 3: named EventType via event.eventTypeId
Level 4: connection.displayTypeId
Level 5 (was implicit Level 1 for ingested events): connection color fallback
         — virtual custom type built from connection.color, used only if nothing above matched
Level 6: app default type (useUIStore().defaultEventTypeId)
```

### Rule matching predicate

```
matchesRule(event, rule, getConnectionForEvent):
  if rule.matchType === "event":  return event.id === rule.matchValue
  if rule.matchType === "source": return event.calendarId === rule.matchValue
  if rule.matchType === "name":   return new RegExp(rule.matchValue, "i").test(event.title)
```

## Persistence Summary

| Store | Key | Change |
|-------|-----|--------|
| `useRuleStore` (NEW) | `webcal:rules` | New store, new key |
| `useConnectionStore` | `webcal:connections` | No schema change; `removeConnection` now also calls `useRuleStore.removeRulesForConnection` |
| `useEventTypeStore` | `proton-cal:event-types` | No change |
| `useEventsStore` | (not persisted) | No change |

---

## Amendment (2026-07-22): Removed fields, catch-all rule, collapsed chain

### `Rule.matchType` gains `"all"`

```
RuleMatchType = "event" | "name" | "source" | "all"
```

`matchValue` is unused (empty string) for `matchType: "all"`. Exactly one such rule exists at all times:

- **Seeded**: lazily on first `useRuleStore` read, the same way `useEventTypeStore` seeds its built-in types — if no `matchType: "all"` rule exists, one is created pointing at whatever type was previously `useUIStore().defaultEventTypeId` (or the first `EventType` if that's also unset).
- **Invariants enforced by the store, not just the UI**: `removeRule` is a no-op for the catch-all's `id`; `toggleRule` is a no-op for it (`enabled` stays `true`); `reorderRule` always re-sorts it to the end regardless of the requested index.
- **Editable**: only its `displayTypeId`, via `updateRule`.

### `CalendarEvent` — fields removed

```diff
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
-  customColor?: string;
-  customIcon?: string;
-  customAllDayStyle?: DisplayStyle;
-  customTimedStyle?: DisplayStyle;
 }
```

`eventTypeId` is no longer consulted by `resolveEventType()` at all (see below) — it becomes ingestion metadata only, kept because providers still set it, but display resolution ignores it in favor of the rule match. It is not removed from the type since providers still populate it and nothing requires deleting an unused-but-harmless field.

### `Connection` — field removed

```diff
 export interface WebCalConnection {
   type: "webcal";
   id: string;
   name: string;
   url: string;
   color: string;
   proxyUrl?: string;
-  displayTypeId?: string;
 }
```

(Same removal on `CalDAVConnection`.) A source-wide style is now expressed only as a `matchType: "source"` rule.

### Resolution chain — collapses to one mandatory level

Per `research.md` Decision 10, the 6-level chain this feature originally introduced collapses to:

```
resolveEventType(event, getType, rules):
  rule = findMatchingRule(event, rules)   // never undefined — catch-all always matches
  return getType(rule.displayTypeId)      // never undefined — catch-all's target can't be deleted (see guard below)
```

`findMatchingRule`'s signature drops the `isBroken` callback parameter as an *input* — it still skips broken rules internally, but now takes `getType` directly to check breakage itself, since there is always a next candidate to fall through to (down to the catch-all) rather than an "or `undefined`" exit:

```ts
export function findMatchingRule(
  event: CalendarEvent,
  rules: Rule[],
  getType: (id: string) => EventType | undefined,
): Rule; // no longer `| undefined`
```

The `getConnection` parameter to `resolveEventType()` is dropped — it was only used for the now-removed `connection.displayTypeId` lookup and color fallback.

### Guard: catch-all target cannot be deleted (FR-021)

`useEventTypeStore.removeType(id)` (or the delete-confirmation UI calling it) must check `useRuleStore.getState().rules.find(r => r.matchType === "all")?.displayTypeId === id` first and block the deletion with a message to reassign the catch-all rule, rather than allowing the type to be deleted and leaving the catch-all "broken" with nothing to fall through to.

### Persistence Summary (amendment)

| Store | Key | Change |
|-------|-----|--------|
| `useRuleStore` | `webcal:rules` | Seeds one `matchType: "all"` rule on first load if none exists |
| `useUIStore` | — | `defaultEventTypeId` field removed — superseded by the catch-all rule's `displayTypeId` |
| `useEventTypeStore` | `proton-cal:event-types` | `removeType` gains the catch-all guard above |
