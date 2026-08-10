"use client";

import dynamic from "next/dynamic";
import { DataProviderContext } from "../context/DataProviderContext";

/**
 * Every persisted Zustand store (connections, event types, rules, themes,
 * presets, week-start preference…) falls back to its code default on the
 * server (no localStorage there) and to whatever's actually saved on the
 * client — which almost never match for a returning user. Rendering
 * CalendarPage only on the client sidesteps that mismatch entirely instead of
 * threading a "mounted" guard through every component that reads one of
 * these stores.
 */
const CalendarPage = dynamic(() => import("../views/CalendarPage").then((m) => m.CalendarPage), { ssr: false });

export default function Page() {
  return (
    <DataProviderContext>
      <CalendarPage />
    </DataProviderContext>
  );
}
