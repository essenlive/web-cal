import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { addMonths, subMonths } from "date-fns";
import type { DataProvider } from "../lib/data-provider";
import { MockDataProvider } from "../lib/mock-data-provider";
import { useCalendarStore, useEventsStore, useUIStore } from "../store";

const DataCtx = createContext<DataProvider | null>(null);

export function DataProviderContext({ children }: { children: ReactNode }) {
  const provider = useRef<MockDataProvider>(new MockDataProvider());
  const { setCalendars } = useCalendarStore();
  const { setEvents } = useEventsStore();
  const { currentDate } = useUIStore();

  // Expose provider for mutations via window (quick DX hack)
  useEffect(() => {
    (window as any).__calProvider = provider.current;
  }, []);

  useEffect(() => {
    provider.current.getCalendars().then(setCalendars);
  }, []);

  useEffect(() => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    provider.current.getEvents(start, end).then(setEvents);
  }, [currentDate]);

  return <DataCtx.Provider value={provider.current}>{children}</DataCtx.Provider>;
}

export function useDataProvider(): DataProvider {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useDataProvider must be used within DataProviderContext");
  return ctx;
}
