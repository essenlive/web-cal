/**
 * WebCalProvider — read-only DataProvider that subscribes to one or more
 * iCalendar (.ics) URLs (webcal:// or https://).
 *
 * CORS note: many servers do not set CORS headers. If fetching fails due to
 * CORS, configure a proxy prefix in settings (e.g. https://corsproxy.io/?).
 */

import ICAL from "ical.js";
import { toast } from "sonner";
import { HttpError, parseRetryAfterMs, type DataProvider } from "./data-provider";
import type { CalendarEvent } from "../types";
import type { WebCalSource } from "../store";

// ── ICS parsing (via ical.js — RFC 5545 line folding, TZID, and escaping) ──────

interface ParsedEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
}

/** All-day values stay a plain "YYYY-MM-DD" (parsed as UTC midnight elsewhere); timed values become full ISO instants. */
function icsTimeToISO(time: InstanceType<typeof ICAL.Time>): string {
  if (time.isDate) {
    const y = String(time.year).padStart(4, "0");
    const m = String(time.month).padStart(2, "0");
    const d = String(time.day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return time.toJSDate().toISOString();
}

/** Returns `null` (distinct from a legitimately empty calendar) when the feed itself can't be parsed. */
function parseICS(text: string): ParsedEvent[] | null {
  let root: InstanceType<typeof ICAL.Component>;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch (err) {
    console.warn("[WebCalProvider] Failed to parse ICS feed:", err);
    return null;
  }

  const events: ParsedEvent[] = [];
  for (const vevent of root.getAllSubcomponents("vevent")) {
    try {
      const event = new ICAL.Event(vevent);
      if (!event.uid || !event.startDate) continue;
      const start = icsTimeToISO(event.startDate);
      events.push({
        uid: event.uid,
        title: event.summary || "(no title)",
        start,
        end: event.endDate ? icsTimeToISO(event.endDate) : start,
        allDay: event.startDate.isDate,
        location: event.location || undefined,
        notes: event.description || undefined,
      });
    } catch (err) {
      console.warn("[WebCalProvider] Skipping malformed VEVENT:", err);
    }
  }
  return events;
}

// ── Provider ──────────────────────────────────────────────────────────────────

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
        const parsed = parseICS(text);
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
