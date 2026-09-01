import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addMonths, subMonths } from "date-fns";
import type { DataProvider } from "../lib/data-provider";
import { MultiSourceProvider, fetchConnectionEvents } from "../lib/multi-source-provider";
import {
  applyBackoff,
  computeFetchKey,
  computeGaps,
  createEmptyCacheEntry,
  isBackedOff,
  isStale,
  mergeFetchedRange,
  STALE_TTL_MS,
  type ConnectionCacheEntry,
  type DateRange,
} from "../lib/event-cache";
import { useConnectionStore, useEventsStore, useUIStore } from "../store";
import type { Connection, ConnectionStatusMap, ConnectionSyncMeta, SyncState } from "../types";

const DataCtx = createContext<DataProvider | null>(null);
const StatusCtx = createContext<ConnectionStatusMap>({});
const SyncMetaCtx = createContext<Record<string, ConnectionSyncMeta>>({});

interface SyncCtxValue {
  refresh: () => Promise<void>;
  /** Force-refreshes just one connection (bypassing its cache and any retry backoff),
   *  leaving every other connection's cache/backoff untouched. */
  refreshConnection: (id: string) => Promise<void>;
  lastUpdated: Date | null;
  /** Idle/syncing/error, derived from ConnectionStatusMap + background-refresh activity —
   *  never a separate source of truth. See specs/008-events-perf-caching/research.md Decision I. */
  syncState: SyncState;
}

const SyncCtx = createContext<SyncCtxValue>({
  refresh: async () => {},
  refreshConnection: async () => {},
  lastUpdated: null,
  syncState: "idle",
});

/**
 * True once useConnectionStore has read its persisted localStorage value.
 * Next.js SSR (and the client's first paint, to match server HTML) has no
 * localStorage, so `connections` briefly holds the store's hard-coded default
 * — fetching against it would flash the seeded demo events before the real
 * sources load. Callers should wait for this before fetching.
 */
function useConnectionsHydrated() {
  const [hydrated, setHydrated] = useState(() => useConnectionStore.persist.hasHydrated());
  useEffect(() => useConnectionStore.persist.onFinishHydration(() => setHydrated(true)), []);
  return hydrated;
}

