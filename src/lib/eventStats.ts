import { differenceInMinutes } from "date-fns";
import type { CalendarEvent } from "../types";

/**
 * Rolling window (in days, ending now) used for the compact per-item stats shown
 * in the sources/types/règles drawers — see StatTag. Fixed rather than user-picked:
 * these are a quick "how busy is this lately" glance, not a report; a full
 * date-range-picker analysis view can be added separately later if needed.
 */
export const STATS_WINDOW_DAYS = 28;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface GroupStats {
  /** Summed duration of timed (non all-day) events in the window, in minutes. All-day events have no meaningful duration and are excluded from this total. */
  totalMinutes: number;
  /** Distinct calendar days (by event start, "YYYY-MM-DD") touched by at least one event — timed or all-day. */
  activeDays: number;
  eventCount: number;
}

export function emptyStats(): GroupStats {
  return { totalMinutes: 0, activeDays: 0, eventCount: 0 };
}

/** True if `event` starts within the last `windowDays` days (up to `now`). */
export function withinStatsWindow(event: CalendarEvent, now: number, windowDays = STATS_WINDOW_DAYS): boolean {
  const start = new Date(event.start).getTime();
  return start > now - windowDays * MS_PER_DAY && start <= now;
}

/** Aggregates a pre-filtered event list (already scoped to one group and one time window) into GroupStats. */
export function aggregateStats(events: CalendarEvent[]): GroupStats {
  const days = new Set<string>();
  let totalMinutes = 0;
  for (const e of events) {
    days.add(e.start.slice(0, 10));
    if (!e.allDay) totalMinutes += Math.max(0, differenceInMinutes(new Date(e.end), new Date(e.start)));
  }
  return { totalMinutes, activeDays: days.size, eventCount: events.length };
}

/** "3h", "3,5h" — a compact hour label; drops the decimal above 10h to stay short in a pill. */
export function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (hours === 0) return "0h";
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${(Math.round(hours * 10) / 10)}`.replace(".", ",") + "h";
}
