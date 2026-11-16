"use client";

import dynamic from "next/dynamic";
import { DataProviderContext } from "../context/DataProviderContext";
import { CalendarSkeleton } from "../components/calendar/CalendarSkeleton";
import { SessionSync } from "../components/data/SessionSync";

/**
 * Every persisted Zustand store (connections, event types, rules, themes,
 * presets, week-start preference…) falls back to its code default on the
 * server (no localStorage there) and to whatever's actually saved on the
 * client — which almost never match for a returning user. Rendering
 * CalendarPage only on the client sidesteps that mismatch entirely instead of
 * threading a "mounted" guard through every component that reads one of
 * these stores.
 *
 * `loading` renders the same (store-free, purely presentational) skeleton
 * CalendarGrid already shows during the first data fetch, so the page has
 * *something* on screen as soon as this small entry chunk has run, instead of
 * a blank screen for the whole time CalendarPage's own (much larger) chunk is
 * still downloading.
 */
const CalendarPage = dynamic(() => import("../views/CalendarPage").then((m) => m.CalendarPage), {
  ssr: false,
  loading: () => <CalendarSkeleton />,
});

export default function Page() {
  return (
    <DataProviderContext>
      <SessionSync />
      <CalendarPage />
    </DataProviderContext>
  );
}
