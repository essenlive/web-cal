/**
 * MultiSourceProvider — composite DataProvider that fans out getEvents() calls
 * to all active connections in parallel, merges the results, and reports live
 * connection status via a callback.
 *
 * Design decisions (see specs/001-cloud-calendar-connector/research.md):
 * - Uses Promise.allSettled so a single failing connection never blocks others.
 * - Sets customColor + eventTypeId:"custom" on every returned event so the
 *   existing EventChip renderer colour-codes events by source connection.
 * - CalDAV event IDs are namespaced as "${conn.id}::${uid}" to prevent collisions.
 * - WebCal event IDs are already namespaced by WebCalProvider (source.id === conn.id),
 *   so no additional prefixing is applied.
 * - Write operations throw immediately — all connections are read-only in v1.
 */

import type { DataProvider } from "./data-provider";
import type { CalendarEvent, Connection, ConnectionStatus } from "../types";
import { WebCalProvider } from "./webcal-provider";
import { CalDAVProvider } from "./caldav-provider";

/** Build a sub-provider from a connection config. */
function makeProvider(conn: Connection): DataProvider {
  switch (conn.type) {
    case "webcal":
      return new WebCalProvider(
        [{ id: conn.id, name: conn.name, url: conn.url, color: conn.color }],
        conn.proxyUrl ?? ""
      );
    case "caldav":
      return new CalDAVProvider(
        conn.url,
        conn.username,
        conn.password,
        conn.proxyUrl ?? ""
      );
  }
}

/**
 * Apply connection colour to every event and namespace CalDAV IDs.
 *
 * WebCal IDs are already "${conn.id}::${uid}" (WebCalProvider sets source.id
 * as the prefix), so we leave them as-is.
 * CalDAV IDs are raw UIDs — we prefix them with conn.id.
 */
function applyConnectionMeta(events: CalendarEvent[], conn: Connection): CalendarEvent[] {
  return events.map((e) => ({
    ...e,
    id: conn.type === "caldav" ? `${conn.id}::${e.id}` : e.id,
    eventTypeId: "custom",
    customColor: conn.color,
  }));
}

export class MultiSourceProvider implements DataProvider {
  private connections: Connection[];
  private onStatusChange: (id: string, status: ConnectionStatus) => void;

  constructor(
    connections: Connection[],
    onStatusChange: (id: string, status: ConnectionStatus) => void
  ) {
    this.connections = connections;
    this.onStatusChange = onStatusChange;
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    if (this.connections.length === 0) return [];

    // Signal loading for all connections upfront.
    for (const conn of this.connections) {
      this.onStatusChange(conn.id, "loading");
    }

    const results = await Promise.allSettled(
      this.connections.map((conn) =>
        makeProvider(conn)
          .getEvents(start, end)
          .then((events) => ({ conn, events }))
      )
    );

    const merged: CalendarEvent[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { conn, events } = result.value;
        this.onStatusChange(conn.id, "active");
        merged.push(...applyConnectionMeta(events, conn));
      } else {
        // Find which connection failed by matching the rejection order.
        // Promise.allSettled preserves input order.
        const idx = results.indexOf(result);
        const conn = this.connections[idx];
        if (conn) this.onStatusChange(conn.id, "error");
        console.warn("[MultiSourceProvider] Connection failed:", result.reason);
      }
    }

    return merged;
  }

  // Read-only in v1 — write operations are not supported.

  async createEvent(): Promise<CalendarEvent> {
    throw new Error("read-only: write operations not supported in v1");
  }

  async updateEvent(): Promise<CalendarEvent> {
    throw new Error("read-only: write operations not supported in v1");
  }

  async deleteEvent(): Promise<void> {
    throw new Error("read-only: write operations not supported in v1");
  }
}
