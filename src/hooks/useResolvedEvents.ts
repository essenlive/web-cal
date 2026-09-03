import { useMemo } from "react";
import { resolveEventType, isEventHidden } from "../components/events/EventChip";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore, useUIStore } from "../store";
import { SYSTEM_TIMEZONE, toZonedDate } from "../lib/timezone";
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
  const { events: rawEvents } = useEventsStore();
  const { getType, types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { connections } = useConnectionStore();
  const { timezone } = useUIStore();

  // Shift timed events' start/end into the selected display timezone once, here,
  // so every view (MonthView/TimeGridView/AgendaView/EventDetail) can keep reading
  // wall-clock fields off `Date` with its ordinary local getters/date-fns `format`.
  // All-day events are date-only (no time-of-day) and are left untouched.
  const events = useMemo(() => {
    if (timezone === SYSTEM_TIMEZONE) return rawEvents;
    return rawEvents.map((e) =>
      e.allDay
        ? e
        : {
            ...e,
            start: toZonedDate(new Date(e.start), timezone).toISOString(),
            end: toZonedDate(new Date(e.end), timezone).toISOString(),
          }
    );
  }, [rawEvents, timezone]);

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
