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
import { toast } from "sonner";
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
import { readPersistedCache, writePersistedCache } from "../lib/event-cache-persistence";
import { useConnectionStore, useEventsStore, useUIStore } from "../store";
import type { Connection, ConnectionStatus, ConnectionStatusMap, ConnectionSyncMeta, SyncState } from "../types";

/** The window persisted to disk on every write — centered on real "now", not `currentDate`
 *  (which isn't persisted in useUIStore, so a reload always starts centered on today
 *  regardless of where the user last navigated). One month wider on each side than the
 *  default fetch window so a little post-reload navigation still hits cache. */
function computePersistWindow(): DateRange {
  const now = new Date();
  return { start: subMonths(now, 2).toISOString(), end: addMonths(now, 3).toISOString() };
}

type SyncConnectionFn = (
  conn: Connection,
  requested: DateRange,
  forced: boolean,
  onStatusChangeOverride?: (id: string, status: ConnectionStatus) => void
) => Promise<void>;

const DataCtx = createContext<DataProvider | null>(null);
const StatusCtx = createContext<ConnectionStatusMap>({});
const SyncMetaCtx = createContext<Record<string, ConnectionSyncMeta>>({});
/** Read-only escape hatch onto the session cache (see cacheRef below), for the /debug page only. */
const CacheCtx = createContext<() => Map<string, ConnectionCacheEntry>>(() => new Map());

interface SyncCtxValue {
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  /** Idle/syncing/error, derived from ConnectionStatusMap + background-refresh activity —
   *  never a separate source of truth. See specs/008-events-perf-caching/research.md Decision I. */
  syncState: SyncState;
}

