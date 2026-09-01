/**
 * Snapshot-to-localStorage layer around the in-memory event cache (event-cache.ts):
 * lets a fresh page load seed its cache from the last session's data instead of
 * starting from zero, so the first paint after a reload can be optimistic — the
 * existing stale-while-revalidate path in DataProviderContext then does the rest
 * (publish the seeded data immediately, quietly refetch in the background).
 *
 * Deliberately NOT a Zustand `persist()` store: the live cache stays a plain
 * imperative `Map` (DataProviderContext's `cacheRef`) updated on every fetch —
 * wrapping that in reactive store state would mean either a `setState` per fetch
 * or an equivalent manual-flush wrapper, so a hand-rolled read/write here is the
 * smaller, more direct piece of code either way.
 */

import { clampEntryToWindow, type ConnectionCacheEntry, type DateRange } from "./event-cache";

const STORAGE_KEY = "webcal:event-cache";
/** Insurance against a pathological feed (heavy recurrence expansion) eating the
 *  localStorage quota shared with the app's other six persisted stores. */
const MAX_BYTES = 4 * 1024 * 1024;

export function readPersistedCache(): Map<string, ConnectionCacheEntry> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, ConnectionCacheEntry>;
    return new Map(Object.entries(parsed));
  } catch {
    return null;
  }
}

/** Clamps every entry to `windowRange` before serializing, so persisted size stays
 *  bounded regardless of how much a long session accumulated in the live cache. */
export function writePersistedCache(cache: Map<string, ConnectionCacheEntry>, windowRange: DateRange): void {
  if (typeof window === "undefined") return;
  try {
    const clamped: Record<string, ConnectionCacheEntry> = {};
    for (const [id, entry] of cache) clamped[id] = clampEntryToWindow(entry, windowRange);
    const json = JSON.stringify(clamped);
    if (json.length > MAX_BYTES) return;
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Quota exceeded, serialization failure, or storage unavailable — non-fatal,
    // the next successful write (or a fresh fetch) supersedes it either way.
  }
}
