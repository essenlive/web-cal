import {
  differenceInMinutes, startOfDay, startOfWeek, startOfMonth, startOfYear,
  addDays, addWeeks, addMonths, addYears, format, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent } from "../types";

export type BucketGranularity = "day" | "week" | "month" | "year";

export const GRANULARITIES: { id: BucketGranularity; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "year", label: "Année" },
];

/** One time bucket at a given granularity — e.g. one day, one Monday-start week, one month, one year. */
export interface Bucket {
  /** Bucket start, normalized per granularity: "yyyy-MM-dd" (day/week, week is its Monday), "yyyy-MM" (month), "yyyy" (year). */
  key: string;
  totalMinutes: number;
}

export interface RangeStats {
  /** Summed duration of timed (non all-day) events in the range, in minutes. All-day events have no meaningful duration and are excluded from this total. */
  totalMinutes: number;
  /** Distinct calendar days (by event start, "YYYY-MM-DD") touched by at least one event — timed or all-day. */
  activeDays: number;
  eventCount: number;
  /** One entry per bucket touched by the range, oldest first, at the granularity aggregateRangeStats was called with. */
  buckets: Bucket[];
}

export function emptyStats(): RangeStats {
  return { totalMinutes: 0, activeDays: 0, eventCount: 0, buckets: [] };
}

/** True if `event` overlaps [from, to] — same overlap test as EventSearch's date filter, so "in range" means the same thing across the app. */
export function overlapsRange(event: CalendarEvent, from: Date, to: Date): boolean {
  return new Date(event.end) >= from && new Date(event.start) <= to;
}

function bucketStart(date: Date, granularity: BucketGranularity): Date {
  switch (granularity) {
    case "day": return startOfDay(date);
    case "week": return startOfWeek(date, { weekStartsOn: 1 });
    case "month": return startOfMonth(date);
    case "year": return startOfYear(date);
  }
}

function bucketStep(date: Date, granularity: BucketGranularity): Date {
  switch (granularity) {
    case "day": return addDays(date, 1);
    case "week": return addWeeks(date, 1);
    case "month": return addMonths(date, 1);
    case "year": return addYears(date, 1);
  }
}

function bucketKey(date: Date, granularity: BucketGranularity): string {
  const start = bucketStart(date, granularity);
  return granularity === "year" ? format(start, "yyyy") : granularity === "month" ? format(start, "yyyy-MM") : start.toISOString().slice(0, 10);
}

/** Short display label for a bucket key, e.g. "14 sept.", "sept. 2026", "2026". */
export function bucketLabel(key: string, granularity: BucketGranularity): string {
  if (granularity === "year") return key;
  if (granularity === "month") return format(parseISO(`${key}-01`), "MMM yyyy", { locale: fr });
  return format(parseISO(key), "d MMM", { locale: fr });
}

/** Aggregates a pre-filtered event list (already scoped to one group and one date range) into RangeStats at the given granularity. */
export function aggregateRangeStats(events: CalendarEvent[], granularity: BucketGranularity): RangeStats {
  const days = new Set<string>();
  const bucketMinutes = new Map<string, number>();
  let totalMinutes = 0;
  for (const e of events) {
    days.add(e.start.slice(0, 10));
    const key = bucketKey(new Date(e.start), granularity);
    if (!e.allDay) {
      const minutes = Math.max(0, differenceInMinutes(new Date(e.end), new Date(e.start)));
      totalMinutes += minutes;
      bucketMinutes.set(key, (bucketMinutes.get(key) ?? 0) + minutes);
    } else if (!bucketMinutes.has(key)) {
      bucketMinutes.set(key, 0);
    }
  }
  const buckets = [...bucketMinutes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totalMinutes]) => ({ key, totalMinutes }));
  return { totalMinutes, activeDays: days.size, eventCount: events.length, buckets };
}

/** Every bucket at `granularity` touching [from, to], oldest first — used to fill in zero-hour buckets so a chart shows the whole period rather than skipping quiet ones. */
export function enumerateBuckets(from: Date, to: Date, granularity: BucketGranularity): string[] {
  const keys: string[] = [];
  let cursor = bucketStart(from, granularity);
  const last = bucketStart(to, granularity);
  while (cursor <= last) {
    keys.push(bucketKey(cursor, granularity));
    cursor = bucketStep(cursor, granularity);
  }
  return keys;
}

/** Merges a group's non-zero buckets (from aggregateRangeStats) onto the full list of buckets in the period, so every bucket gets a bar, zero where there was no activity. */
export function fillBuckets(buckets: Bucket[], allKeys: string[]): Bucket[] {
  const byKey = new Map(buckets.map((b) => [b.key, b.totalMinutes]));
  return allKeys.map((key) => ({ key, totalMinutes: byKey.get(key) ?? 0 }));
}

/** "3h", "3,5h" — a compact hour label; drops the decimal above 10h to stay short in a pill. */
export function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (hours === 0) return "0h";
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${(Math.round(hours * 10) / 10)}`.replace(".", ",") + "h";
}