const SyncCtx = createContext<SyncCtxValue>({
  refresh: async () => {},
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

  const handleStatusChange = useCallback((id: string, status: ConnectionStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  // Used for timer-triggered automatic retries: reports "active"/"error" as normal, but
  // swallows the transient "loading" transition — a persistently-down connection retried
  // silently every backoff interval shouldn't flicker its dot error→loading→error forever
  // while nobody's watching. Foreground/manual-refresh calls keep the normal callback, since
  // the user IS actively waiting on those.
  const silentStatusChange = useCallback((id: string, status: ConnectionStatus) => {
    if (status !== "loading") handleStatusChange(id, status);
  }, [handleStatusChange]);

  // The session-only range cache (specs/008-events-perf-caching): one ConnectionCacheEntry
  // per connection, held in a ref (imperative bookkeeping, not itself reactive — reads/writes
  // happen inside loadWindow/publishMergedEvents, and results are published to useEventsStore,
  // which IS reactive). Seeded from localStorage (see the hydration effect below) so a warm
  // reload starts from last session's data instead of empty. backgroundRefreshingRef tracks
  // which connections currently have a non-blocking staleness refresh in flight, for the
  // isBackgroundRefreshing flag above.
  const cacheRef = useRef<Map<string, ConnectionCacheEntry>>(new Map());
  const backgroundRefreshingRef = useRef<Set<string>>(new Set());
  // Per-connection in-flight fetch, joined instead of duplicated by any other caller
  // (navigation, staleness, manual refresh) that arrives while it's still running — see
  // research.md Decision D / FR-012's "no more than one in-flight fetch per source".
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  // Per-connection automatic-retry timer, scheduled whenever a fetch fails and cleared on
  // success/removal/unmount — see scheduleRetryTimer/clearRetryTimer below.
  const retryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Connections currently in "error" — gates the toast in recordFailure/recordSuccess so it
  // fires only on the transition into/out of error, not on every repeated automatic retry of
  // an already-known-down connection.
  const erroredConnectionsRef = useRef<Set<string>>(new Set());
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current reference to syncConnection (defined further down), so the retry-timer
  // callback — a long-lived setTimeout that outlives any particular render — can call the
  // latest version without needing to be recreated itself. Same indirection ui/action-button.tsx
  // uses for its own revert timer.
  const syncConnectionRef = useRef<SyncConnectionFn | undefined>(undefined);

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

  const clearRetryTimer = useCallback((connId: string) => {
    const timer = retryTimersRef.current.get(connId);
    if (timer) {
      clearTimeout(timer);
      retryTimersRef.current.delete(connId);
    }
  }, []);

  /** Schedules connId's next automatic retry attempt. Fires by re-deriving the CURRENT
   *  visible window at that moment (never a closure over whenever this was scheduled from)
   *  and re-invoking syncConnection unforced — isBackedOff() will naturally be false by then,
   *  so the existing gap/staleness logic just decides what's actually needed. */
  const scheduleRetryTimer = useCallback((connId: string, delayMs: number) => {
    clearRetryTimer(connId);
    const timer = setTimeout(() => {
      retryTimersRef.current.delete(connId);
      const conn = useConnectionStore.getState().connections.find((c) => c.id === connId);
      if (!conn || !syncConnectionRef.current) return;
      const now = useUIStore.getState().currentDate;
      const requested: DateRange = { start: subMonths(now, 1).toISOString(), end: addMonths(now, 2).toISOString() };
      void syncConnectionRef.current(conn, requested, false, silentStatusChange);
    }, Math.max(0, delayMs));
    retryTimersRef.current.set(connId, timer);
  }, [clearRetryTimer, silentStatusChange]);

  /** A fetch for `connId` failed: schedules its retry backoff on the cache entry (honoring
   *  the server's Retry-After for 429s), surfaces the reason via useConnectionSyncMeta(), and
   *  toasts only if this connection wasn't already known to be failing. Returns the scheduled
   *  nextRetryAt so the caller can arm the automatic-retry timer. */
  const recordFailure = useCallback((connId: string, connName: string, message: string, retryAfterMs: number | null): number | null => {
    const current = cacheRef.current.get(connId);
    if (current) cacheRef.current.set(connId, applyBackoff(current, retryAfterMs));
    const nextRetryAt = cacheRef.current.get(connId)?.nextRetryAt ?? null;
    setSyncMeta((prev) => ({
      ...prev,
      [connId]: { lastSyncedAt: prev[connId]?.lastSyncedAt ?? null, message, nextRetryAt },
    }));
    if (!erroredConnectionsRef.current.has(connId)) {
      erroredConnectionsRef.current.add(connId);
      toast.error(`Échec de connexion à « ${connName} ».`, { description: message });
    }
    return nextRetryAt;
  }, []);

  /** A fetch for `connId` succeeded: clears any prior error/backoff from useConnectionSyncMeta(),
   *  and toasts a recovery message only if this connection was previously known to be failing. */
  const recordSuccess = useCallback((connId: string, connName: string) => {
    setSyncMeta((prev) => ({ ...prev, [connId]: { lastSyncedAt: Date.now(), message: undefined, nextRetryAt: null } }));
    if (erroredConnectionsRef.current.has(connId)) {
      erroredConnectionsRef.current.delete(connId);
      toast.success(`Connexion à « ${connName} » rétablie.`);
    }
  }, []);

  /** Debounced write-through to localStorage — collapses a burst of per-connection publishes
   *  (see publishMergedEvents) into one disk write shortly after the last one settles. */
  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      writePersistedCache(cacheRef.current, computePersistWindow());
    }, 500);
  }, []);

  /** Flattens every connection's cached events into useEventsStore, stamps lastUpdated, and
   *  schedules a debounced persist. Called once per connection as its own fetch resolves (see
   *  syncConnection) — never gated on every OTHER connection also finishing. */
  const publishMergedEvents = useCallback(() => {
    const conns = useConnectionStore.getState().connections;
    const merged = conns.flatMap((c) => cacheRef.current.get(c.id)?.events ?? []);
    setEvents(merged);
    setLastUpdated(new Date());
    schedulePersist();
  }, [setEvents, schedulePersist]);

  /**
   * Syncs one connection against `requested`: joins an in-flight fetch, respects retry
   * backoff (unless `forced`), fetches only the uncovered gap or does a background staleness
   * refresh, and — regardless of which — publishes and (de)schedules that connection's own
   * retry timer the moment ITS OWN fetch resolves, independent of every other connection.
   * This is the unit both `loadWindow` (navigation/manual refresh) and the automatic retry
   * timer (see scheduleRetryTimer) call — "manage endpoints individually" in one place.
   */
  const syncConnection = useCallback(
    async (
      conn: Connection,
      requested: DateRange,
      forced: boolean,
      onStatusChangeOverride: (id: string, status: ConnectionStatus) => void = handleStatusChange,
    ) => {
      // Join an already-in-flight fetch for this connection rather than issuing a
      // duplicate concurrent request (FR-012) — e.g. manual refresh clicked while a
      // background staleness refresh is already running for the same source. Once it
      // settles, re-derive gaps against the now-current cache before deciding what (if
      // anything) still needs fetching.
      const inFlight = inFlightRef.current.get(conn.id);
      if (inFlight) await inFlight;

      const entry = cacheRef.current.get(conn.id)!;

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
            const result = await fetchConnectionEvents(conn, new Date(gap.start), new Date(gap.end), onStatusChangeOverride);
            const current = cacheRef.current.get(conn.id);
            if (!current || current.fetchSeq !== seq) return; // superseded
            if (!result.ok) {
              const nextRetryAt = recordFailure(conn.id, conn.name, result.message, result.retryAfterMs);
              if (nextRetryAt !== null) scheduleRetryTimer(conn.id, nextRetryAt - Date.now());
              return;
            }
            cacheRef.current.set(conn.id, mergeFetchedRange(current, gap, result.events));
            recordSuccess(conn.id, conn.name);
            clearRetryTimer(conn.id);
          })
        ).then(() => {});
        inFlightRef.current.set(conn.id, fetchPromise);
        await fetchPromise;
        inFlightRef.current.delete(conn.id);
        // Publish this connection's result the moment it's ready — never wait on every
        // other connection's own fetch (the blocking bug this rework fixes: previously
        // only loadWindow's single post-Promise.all call published anything).
        publishMergedEvents();
      } else if (!forced && isStale(entry, STALE_TTL_MS)) {
        // Background: the requested window is already covered but stale — refresh it
        // without blocking the caller, and never clear currently-shown events while it runs.
        entry.fetchSeq += 1;
        const seq = entry.fetchSeq;
        backgroundRefreshingRef.current.add(conn.id);
        notifyBackgroundRefreshChange();
        const fetchPromise = fetchConnectionEvents(
          conn,
          new Date(requested.start),
          new Date(requested.end),
          onStatusChangeOverride
        ).then((result) => {
          backgroundRefreshingRef.current.delete(conn.id);
          notifyBackgroundRefreshChange();
          const current = cacheRef.current.get(conn.id);
          if (!current || current.fetchSeq !== seq) return; // superseded
          if (!result.ok) {
            const nextRetryAt = recordFailure(conn.id, conn.name, result.message, result.retryAfterMs);
            if (nextRetryAt !== null) scheduleRetryTimer(conn.id, nextRetryAt - Date.now());
            return;
          }
          cacheRef.current.set(conn.id, mergeFetchedRange(current, requested, result.events));
          recordSuccess(conn.id, conn.name);
          clearRetryTimer(conn.id);
          publishMergedEvents();
        });
        inFlightRef.current.set(conn.id, fetchPromise);
        // Not awaited here — this is the non-blocking background path — but still
        // tracked in inFlightRef so a concurrent caller joins it instead of duplicating it.
        fetchPromise.finally(() => inFlightRef.current.delete(conn.id));
      }
    },
    [handleStatusChange, notifyBackgroundRefreshChange, publishMergedEvents, recordFailure, recordSuccess, scheduleRetryTimer, clearRetryTimer]
  );

  useEffect(() => {
    syncConnectionRef.current = syncConnection;
  }, [syncConnection]);

  /**
   * Cache-aware load of [start, end): serves already-covered data instantly, fetches only
   * the uncovered delta per connection (research.md Decision B), and — unless forced — kicks
   * a non-blocking background refresh of the requested window for any connection whose cache
   * is stale (Decision C). `force: true` (the sidebar's "refresh all" button) resets every
   * connection's cache first. Each connection is synced via syncConnection independently —
   * see there for how/when it publishes and schedules its own retry.
   */
  const loadWindow = useCallback(
    async (start: Date, end: Date, { force = false }: { force?: boolean } = {}) => {
      const conns = useConnectionStore.getState().connections;
      const requested: DateRange = { start: start.toISOString(), end: end.toISOString() };

      // Drop cache entries for connections that no longer exist, and (re)seed entries whose
      // fetch-relevant config changed since they were cached, or that are being force-refreshed.
      const liveIds = new Set(conns.map((c) => c.id));
      for (const id of cacheRef.current.keys()) {
        if (!liveIds.has(id)) {
          cacheRef.current.delete(id);
          clearRetryTimer(id);
          erroredConnectionsRef.current.delete(id);
        }
      }
      for (const conn of conns) {
        const key = computeFetchKey(conn);
        const existing = cacheRef.current.get(conn.id);
        if (!existing || existing.fetchKey !== key || force) {
          cacheRef.current.set(conn.id, createEmptyCacheEntry(key));
        }
      }

      await Promise.all(
        conns.map((conn) => syncConnection(conn, requested, force))
      );

      // Safety net for the zero-connections case — with no connections, no syncConnection
      // call above ever runs, so nothing else would ever flip hasLoadedOnce.
      publishMergedEvents();
    },
    [syncConnection, publishMergedEvents, clearRetryTimer]
  );

  // Re-fetches (cache-aware — see loadWindow) whenever the visible window changes, shared by
  // the auto-load effect below and the manual refresh button (which forces a full re-fetch).
  const refresh = useCallback(async () => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    await loadWindow(start, end, { force: true });
  }, [currentDate, loadWindow]);

  // Boot-time hydration from disk, once: seeds cacheRef from the last session's persisted
  // snapshot (see event-cache-persistence.ts) before the first loadWindow call runs below —
  // that first call then sees "covered but stale" entries and takes the existing background
  // branch (publish immediately, refetch quietly), rather than any new code path. Also
  // re-arms any retry timer a connection was mid-backoff for when the tab was closed — without
  // this, a connection reloaded mid-backoff would hit the isBackedOff guard in syncConnection
  // and just sit "errored" until the user happens to navigate again, since it never reaches
  // the failure branch that would otherwise schedule the timer.
  useEffect(() => {
    const persisted = readPersistedCache();
    if (!persisted) return;
    cacheRef.current = persisted;
    for (const [connId, entry] of persisted) {
      if (entry.nextRetryAt !== null && entry.nextRetryAt > Date.now()) {
        scheduleRetryTimer(connId, entry.nextRetryAt - Date.now());
      }
    }
    // Mount-only — scheduleRetryTimer's identity is stable (empty-dep clearRetryTimer +
    // stable silentStatusChange/handleStatusChange), so omitting it here doesn't miss updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Immediate, non-debounced flush on tab close/hide, so the freshest write isn't lost inside
  // schedulePersist's 500ms debounce window. Not correctness-critical if missed — the next
  // reload just falls back to a slightly-staler snapshot, which self-heals via the same
  // staleness-refresh path as any other stale cache entry.
  useEffect(() => {
    const flush = () => writePersistedCache(cacheRef.current, computePersistWindow());
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  useEffect(() => {
    const timers = retryTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

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
    () => ({ refresh, lastUpdated, syncState }),
    [refresh, lastUpdated, syncState]
  );

  // Stable across renders — cacheRef's own identity never changes, only its .current contents.
  const getCache = useCallback(() => cacheRef.current, []);

  return (
    <SyncCtx.Provider value={syncCtxValue}>
      <StatusCtx.Provider value={statusMap}>
        <SyncMetaCtx.Provider value={syncMeta}>
          <CacheCtx.Provider value={getCache}>
            <DataCtx.Provider value={provider}>{children}</DataCtx.Provider>
          </CacheCtx.Provider>
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

/** Manual re-fetch of every source (bypasses cache/staleness/backoff), plus when that last
 *  succeeded and the derived app-wide sync state. */
export function useSourceSync(): SyncCtxValue {
  return useContext(SyncCtx);
}

/** Getter for the live per-connection range cache (coveredRanges, backoffMs, fetchSeq…) —
 *  for the /debug page only. Re-invoke inside a memo keyed on useConnectionSyncMeta()/
 *  useSourceSync().lastUpdated to stay in sync, since the getter itself isn't reactive. */
export function useDebugCache(): () => Map<string, ConnectionCacheEntry> {
  return useContext(CacheCtx);
}
