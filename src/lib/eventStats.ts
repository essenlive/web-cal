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
  /** All-day events touching this bucket. All-day events have no meaningful duration, so they're
   *  tracked separately from totalMinutes and shown on their own axis ("nb événements journée"). */
  allDayCount: number;
}

export interface RangeStats {
  /** Summed duration of timed (non all-day) events, clipped to the queried range, in minutes. */
  totalMinutes: number;
  /** Distinct calendar days (timed or all-day) touched within the queried range. */
  activeDays: number;
  /** Timed events don't have a "count" that means much on its own (their hours already say
   *  how busy they were) — kept separate from allDayEventCount because the two aren't the
   *  same unit: one is "how many hours", the other is "how many all-day events". */
  timedEventCount: number;
  allDayEventCount: number;
  /** One entry per bucket touched by the range, oldest first, at the granularity aggregateRangeStats was called with. */
  buckets: Bucket[];
}

export function emptyStats(): RangeStats {
  return { totalMinutes: 0, activeDays: 0, timedEventCount: 0, allDayEventCount: 0, buckets: [] };
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

/**
 * Aggregates a pre-filtered event list (already scoped to one group, via overlapsRange over
 * [from, to]) into RangeStats at the given granularity.
 *
 * Every duration and day/bucket touched is clipped to [from, to] first — an event that starts
 * before `from` or ends after `to` only contributes the portion that actually falls inside the
 * queried period. A timed event that spans a bucket boundary (e.g. an overnight 23:00–01:00
 * event, or any event at week/month/year granularity) has its duration split proportionally
 * across every bucket it touches, so a bucket's minutes and totalMinutes always add up exactly —
 * a stacked chart's bars will always sum to the table's "Total" column.
 */
export function aggregateRangeStats(events: CalendarEvent[], granularity: BucketGranularity, from: Date, to: Date): RangeStats {
  const days = new Set<string>();
  const bucketMinutes = new Map<string, number>();
  const bucketAllDay = new Map<string, number>();
  let totalMinutes = 0;
  let timedEventCount = 0;
  let allDayEventCount = 0;

  for (const e of events) {
    const eventStart = new Date(e.start);
    const eventEnd = new Date(e.end);
    const clippedStart = eventStart < from ? from : eventStart;
    const clippedEnd = eventEnd > to ? to : eventEnd;
    if (clippedEnd <= clippedStart) continue;

    // Every calendar day the event actually touches within the period, half-open at the end
    // (an all-day event's `end` is the day *after* its last day, per iCalendar convention).
    for (let d = startOfDay(clippedStart); d < clippedEnd; d = addDays(d, 1)) {
      days.add(d.toISOString().slice(0, 10));
    }

    if (e.allDay) {
      allDayEventCount += 1;
      let cursor = bucketStart(clippedStart, granularity);
      const last = bucketStart(new Date(clippedEnd.getTime() - 1), granularity);
      while (cursor <= last) {
        const key = bucketKey(cursor, granularity);
        bucketAllDay.set(key, (bucketAllDay.get(key) ?? 0) + 1);
        cursor = bucketStep(cursor, granularity);
      }
      continue;
    }

    timedEventCount += 1;
    let cursor = clippedStart;
    while (cursor < clippedEnd) {
      const bStart = bucketStart(cursor, granularity);
      const bEnd = bucketStep(bStart, granularity);
      const sliceEnd = bEnd < clippedEnd ? bEnd : clippedEnd;
      const minutes = Math.max(0, differenceInMinutes(sliceEnd, cursor));
      const key = bucketKey(cursor, granularity);
      bucketMinutes.set(key, (bucketMinutes.get(key) ?? 0) + minutes);
      totalMinutes += minutes;
      cursor = sliceEnd;
    }
  }

  const keys = new Set([...bucketMinutes.keys(), ...bucketAllDay.keys()]);
  const buckets = [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      totalMinutes: bucketMinutes.get(key) ?? 0,
      allDayCount: bucketAllDay.get(key) ?? 0,
    }));

  return { totalMinutes, activeDays: days.size, timedEventCount, allDayEventCount, buckets };
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
  const byKey = new Map(buckets.map((b) => [b.key, b] as const));
  return allKeys.map((key) => byKey.get(key) ?? { key, totalMinutes: 0, allDayCount: 0 });
}

/** "3h", "3,5h" — a compact hour label; drops the decimal above 10h to stay short in a pill. */
export function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (hours === 0) return "0h";
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${(Math.round(hours * 10) / 10)}`.replace(".", ",") + "h";
}
