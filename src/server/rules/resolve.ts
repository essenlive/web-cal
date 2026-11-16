/**
 * Store-free port of EventChip's resolveEventType/isEventHidden — same semantics,
 * but the default EventType is passed in explicitly instead of being read off
 * useEventTypeStore (a browser-only, localStorage-persisted Zustand store), so
 * this module runs identically in the server aggregation process and in the
 * client. See research.md Decision A.
 */

import { findMatchingRule } from "../../lib/rules";
import type { CalendarEvent, Connection, EventType, Rule } from "../../types";

/**
 * Returns the effective EventType for an event by resolving the rules engine only —
 * the first enabled rule matching this event, in priority order. The catch-all rule
 * always resolves to the default type; any other rule whose target type has since
 * been deleted (a "broken" rule) also falls back to the default type.
 */
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  rules: Rule[],
  defaultType: EventType,
): EventType {
  const matched = findMatchingRule(event, rules);
  if (matched.matchType === "all") return defaultType;
  return getType(matched.displayTypeId) ?? defaultType;
}

/**
 * True if `event` must be excluded from every calendar view because its source
 * connection is hidden, or because its resolved effective display type is hidden.
 */
export function isEventHidden(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection: (calendarId: string) => Connection | undefined,
  rules: Rule[],
  defaultType: EventType,
): boolean {
  if (getConnection(event.calendarId)?.hidden) return true;
  const type = resolveEventType(event, getType, rules, defaultType);
  return !!type?.hidden;
}
