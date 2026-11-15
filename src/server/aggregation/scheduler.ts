/**
 * Recurring aggregation cycle: fetches each webcal connection's events through
 * keeper.sh and writes one SourceSnapshot per connection. A failing source never
 * blocks the others and keeps its last-known-good events (spec FR-010).
 * Convention: a connection is matched to the keeper.sh calendar with the same name
 * (falling back to the same id).
 */

import type { SqliteDb } from "../config/db";
import { getConfig } from "../config/import";
import { getEvents, getKeeperConfig, listCalendars, type KeeperConfig, type KeeperEvent } from "./keeper-client";
import { recordFailure, recordSuccess } from "./snapshot-store";
import type { CalendarEvent, Connection } from "../../types";

export interface CycleDeps {
  keeper?: KeeperConfig | null;
  fetchEvents?: (config: KeeperConfig, calendarId: string) => Promise<KeeperEvent[]>;
  calendars?: Array<{ id: string; name: string }>;
  now?: () => number;
}

export async function runAggregationCycle(db: SqliteDb, deps: CycleDeps = {}): Promise<void> {
  const keeper = deps.keeper === undefined ? getKeeperConfig() : deps.keeper;
  if (!keeper) return;
  const fetchEvents = deps.fetchEvents ?? getEvents;
  const now = deps.now ?? Date.now;

  const connections = getConfig(db, "connections") as Connection[];
  let calendars = deps.calendars;
  if (!calendars) {
    try {
      calendars = await listCalendars(keeper);
    } catch (err) {
      for (const conn of connections) {
        if (conn.type === "webcal") recordFailure(db, conn.id, err instanceof Error ? err.message : String(err));
      }
      return;
    }
  }
  for (const conn of connections) {
    if (conn.type !== "webcal") continue;
    try {
      const calendar = calendars.find((c) => c.name === conn.name) ?? calendars.find((c) => c.id === conn.id);
      if (!calendar) throw new Error(`No keeper.sh calendar named "${conn.name}"`);
      const raw = await fetchEvents(keeper, calendar.id);
      const events: CalendarEvent[] = raw.map((e) => ({
        id: e.id,
        title: e.title,
        calendarId: conn.id,
        eventTypeId: "",
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        location: e.location,
        notes: e.notes,
      }));
      recordSuccess(db, conn.id, events, now());
    } catch (err) {
      recordFailure(db, conn.id, err instanceof Error ? err.message : String(err));
    }
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startScheduler(db: SqliteDb, intervalMs = Number(process.env.AGGREGATION_INTERVAL_MS) || 5 * 60_000): void {
  if (timer) return;
  const tick = () => void runAggregationCycle(db).catch((e) => console.error("aggregation cycle failed", e));
  tick();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
}
