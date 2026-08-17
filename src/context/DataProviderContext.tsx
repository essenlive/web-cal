import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { addMonths, subMonths } from "date-fns";
import type { DataProvider } from "../lib/data-provider";
import { MultiSourceProvider } from "../lib/multi-source-provider";
import { useConnectionStore, useEventsStore, useUIStore } from "../store";
import type { ConnectionStatusMap } from "../types";

const DataCtx = createContext<DataProvider | null>(null);
const StatusCtx = createContext<ConnectionStatusMap>({});
const SyncCtx = createContext<{ refresh: () => Promise<void>; lastUpdated: Date | null }>({
  refresh: async () => {},
  lastUpdated: null,
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hydrated = useConnectionsHydrated();

  const handleStatusChange = useCallback((id: string, status: ConnectionStatusMap[string]) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  // Re-instantiate when the connections list changes. JSON.stringify used as a
  // stable memo key so adding/removing/editing a connection triggers a new provider.
  const connectionKey = JSON.stringify(connections.map((c) => c.id));

  // MultiSourceProvider already resolves to [] for an empty connections list —
  // a fresh install seeds a deletable "demo" connection (see useConnectionStore),
  // so an empty list here means the user deliberately removed every source.
  const provider = useMemo<DataProvider>(
    () => new MultiSourceProvider(connections, handleStatusChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectionKey, handleStatusChange]
  );

  // Re-fetches from every source (no caching layer in front of getEvents, so
  // this always hits the network) — shared by the auto-refetch effect below
  // and by the manual refresh button.
  const refresh = useCallback(async () => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    const events = await provider.getEvents(start, end);
    setEvents(events);
    setLastUpdated(new Date());
  }, [provider, currentDate, setEvents]);

  useEffect(() => {
    if (!hydrated) return;
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    provider
      .getEvents(start, end)
      .then((events) => {
        setEvents(events);
        setLastUpdated(new Date());
      })
      .catch(console.error);
  }, [provider, currentDate, setEvents, hydrated]);

  return (
    <SyncCtx.Provider value={{ refresh, lastUpdated }}>
      <StatusCtx.Provider value={statusMap}>
        <DataCtx.Provider value={provider}>{children}</DataCtx.Provider>
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

/** Manual re-fetch of every source, plus when that last succeeded. */
export function useSourceSync(): { refresh: () => Promise<void>; lastUpdated: Date | null } {
  return useContext(SyncCtx);
}
