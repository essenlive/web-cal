import { useMemo } from "react";
import { useRuleStore } from "../store";
import { useResolvedEvents } from "./useResolvedEvents";
import { findMatchingRule } from "../lib/rules";
import { aggregateStats, withinStatsWindow, type GroupStats } from "../lib/eventStats";
import type { CalendarEvent, Rule } from "../types";

export interface EventStatsByGroup {
  /** Keyed by Connection.id (== CalendarEvent.calendarId). */
  bySource: Map<string, GroupStats>;
  /** Keyed by EventType.id (the event's *resolved* type, post-rules). */
  byType: Map<string, GroupStats>;
  /** Keyed by Rule.id (the rule that matched, per findMatchingRule's priority order). */
  byRule: Map<string, GroupStats>;
}

function pushInto<K>(map: Map<K, CalendarEvent[]>, key: K, event: CalendarEvent) {
  const bucket = map.get(key);
  if (bucket) bucket.push(event);
  else map.set(key, [event]);
}

/** Plain helper (not inlined in the memo below) so the Date.now() read doesn't run during
 *  render — same pattern as EventSearch.tsx's sortByRelevance/Sidebar.tsx's connectionStatusDetail. */
function groupEventsByStatsBucket(
  events: CalendarEvent[],
  resolved: Map<string, { type: { id: string } }>,
  rules: Rule[]
) {
  const now = Date.now();
  const bySourceEvents = new Map<string, CalendarEvent[]>();
  const byTypeEvents = new Map<string, CalendarEvent[]>();
  const byRuleEvents = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    if (!withinStatsWindow(event, now)) continue;
    pushInto(bySourceEvents, event.calendarId, event);
    const typeId = resolved.get(event.id)?.type.id;
    if (typeId) pushInto(byTypeEvents, typeId, event);
    pushInto(byRuleEvents, findMatchingRule(event, rules).id, event);
  }

  return { bySourceEvents, byTypeEvents, byRuleEvents };
}

/**
 * Aggregates currently-visible events into per-source/per-type/per-rule stats over
 * the fixed STATS_WINDOW_DAYS window, for the compact StatTag shown in each
 * drawer row (ConnectionsPanel/EventTypesPanel/RulesPanel). Hidden event types are
 * excluded, same as the calendar views — a hidden type's events shouldn't inflate
 * its source's or its rule's numbers either.
 */
export function useEventStatsByGroup(): EventStatsByGroup {
  const { visibleEvents, resolved } = useResolvedEvents();
  const { rules } = useRuleStore();

  return useMemo(() => {
    const { bySourceEvents, byTypeEvents, byRuleEvents } = groupEventsByStatsBucket(visibleEvents, resolved, rules);
    const toStats = (m: Map<string, CalendarEvent[]>) => new Map([...m].map(([k, v]) => [k, aggregateStats(v)] as const));
    return { bySource: toStats(bySourceEvents), byType: toStats(byTypeEvents), byRule: toStats(byRuleEvents) };
  }, [visibleEvents, resolved, rules]);
}
