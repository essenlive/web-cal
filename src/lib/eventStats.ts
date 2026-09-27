import { differenceInMinutes, startOfWeek } from "date-fns";
import type { CalendarEvent } from "../types";

/** One bucket of the sparkline: total minutes for events starting in that week. */
export interface WeekBucket {
  /** ISO date (yyyy-MM-dd) of the Monday starting this week — see startOfWeek(..., { weekStartsOn: 1 }). */
  weekStart: string;
  totalMinutes: number;
}

export interface RangeStats {
  /** Summed duration of timed (non all-day) events in the range, in minutes. All-day events have no meaningful duration and are excluded from this total. */
  totalMinutes: number;
  /** Distinct calendar days (by event start, "YYYY-MM-DD") touched by at least one event — timed or all-day. */
  activeDays: number;
  eventCount: number;
  /** One entry per calendar week touched by the range, oldest first — feeds the per-group sparkline. */
  weeks: WeekBucket[];
}

export function emptyStats(): RangeStats {
  return { totalMinutes: 0, activeDays: 0, eventCount: 0, weeks: [] };
}

/** True if `event` overlaps [from, to] — same overlap test as EventSearch's date filter, so "in range" means the same thing across the app. */
export function overlapsRange(event: CalendarEvent, from: Date, to: Date): boolean {
  return new Date(event.end) >= from && new Date(event.start) <= to;
}

/** Aggregates a pre-filtered event list (already scoped to one group and one date range) into RangeStats. */
export function aggregateRangeStats(events: CalendarEvent[]): RangeStats {
  const days = new Set<string>();
  const weekMinutes = new Map<string, number>();
  let totalMinutes = 0;
  for (const e of events) {
    days.add(e.start.slice(0, 10));
    const weekStart = startOfWeek(new Date(e.start), { weekStartsOn: 1 }).toISOString().slice(0, 10);
    if (!e.allDay) {
      const minutes = Math.max(0, differenceInMinutes(new Date(e.end), new Date(e.start)));
      totalMinutes += minutes;
      weekMinutes.set(weekStart, (weekMinutes.get(weekStart) ?? 0) + minutes);
    } else if (!weekMinutes.has(weekStart)) {
      weekMinutes.set(weekStart, 0);
    }
  }
  const weeks = [...weekMinutes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, totalMinutes]) => ({ weekStart, totalMinutes }));
  return { totalMinutes, activeDays: days.size, eventCount: events.length, weeks };
}

/** "3h", "3,5h" — a compact hour label; drops the decimal above 10h to stay short in a pill. */
export function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (hours === 0) return "0h";
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${(Math.round(hours * 10) / 10)}`.replace(".", ",") + "h";
}
