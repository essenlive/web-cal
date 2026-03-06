import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { addMonths, subMonths } from "date-fns";
import type { DataProvider } from "../lib/data-provider";
import { MockDataProvider } from "../lib/mock-data-provider";
import { WebCalProvider } from "../lib/webcal-provider";
import { CalDAVProvider } from "../lib/caldav-provider";
import { useEventsStore, useUIStore, useBackendStore } from "../store";

const DataCtx = createContext<DataProvider | null>(null);

export function DataProviderContext({ children }: { children: ReactNode }) {
  const { config } = useBackendStore();
  const { setEvents } = useEventsStore();
  const { currentDate } = useUIStore();

  const provider = useMemo<DataProvider>(() => {
    switch (config.type) {
      case "webcal":
        return new WebCalProvider(config.webcalSources, config.caldavProxyUrl);
      case "caldav":
        if (config.caldavUrl && config.caldavUsername) {
          return new CalDAVProvider(
            config.caldavUrl,
            config.caldavUsername,
            config.caldavPassword,
            config.caldavProxyUrl
          );
        }
        return new MockDataProvider();
      default:
        return new MockDataProvider();
    }
  }, [
    config.type,
    config.webcalSources,
    config.caldavUrl,
    config.caldavUsername,
    config.caldavPassword,
    config.caldavProxyUrl,
  ]);

  useEffect(() => {
    const start = subMonths(currentDate, 1);
    const end = addMonths(currentDate, 2);
    provider.getEvents(start, end).then(setEvents).catch(console.error);
  }, [provider, currentDate]);

  return <DataCtx.Provider value={provider}>{children}</DataCtx.Provider>;
}

export function useDataProvider(): DataProvider {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useDataProvider must be used within DataProviderContext");
  return ctx;
}
