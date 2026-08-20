import { useMemo } from "react";
import { resolveEventType, isEventHidden } from "../components/events/EventChip";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../store";
import type { CalendarEvent, Connection, EventType } from "../types";

export interface ResolvedEvent {
  type: EventType;
  hidden: boolean;
}

/**
 * Resolves every currently-fetched event's effective display type and hidden state
 * exactly once per (events, rules, types, connections) change, instead of each
 * calendar view (MonthView/TimeGridView/AgendaView) independently re-walking the
 * rules engine per event on every render. See
 * specs/008-events-perf-caching/research.md Decision F.
 *
 * Returns the full event list (unfiltered) plus a lookup map of its resolution —
 * callers combine the two (e.g. `events.filter((e) => !resolved.get(e.id)?.hidden)`)
 * rather than this hook silently dropping hidden events, since some callers need to
 * distinguish "hidden" from "doesn't exist" (e.g. the day-cell modal reused for both).
 */
export function useResolvedEvents(): {
  events: CalendarEvent[];
  resolved: Map<string, ResolvedEvent>;
  visibleEvents: CalendarEvent[];
} {
  const { events } = useEventsStore();
  const { getType, types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { connections } = useConnectionStore();

  // `types`/`connections` are listed explicitly because `getType`/`getConnection`
  // are stable function references whose *output* changes without their identity
  // changing — omitting them would leave this memo stale after a hide/show toggle.
  const resolved = useMemo(() => {
    const getConnection = (calendarId: string): Connection | undefined =>
      connections.find((c) => c.id === calendarId);
    const map = new Map<string, ResolvedEvent>();
    for (const event of events) {
      map.set(event.id, {
        type: resolveEventType(event, getType, rules),
        hidden: isEventHidden(event, getType, getConnection, rules),
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, getType, rules, types, connections]);

  const visibleEvents = useMemo(
    () => events.filter((e) => !resolved.get(e.id)?.hidden),
    [events, resolved]
  );

  return { events, resolved, visibleEvents };
}
