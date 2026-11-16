import type { SqliteDb } from "../config/db";
import { getConfig, getEndpoints } from "../config/import";
import { getSnapshot } from "../aggregation/snapshot-store";
import type { CalendarEvent, Connection } from "../../types";

/** What the web client needs about one connection, read from the aggregation snapshot. */
export interface ServerConnectionEvents {
  events: CalendarEvent[];
  lastSyncedAt: number | null;
  lastError: string | null;
  /** True when an endpoint is attached, i.e. events can be created through the server. */
  writable: boolean;
}

/**
 * Snapshot events overlapping [start, end) for every known connection (or only `connectionId`),
 * shaped like the client's own providers produce them: id namespaced "<connection>::<uid>",
 * calendarId = connection id. Never triggers a fetch — the scheduler owns refreshing.
 */
export function listServerEvents(
  db: SqliteDb,
  range: { start: Date; end: Date },
  connectionId?: string,
): Record<string, ServerConnectionEvents> {
  const connections = (getConfig(db, "connections") as Connection[]).filter((c) => !connectionId || c.id === connectionId);
  const writableIds = new Set(getEndpoints(db).map((e) => e.connectionId));
  const result: Record<string, ServerConnectionEvents> = {};

  for (const conn of connections) {
    const snapshot = getSnapshot(db, conn.id);
    const events = (snapshot?.events ?? [])
      .filter((e) => new Date(e.end) >= range.start && new Date(e.start) <= range.end)
      .map((e) => ({
        ...e,
        id: e.id.includes("::") ? e.id : `${conn.id}::${e.id}`,
        calendarId: conn.id,
        eventTypeId: e.eventTypeId || "meeting",
      }));
    result[conn.id] = {
      events,
      lastSyncedAt: snapshot?.lastSyncedAt ?? null,
      lastError: snapshot?.lastError ?? null,
      writable: writableIds.has(conn.id),
    };
  }
  return result;
}
