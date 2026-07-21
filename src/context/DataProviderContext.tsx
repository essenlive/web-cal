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
import { MockDataProvider } from "../lib/mock-data-provider";
import { MultiSourceProvider } from "../lib/multi-source-provider";
import { useConnectionStore, useEventsStore, useUIStore } from "../store";
import type { ConnectionStatusMap } from "../types";

const DataCtx = createContext<DataProvider | null>(null);
const StatusCtx = createContext<ConnectionStatusMap>({});

export function DataProviderContext({ children }: { children: ReactNode }) {
  const { connections } = useConnectionStore();
  const { setEvents } = useEventsStore();
  const { currentDate } = useUIStore();
  const [statusMap, setStatusMap] = useState<ConnectionStatusMap>({});

  const handleStatusChange = useCallback((id: string, status: ConnectionStatusMap[string]) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  // Re-instantiate when the connections list changes. JSON.stringify used as a
  // stable memo key so adding/removing/editing a connection triggers a new provider.
  const connectionKey = JSON.stringify(connections.map((c) => c.id));

  const provider = useMemo<DataProvider>(() => {
    if (connections.length === 0) return new MockDataProvider();
    return new MultiSourceProvider(connections, handleStatusChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionKey, handleStatusChange]);

  useEffect(() => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    provider.getEvents(start, end).then(setEvents).catch(console.error);
  }, [provider, currentDate, setEvents]);

  return (
    <StatusCtx.Provider value={statusMap}>
      <DataCtx.Provider value={provider}>{children}</DataCtx.Provider>
    </StatusCtx.Provider>
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

// ── No-op provider for the dev preview page ───────────────────────────────────

const devProvider: DataProvider = {
  getEvents:    async ()  => [],
  createEvent:  async (e) => ({ ...e, id: crypto.randomUUID() }),
  updateEvent:  async (e) => e,
  deleteEvent:  async ()  => {},
};

export function DevDataProviderContext({ children }: { children: ReactNode }) {
  return (
    <StatusCtx.Provider value={{}}>
      <DataCtx.Provider value={devProvider}>{children}</DataCtx.Provider>
    </StatusCtx.Provider>
  );
}
