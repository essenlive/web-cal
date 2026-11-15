/**
 * Recurring aggregation cycle: reads each connection's events through its connector
 * and writes one SourceSnapshot per connection. A failing source never blocks the
 * others and keeps its last-known-good events (spec FR-010).
 */

import type { SqliteDb } from "../config/db";
import { getConfig } from "../config/import";
import { connectorFor } from "../connectors";
import type { Connector, TimeRange } from "../connectors/types";
import { recordFailure, recordSuccess } from "./snapshot-store";
import type { CalendarEvent, Connection } from "../../types";

export interface CycleDeps {
  connectorFor?: (db: SqliteDb, conn: Connection) => Connector | null;
  now?: () => number;
}

const DAY = 86_400_000;

export function defaultRange(now = Date.now()): TimeRange {
  return { start: new Date(now - 30 * DAY), end: new Date(now + 365 * DAY) };
}

export async function refreshConnection(db: SqliteDb, conn: Connection, deps: CycleDeps = {}): Promise<void> {
  const now = deps.now ?? Date.now;
  try {
    const connector = (deps.connectorFor ?? connectorFor)(db, conn);
    if (!connector) return;
    const raw = await connector.getEvents(defaultRange(now()));
    const events: CalendarEvent[] = raw.map((e) => ({ ...e, calendarId: conn.id, eventTypeId: "" }));
    recordSuccess(db, conn.id, events, now());
  } catch (err) {
    recordFailure(db, conn.id, err instanceof Error ? err.message : String(err));
  }
}

export async function runAggregationCycle(db: SqliteDb, deps: CycleDeps = {}): Promise<void> {
  for (const conn of getConfig(db, "connections") as Connection[]) {
    await refreshConnection(db, conn, deps);
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
