/**
 * Per-connection fetching: builds each connection's provider and turns its result into a
 * FetchResult (events, or the failure info that drives smart-retry backoff), reporting live
 * status via a callback. Driven per connection by DataProviderContext's syncConnection.
 * Read-only: `DataProvider` has no write path (specs/003-display-type-rules-engine, FR-016).
 */

import { isWithinInterval, parseISO } from "date-fns";
import { HttpError, type DataProvider } from "./data-provider";
import type { CalendarEvent, Connection, ConnectionStatus } from "../types";
import { WebCalProvider } from "./webcal-provider";
import { ServerProvider } from "./server-provider";
import { serverConnection } from "../store/server";
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
function makeProvider(conn: Connection): DataProvider {
  switch (conn.type) {
    case "webcal": {
      const { base, token, linked } = serverConnection();
      if (conn.serverOnly) {
        const unavailable: DataProvider = {
          async getEvents() {
            throw new Error("Cette source n'est lisible que via le serveur : renseigne le jeton dans Données › Serveur.");
          },
        };
        return linked ? new ServerProvider(conn.id, token, unavailable, base) : unavailable;
      }
      const direct = new WebCalProvider(
        [{ id: conn.id, name: conn.name, url: conn.url, color: conn.color }],
        conn.proxyUrl ?? ""
      );
      // Linked to the server (admin token or device session), read the server's aggregated snapshot (falls back to `direct`).
      return linked ? new ServerProvider(conn.id, token, direct, base) : direct;
    }
    case "demo":
      return demoProvider;
  }
}

/**
 * WebCal event ids/calendarIds are already namespaced by WebCalProvider ("${conn.id}::${uid}");
 * the demo provider's seed events get the demo connection's id as their calendarId.
 * Connection color is deliberately not stamped here — resolveEventType() applies it as a
 * low-priority fallback (specs/003-display-type-rules-engine/research.md Decision 2).
 */
function applyConnectionMeta(events: CalendarEvent[], conn: Connection): CalendarEvent[] {
  return conn.type === "demo" ? events.map((e) => ({ ...e, calendarId: conn.id })) : events;
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
    console.warn("[fetchConnectionEvents] Connection failed:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { ok: false, message, retryAfterMs: err instanceof HttpError ? err.retryAfterMs : null };
  }
}
