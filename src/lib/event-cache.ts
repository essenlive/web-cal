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
  /** Epoch ms before which this connection should not be retried (set on the last fetch
   *  failure); null while healthy. See applyBackoff()/clearBackoff(). */
  nextRetryAt: number | null;
  /** Backoff duration used for the *next* failure if one occurs, doubling each consecutive
   *  error up to MAX_BACKOFF_MS, reset to BASE_BACKOFF_MS on success. */
  backoffMs: number;
}

/** 5 minutes — see research.md Decision C. */
export const STALE_TTL_MS = 5 * 60 * 1000;
/** Starting/floor backoff after a connection error with no server-given Retry-After. */
export const BASE_BACKOFF_MS = 30 * 1000;
/** Backoff ceiling — a repeatedly-failing connection is retried at most this often. */
export const MAX_BACKOFF_MS = 10 * 60 * 1000;

export function createEmptyCacheEntry(fetchKey: string): ConnectionCacheEntry {
  return {
    coveredRanges: [], events: [], lastFetchedAt: null, fetchSeq: 0, fetchKey,
    nextRetryAt: null, backoffMs: BASE_BACKOFF_MS,
  };
}

/**
 * Records a fetch failure: schedules the next retry using the server's own Retry-After
 * (429/503) when given, otherwise the entry's own doubling backoff. Returns a new entry —
 * does not mutate `entry`.
 */
export function applyBackoff(entry: ConnectionCacheEntry, retryAfterMs: number | null): ConnectionCacheEntry {
  const delay = retryAfterMs ?? entry.backoffMs;
  return {
    ...entry,
    nextRetryAt: Date.now() + delay,
    backoffMs: Math.min(entry.backoffMs * 2, MAX_BACKOFF_MS),
  };
}

export function isBackedOff(entry: ConnectionCacheEntry): boolean {
  return entry.nextRetryAt !== null && Date.now() < entry.nextRetryAt;
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
 *
 * Also drops any retained event whose id reappears in `freshEvents`: a provider's own
 * range filter can be boundary-inclusive where `eventOverlaps` is exclusive (e.g. an
 * event ending exactly at `range.start`), which would otherwise let that event survive
 * in `retained` *and* come back in `freshEvents`, producing a duplicate id.
 */
export function mergeFetchedRange(
  entry: ConnectionCacheEntry,
  range: DateRange,
  freshEvents: CalendarEvent[],
): ConnectionCacheEntry {
  const start = toMs(range.start);
  const end = toMs(range.end);
  const freshIds = new Set(freshEvents.map((e) => e.id));
  const retained = entry.events.filter((e) => !eventOverlaps(e, start, end) && !freshIds.has(e.id));
  return {
    ...entry,
    events: [...retained, ...freshEvents],
    coveredRanges: unionRange(entry.coveredRanges, range),
    lastFetchedAt: Date.now(),
    nextRetryAt: null,
    backoffMs: BASE_BACKOFF_MS,
  };
}

export function isStale(entry: ConnectionCacheEntry, ttlMs: number = STALE_TTL_MS): boolean {
  return entry.lastFetchedAt === null || Date.now() - entry.lastFetchedAt > ttlMs;
}

/**
 * Trims `coveredRanges`/`events` down to `window` — used only when writing a snapshot to
 * disk (see event-cache-persistence.ts), so persisted size stays bounded regardless of how
 * much history a long session has accumulated in the live (unbounded) in-memory cache.
 */
export function clampEntryToWindow(entry: ConnectionCacheEntry, windowRange: DateRange): ConnectionCacheEntry {
  const start = toMs(windowRange.start);
  const end = toMs(windowRange.end);
  const coveredRanges = entry.coveredRanges
    .map((r) => ({ start: Math.max(toMs(r.start), start), end: Math.min(toMs(r.end), end) }))
    .filter((r) => r.start < r.end)
    .map((r) => ({ start: new Date(r.start).toISOString(), end: new Date(r.end).toISOString() }));
  const events = entry.events.filter((e) => eventOverlaps(e, start, end));
  return { ...entry, coveredRanges, events };
}

/** How much of `windowRange` a connection's cache holds, for the sync dialog. Staleness wins
 *  over coverage: a fully-covered but stale entry is still "stale" (it'll be refreshed). */
export type CacheState = "empty" | "partial" | "full" | "stale";

export function cacheState(entry: ConnectionCacheEntry | undefined, windowRange: DateRange, ttlMs: number = STALE_TTL_MS): CacheState {
  if (!entry || entry.coveredRanges.length === 0) return "empty";
  if (isStale(entry, ttlMs)) return "stale";
  return computeGaps(entry.coveredRanges, windowRange).length === 0 ? "full" : "partial";
}
