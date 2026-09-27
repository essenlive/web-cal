import { useMemo } from "react";
import { useRuleStore } from "../store";
import { useResolvedEvents } from "./useResolvedEvents";
import { findMatchingRule } from "../lib/rules";
import { aggregateRangeStats, overlapsRange, type BucketGranularity, type RangeStats } from "../lib/eventStats";
import type { CalendarEvent } from "../types";

export interface EventStatsByGroup {
  /** Keyed by Connection.id (== CalendarEvent.calendarId). */
  bySource: Map<string, RangeStats>;
  /** Keyed by EventType.id (the event's *resolved* type, post-rules). */
  byType: Map<string, RangeStats>;
  /** Keyed by Rule.id (the rule that matched, per findMatchingRule's priority order). */
  byRule: Map<string, RangeStats>;
}

function pushInto<K>(map: Map<K, CalendarEvent[]>, key: K, event: CalendarEvent) {
  const bucket = map.get(key);
  if (bucket) bucket.push(event);
  else map.set(key, [event]);
}

/**
 * Aggregates every fetched event overlapping [from, to] into per-source/per-type/per-rule
 * stats, for the StatsPage — deliberately every event, including ones whose type is
 * currently quick-hidden from the calendar views. Stats answer "how was this time
 * actually spent", which shouldn't change just because someone toggled a type's
 * visibility; the legend's own show/hide filter is the page's only per-item filter.
 * Callers are responsible for calling useSourceSync().loadRange(from, to) so the range is
 * actually cached before reading this (see StatsPage).
 */
export function useEventStatsByGroup(from: Date, to: Date, granularity: BucketGranularity): EventStatsByGroup {
  const { events, resolved } = useResolvedEvents();
  const { rules } = useRuleStore();

  return useMemo(() => {
    const bySourceEvents = new Map<string, CalendarEvent[]>();
    const byTypeEvents = new Map<string, CalendarEvent[]>();
    const byRuleEvents = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      if (!overlapsRange(event, from, to)) continue;
      pushInto(bySourceEvents, event.calendarId, event);
      const typeId = resolved.get(event.id)?.type.id;
      if (typeId) pushInto(byTypeEvents, typeId, event);
      pushInto(byRuleEvents, findMatchingRule(event, rules).id, event);
    }

    const toStats = (m: Map<string, CalendarEvent[]>) =>
      new Map([...m].map(([k, v]) => [k, aggregateRangeStats(v, granularity, from, to)] as const));

    return { bySource: toStats(bySourceEvents), byType: toStats(byTypeEvents), byRule: toStats(byRuleEvents) };
  }, [events, resolved, rules, from, to, granularity]);
}
