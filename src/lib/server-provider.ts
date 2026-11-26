/**
 * ServerProvider — reads a connection's events from the Overcal server's aggregation
 * snapshot (GET /api/events) instead of fetching the source itself, falling back to the
 * direct provider whenever the server can't answer for this connection (no server on this
 * origin, server mode off, connection unknown to it, or never synced yet).
 */

import { HttpError, type DataProvider } from "./data-provider";
import { BackendError, ServerBackend } from "./backend";
import type { CalendarEvent } from "../types";

export class ServerProvider implements DataProvider {
  private backend: ServerBackend;

  constructor(
    private connectionId: string,
    token: string,
    private fallback: DataProvider,
  ) {
    this.backend = new ServerBackend(token);
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    let entries;
    try {
      entries = await this.backend.events(start, end, this.connectionId);
    } catch (err) {
      // No server on this origin (static host, Netlify) or server mode off: behave as before.
      if (!(err instanceof BackendError)) return this.fallback.getEvents(start, end);
      if (err.status === 404 || err.status === 503) return this.fallback.getEvents(start, end);
      throw new HttpError(err.status, err.retryAfterMs);
    }
    const entry = entries[this.connectionId];
    if (!entry || entry.lastSyncedAt === null) return this.fallback.getEvents(start, end);
    return entry.events;
  }
}
