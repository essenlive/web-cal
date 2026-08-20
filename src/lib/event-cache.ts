/**
 * Pure, session-only range cache for fetched events — one ConnectionCacheEntry
 * per connection. No React/store imports: DataProviderContext owns the actual
 * cache instance (a plain Map held in a ref) and drives these functions.
 *
 * See specs/008-events-perf-caching/research.md (Decisions A–E) and
 * data-model.md for the design this implements.
 */

import type { CalendarEvent, Connection } from "../types";

export interface DateRange {
  start: string; // ISO
  end: string;   // ISO
}

export interface ConnectionCacheEntry {
  /** Sorted, non-overlapping ISO intervals already fetched for this connection. */
  coveredRanges: DateRange[];
  /** This connection's own fetched events (already namespaced), across all coveredRanges. */
  events: CalendarEvent[];
  /** Epoch ms of the most recent successful fetch for this connection. Drives staleness. */
  lastFetchedAt: number | null;
  /** Bumped every time a fetch is issued for this connection; a resolved fetch is only
   *  applied if its captured value still matches the live one (supersede-on-mismatch). */
  fetchSeq: number;
  /** Hash of this connection's fetch-relevant fields (research.md Decision E). A live
   *  connection whose current computeFetchKey() no longer matches this means its config
   *  changed — the entry must be discarded and rebuilt from empty. */
  fetchKey: string;
}

/** 5 minutes — see research.md Decision C. */
export const STALE_TTL_MS = 5 * 60 * 1000;

export function createEmptyCacheEntry(fetchKey: string): ConnectionCacheEntry {
  return { coveredRanges: [], events: [], lastFetchedAt: null, fetchSeq: 0, fetchKey };
}

/**
 * Hash of every field that affects what a connection actually fetches. Used to detect
 * an edit (URL, proxy, credentials) that must invalidate the connection's cache and
 * re-instantiate its provider — see research.md Decision E for the bug this fixes.
 */
export function computeFetchKey(conn: Connection): string {
  switch (conn.type) {
    case "webcal":
      return `webcal:${conn.id}:${conn.url}:${conn.proxyUrl ?? ""}`;
    case "caldav":
      return `caldav:${conn.id}:${conn.url}:${conn.username}:${conn.password}:${conn.proxyUrl ?? ""}`;
    case "demo":
      return `demo:${conn.id}`;
  }
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * The sub-intervals of `requested` not already covered by `covered` — the delta that
 * actually needs fetching (research.md Decision B). Returns [] when `requested` is
 * fully covered.
 */
export function computeGaps(covered: DateRange[], requested: DateRange): DateRange[] {
  const reqStart = toMs(requested.start);
  const reqEnd = toMs(requested.end);
  if (reqStart >= reqEnd) return [];

  const relevant = covered
    .map((r) => ({ start: Math.max(toMs(r.start), reqStart), end: Math.min(toMs(r.end), reqEnd) }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const r of relevant) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }

  const gaps: DateRange[] = [];
  let cursor = reqStart;
  for (const r of merged) {
    if (r.start > cursor) gaps.push({ start: new Date(cursor).toISOString(), end: new Date(r.start).toISOString() });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < reqEnd) gaps.push({ start: new Date(cursor).toISOString(), end: new Date(reqEnd).toISOString() });
  return gaps;
}

function unionRange(coveredRanges: DateRange[], range: DateRange): DateRange[] {
  const all = [...coveredRanges, range]
    .map((r) => ({ start: toMs(r.start), end: toMs(r.end) }))
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged.map((r) => ({ start: new Date(r.start).toISOString(), end: new Date(r.end).toISOString() }));
}

/** True if `event`'s own window overlaps [start, end). */
function eventOverlaps(e: CalendarEvent, start: number, end: number): boolean {
  return toMs(e.start) < end && toMs(e.end) > start;
}

/**
 * Merge freshly-fetched events for `range` into `entry`: drop any cached events
 * overlapping `range` (they're about to be replaced, never duplicated), append the
 * fresh ones, union `range` into coveredRanges, and stamp `lastFetchedAt` (research.md
 * Decision B step 4). Returns a new entry — does not mutate `entry`.
 */
export function mergeFetchedRange(
  entry: ConnectionCacheEntry,
  range: DateRange,
  freshEvents: CalendarEvent[],
): ConnectionCacheEntry {
  const start = toMs(range.start);
  const end = toMs(range.end);
  const retained = entry.events.filter((e) => !eventOverlaps(e, start, end));
  return {
    ...entry,
    events: [...retained, ...freshEvents],
    coveredRanges: unionRange(entry.coveredRanges, range),
    lastFetchedAt: Date.now(),
  };
}

export function isStale(entry: ConnectionCacheEntry, ttlMs: number = STALE_TTL_MS): boolean {
  return entry.lastFetchedAt === null || Date.now() - entry.lastFetchedAt > ttlMs;
}
