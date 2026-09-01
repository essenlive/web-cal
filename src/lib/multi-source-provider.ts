/**
 * MultiSourceProvider — composite DataProvider that fans out getEvents() calls
 * to all active connections in parallel, merges the results, and reports live
 * connection status via a callback.
 *
 * Design decisions (see specs/001-cloud-calendar-connector/research.md):
 * - Uses Promise.allSettled so a single failing connection never blocks others.
 * - CalDAV event IDs are namespaced as "${conn.id}::${uid}" to prevent collisions.
 * - WebCal event IDs are already namespaced by WebCalProvider (source.id === conn.id),
 *   so no additional prefixing is applied.
 * - There is no write path — `DataProvider` has no create/update/delete methods;
 *   all connections are read-only (specs/003-display-type-rules-engine amendment, FR-016).
 */

import { isWithinInterval, parseISO } from "date-fns";
import { HttpError, type DataProvider } from "./data-provider";
import type { CalendarEvent, Connection, ConnectionStatus } from "../types";
import { WebCalProvider } from "./webcal-provider";
import { CalDAVProvider } from "./caldav-provider";
import { generateSeedEvents } from "./mock-seed";

/** Local, offline provider backing the seeded "demo" connection — see DemoConnection in types. */
const demoProvider: DataProvider = {
  async getEvents(start, end) {
    return generateSeedEvents().filter((e) => {
      const s = parseISO(e.start);
      return isWithinInterval(s, { start, end }) || (s < end && parseISO(e.end) > start);
    });
  },
};

/** Build a sub-provider from a connection config. */
export function makeProvider(conn: Connection): DataProvider {
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
    case "demo":
      return demoProvider;
  }
}

/**
 * Namespace CalDAV IDs so they can't collide across connections.
 *
 * WebCal IDs are already "${conn.id}::${uid}" (WebCalProvider sets source.id
 * as the prefix), so we leave them as-is.
 * CalDAV IDs are raw UIDs — we prefix them with conn.id.
 *
 * Connection color is no longer stamped here as eventTypeId:"custom" — that
 * unconditionally beat any rule, named type, or connection displayTypeId
 * (see specs/003-display-type-rules-engine/research.md Decision 2).
 * resolveEventType() now applies it as a lower-priority fallback instead.
 */
export function applyConnectionMeta(events: CalendarEvent[], conn: Connection): CalendarEvent[] {
  return events.map((e) => ({
    ...e,
    id: conn.type === "caldav" ? `${conn.id}::${e.id}` : e.id,
    calendarId: conn.type === "demo" ? conn.id : e.calendarId,
  }));
}

/** Outcome of fetchConnectionEvents — a discriminated result instead of `T | null` so a
 *  failure can carry the info (message, 429 Retry-After) that drives smart-retry backoff. */
export type FetchResult =
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; message: string; retryAfterMs: number | null };

/**
 * Fetch one connection's events for [start, end), reporting status via `onStatusChange` —
 * extracted so the events-performance cache (DataProviderContext, see
 * specs/008-events-perf-caching) can drive per-connection gap-fetches without duplicating
 * this status handling. Never rejects — always resolves a FetchResult so callers can
 * `Promise.all` safely.
 *
 * Deliberately does NOT toast on failure itself (unlike an earlier version of this
 * function) — only DataProviderContext knows whether a connection was *already* failing,
 * which it needs to toast only on the transition into/out of "error" rather than on every
 * automatic retry of a still-down source. The toast lives there now; see recordFailure().
 */
export async function fetchConnectionEvents(
  conn: Connection,
  start: Date,
  end: Date,
  onStatusChange: (id: string, status: ConnectionStatus) => void,
): Promise<FetchResult> {
  onStatusChange(conn.id, "loading");
  try {
    const events = await makeProvider(conn).getEvents(start, end);
    onStatusChange(conn.id, "active");
    return { ok: true, events: applyConnectionMeta(events, conn) };
  } catch (err) {
    onStatusChange(conn.id, "error");
    console.warn("[MultiSourceProvider] Connection failed:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { ok: false, message, retryAfterMs: err instanceof HttpError ? err.retryAfterMs : null };
  }
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
    const results = await Promise.all(
      this.connections.map((conn) => fetchConnectionEvents(conn, start, end, this.onStatusChange))
    );
    return results.flatMap((r) => (r.ok ? r.events : []));
  }
}
