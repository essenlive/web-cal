/**
 * WebCalProvider — read-only DataProvider that subscribes to one or more
 * iCalendar (.ics) URLs (webcal:// or https://).
 *
 * CORS note: many servers do not set CORS headers. If fetching fails due to
 * CORS, configure a proxy prefix in settings (e.g. https://corsproxy.io/?).
 */

import { toast } from "sonner";
import { HttpError, parseRetryAfterMs, type DataProvider } from "./data-provider";
import type { CalendarEvent } from "../types";
import { parseICS } from "./ics-parse";

// ── Provider ──────────────────────────────────────────────────────────────────

export interface WebCalSource {
  id: string;
  name: string;
  url: string;
  color: string;
}

export class WebCalProvider implements DataProvider {
  private sources: WebCalSource[];
  private proxyPrefix: string;

  constructor(sources: WebCalSource[], proxyPrefix = "") {
    this.sources = sources;
    this.proxyPrefix = proxyPrefix;
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const all: CalendarEvent[] = [];

    await Promise.all(
      this.sources.map(async (source) => {
        const url = source.url.replace(/^webcal:\/\//i, "https://");
        // No external proxy configured — default to the app's own same-origin
        // proxy, since most .ics hosts don't send CORS headers.
        const fetchUrl = this.proxyPrefix
          ? `${this.proxyPrefix}${encodeURIComponent(url)}`
          : `/api/proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(fetchUrl);
        // Left uncaught — propagates to fetchConnectionEvents, which reports "error"
        // status (driving the sidebar dot + retry backoff) and toasts once, instead
        // of swallowing it here and reporting a connection that just failed as "active".
        if (!res.ok) throw new HttpError(res.status, parseRetryAfterMs(res.headers.get("retry-after")));
        const text = await res.text();
        const parsed = parseICS(text, start, end);
        if (parsed === null) {
          toast.error(`Flux illisible pour « ${source.name} ».`, {
            description: "Le fichier .ics ne semble pas valide.",
          });
          return;
        }

        for (const e of parsed) {
          const eventStart = new Date(e.start);
          const eventEnd = new Date(e.end);
          // Filter to requested range
          if (eventEnd < start || eventStart > end) continue;
          all.push({
            id: `${source.id}::${e.uid}`,
            title: e.title,
            calendarId: source.id,
            eventTypeId: "meeting", // ingestion metadata only — display is resolved via the rules engine
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            location: e.location,
            notes: e.notes,
          });
        }
      })
    );

    return all;
  }
}