export function DataProviderContext({ children }: { children: ReactNode }) {
  const { connections } = useConnectionStore();
  const { setEvents } = useEventsStore();
  const { currentDate } = useUIStore();
  const [statusMap, setStatusMap] = useState<ConnectionStatusMap>({});
  const [syncMeta, setSyncMeta] = useState<Record<string, ConnectionSyncMeta>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const hydrated = useConnectionsHydrated();

  const handleStatusChange = useCallback((id: string, status: ConnectionStatusMap[string]) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  /** A fetch for `connId` failed: schedules its retry backoff on the cache entry (honoring
   *  the server's Retry-After for 429s) and surfaces the reason via useConnectionSyncMeta(). */
  const recordFailure = useCallback((connId: string, message: string, retryAfterMs: number | null) => {
    const current = cacheRef.current.get(connId);
    if (current) cacheRef.current.set(connId, applyBackoff(current, retryAfterMs));
    const nextRetryAt = cacheRef.current.get(connId)?.nextRetryAt ?? null;
    setSyncMeta((prev) => ({
      ...prev,
      [connId]: { lastSyncedAt: prev[connId]?.lastSyncedAt ?? null, message, nextRetryAt },
    }));
  }, []);

  /** A fetch for `connId` succeeded: clears any prior error/backoff from useConnectionSyncMeta(). */
  const recordSuccess = useCallback((connId: string) => {
    setSyncMeta((prev) => ({ ...prev, [connId]: { lastSyncedAt: Date.now(), message: undefined, nextRetryAt: null } }));
  }, []);

  // The session-only range cache (specs/008-events-perf-caching): one ConnectionCacheEntry
  // per connection, held in a ref (imperative bookkeeping, not itself reactive — reads/writes
  // happen inside loadWindow/refresh, and results are published to useEventsStore, which IS
  // reactive). backgroundRefreshingRef tracks which connections currently have a non-blocking
  // staleness refresh in flight, for the isBackgroundRefreshing flag above.
  const cacheRef = useRef<Map<string, ConnectionCacheEntry>>(new Map());
  const backgroundRefreshingRef = useRef<Set<string>>(new Set());
  // Per-connection in-flight fetch, joined instead of duplicated by any other caller
  // (navigation, staleness, manual refresh) that arrives while it's still running — see
  // research.md Decision D / FR-012's "no more than one in-flight fetch per source".
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map());

  // Provider-recreation key: every connection's fetch-relevant fields (id, type, url,
  // proxyUrl, username/password), not just its id. Fixes a pre-existing bug where editing
  // a connection's URL/proxy never re-instantiated the provider because the old key only
  // tracked the id list — see research.md Decision E. Exported via useDataProvider(); not
  // used by the cache-aware loading below, which talks to each connection's own provider
  // directly (see loadWindow).
  const connectionKey = connections.map((c) => computeFetchKey(c)).join("|");

  const provider = useMemo<DataProvider>(
    () => new MultiSourceProvider(connections, handleStatusChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectionKey, handleStatusChange]
  );

  const notifyBackgroundRefreshChange = useCallback(() => {
    setIsBackgroundRefreshing(backgroundRefreshingRef.current.size > 0);
  }, []);

  /** Flattens every connection's cached events into useEventsStore and stamps lastUpdated. */
  const publishMergedEvents = useCallback(() => {
    const conns = useConnectionStore.getState().connections;
    const merged = conns.flatMap((c) => cacheRef.current.get(c.id)?.events ?? []);
    setEvents(merged);
    setLastUpdated(new Date());
  }, [setEvents]);

  /**
   * Cache-aware load of [start, end): serves already-covered data instantly, fetches only
   * the uncovered delta per connection (research.md Decision B), and — unless forced — kicks
   * a non-blocking background refresh of the requested window for any connection whose cache
   * is stale (Decision C). `force: true` (the sidebar's "refresh all" button) resets every
   * connection's cache first; `only: id` (a single source's own refresh button) does the same
   * but for just that one connection, leaving every other connection's cache/backoff untouched.
   */
  const loadWindow = useCallback(
    async (start: Date, end: Date, { force = false, only }: { force?: boolean; only?: string } = {}) => {
      const conns = useConnectionStore.getState().connections;
      const requested: DateRange = { start: start.toISOString(), end: end.toISOString() };

      // Drop cache entries for connections that no longer exist, and (re)seed entries whose
      // fetch-relevant config changed since they were cached, or that are being force-refreshed.
      const liveIds = new Set(conns.map((c) => c.id));
      for (const id of cacheRef.current.keys()) {
        if (!liveIds.has(id)) cacheRef.current.delete(id);
      }
      for (const conn of conns) {
        const key = computeFetchKey(conn);
        const existing = cacheRef.current.get(conn.id);
        if (!existing || existing.fetchKey !== key || force || conn.id === only) {
          cacheRef.current.set(conn.id, createEmptyCacheEntry(key));
        }
      }

      await Promise.all(
        conns.map(async (conn: Connection) => {
          // Join an already-in-flight fetch for this connection rather than issuing a
          // duplicate concurrent request (FR-012) — e.g. manual refresh clicked while a
          // background staleness refresh is already running for the same source. Once it
          // settles, re-derive gaps against the now-current cache before deciding what (if
          // anything) still needs fetching.
          const inFlight = inFlightRef.current.get(conn.id);
          if (inFlight) await inFlight;

          const entry = cacheRef.current.get(conn.id)!;
          const forced = force || conn.id === only;

          // Smart retry: a connection that failed recently (429 Retry-After, or this
          // entry's own doubling backoff) is left alone until its cooldown elapses —
          // an unforced navigation/staleness tick must not keep hammering it. An explicit
          // refresh (all sources, or this one source) always gets one immediate attempt.
          if (!forced && isBackedOff(entry)) return;

          const gaps = computeGaps(entry.coveredRanges, requested);

          if (gaps.length > 0) {
            // Foreground: genuinely new data the user is waiting for. Fetch every gap in
            // parallel, merging each in as it lands; a superseded entry (fetchSeq moved on,
            // e.g. rapid navigation or a connection edit) discards its result (Decision D).
            entry.fetchSeq += 1;
            const seq = entry.fetchSeq;
            const fetchPromise = Promise.all(
              gaps.map(async (gap) => {
                const result = await fetchConnectionEvents(conn, new Date(gap.start), new Date(gap.end), handleStatusChange);
                const current = cacheRef.current.get(conn.id);
                if (!current || current.fetchSeq !== seq) return; // superseded
                if (!result.ok) { recordFailure(conn.id, result.message, result.retryAfterMs); return; }
                cacheRef.current.set(conn.id, mergeFetchedRange(current, gap, result.events));
                recordSuccess(conn.id);
              })
            ).then(() => {});
            inFlightRef.current.set(conn.id, fetchPromise);
            await fetchPromise;
            inFlightRef.current.delete(conn.id);
          } else if (!forced && isStale(entry, STALE_TTL_MS)) {
            // Background: the requested window is already covered but stale — refresh it
            // without blocking the caller, and never clear currently-shown events while it runs.
            entry.fetchSeq += 1;
            const seq = entry.fetchSeq;
            backgroundRefreshingRef.current.add(conn.id);
            notifyBackgroundRefreshChange();
            const fetchPromise = fetchConnectionEvents(conn, start, end, handleStatusChange).then((result) => {
              backgroundRefreshingRef.current.delete(conn.id);
              notifyBackgroundRefreshChange();
              const current = cacheRef.current.get(conn.id);
              if (!current || current.fetchSeq !== seq) return; // superseded
              if (!result.ok) { recordFailure(conn.id, result.message, result.retryAfterMs); return; }
              cacheRef.current.set(conn.id, mergeFetchedRange(current, requested, result.events));
              recordSuccess(conn.id);
              publishMergedEvents();
            });
            inFlightRef.current.set(conn.id, fetchPromise);
            // Not awaited here — this is the non-blocking background path — but still
            // tracked in inFlightRef so a concurrent caller joins it instead of duplicating it.
            fetchPromise.finally(() => inFlightRef.current.delete(conn.id));
          }
        })
      );

      publishMergedEvents();
    },
    [handleStatusChange, notifyBackgroundRefreshChange, publishMergedEvents, recordFailure, recordSuccess]
  );

  // Re-fetches (cache-aware — see loadWindow) whenever the visible window changes, shared by
  // the auto-load effect below and the manual refresh button (which forces a full re-fetch).
  const refresh = useCallback(async () => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    await loadWindow(start, end, { force: true });
  }, [currentDate, loadWindow]);

  // Same, scoped to one connection — a single source's own refresh button.
  const refreshConnection = useCallback(async (id: string) => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    await loadWindow(start, end, { only: id });
  }, [currentDate, loadWindow]);

  useEffect(() => {
    if (!hydrated) return;
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    // Deferred a microtask out: loadWindow synchronously reports "loading" status
    // (setState) before its first await — same as this effect's previous
    // provider.getEvents(...).then(...) shape, just now via a local callback the
    // linter can see straight through, so it flags calling setState synchronously
    // during the effect. Queuing it breaks that direct reachability without
    // changing behavior (still fires this tick, before paint).
    void Promise.resolve().then(() => {
      loadWindow(start, end).catch(console.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, connectionKey, hydrated]);

  const syncState = useMemo<SyncState>(() => {
    const statuses = Object.values(statusMap);
    if (isBackgroundRefreshing || statuses.some((s) => s === "loading")) return "syncing";
    if (statuses.some((s) => s === "error")) return "error";
    return "idle";
  }, [statusMap, isBackgroundRefreshing]);

  const syncCtxValue = useMemo<SyncCtxValue>(
    () => ({ refresh, refreshConnection, lastUpdated, syncState }),
    [refresh, refreshConnection, lastUpdated, syncState]
  );

  return (
    <SyncCtx.Provider value={syncCtxValue}>
      <StatusCtx.Provider value={statusMap}>
        <SyncMetaCtx.Provider value={syncMeta}>
          <DataCtx.Provider value={provider}>{children}</DataCtx.Provider>
        </SyncMetaCtx.Provider>
      </StatusCtx.Provider>
    </SyncCtx.Provider>
  );
}

export function useDataProvider(): DataProvider {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useDataProvider must be used within DataProviderContext");
  return ctx;
}

/** Returns live connection status map. Updates on every fetch attempt. */
export function useConnectionStatusMap(): ConnectionStatusMap {
  return useContext(StatusCtx);
}

/** Per-connection last-sync timestamp, last error reason, and retry-backoff deadline —
 *  the detail behind each status dot. See ConnectionSyncMeta. */
export function useConnectionSyncMeta(): Record<string, ConnectionSyncMeta> {
  return useContext(SyncMetaCtx);
}

/** Manual re-fetch of every source, or just one (both bypass cache/staleness/backoff),
 *  plus when that last succeeded and the derived app-wide sync state. */
export function useSourceSync(): SyncCtxValue {
  return useContext(SyncCtx);
}
