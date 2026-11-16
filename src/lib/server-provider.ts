/**
 * ServerProvider — reads a connection's events from the Overcal server's aggregation
 * snapshot (GET /api/events) instead of fetching the source itself, falling back to the
 * direct provider whenever the server can't answer for this connection (no server on this
 * origin, server mode off, connection unknown to it, or never synced yet).
 */

import { HttpError, parseRetryAfterMs, type DataProvider } from "./data-provider";
import type { CalendarEvent } from "../types";
import { serverHeaders } from "./server-api";

interface ServerEventsResponse {
  connections?: Record<string, { events: CalendarEvent[]; lastSyncedAt: number | null } | undefined>;
}

export class ServerProvider implements DataProvider {
  constructor(
    private connectionId: string,
    private token: string,
    private fallback: DataProvider,
  ) {}

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString(), connectionId: this.connectionId });
    let res: Response;
    try {
      res = await fetch(`/api/events?${params}`, { headers: serverHeaders(this.token) });
    } catch {
      return this.fallback.getEvents(start, end);
    }

    // No server on this origin (static host, Netlify) or server mode off: behave as before.
    if (res.status === 404 || res.status === 503) return this.fallback.getEvents(start, end);
    if (!res.ok) throw new HttpError(res.status, parseRetryAfterMs(res.headers.get("retry-after")));

    const entry = ((await res.json()) as ServerEventsResponse).connections?.[this.connectionId];
    if (!entry || entry.lastSyncedAt === null) return this.fallback.getEvents(start, end);
    return entry.events;
  }
}
