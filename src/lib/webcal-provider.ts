/**
 * WebCalProvider — read-only DataProvider that subscribes to one or more
 * iCalendar (.ics) URLs (webcal:// or https://).
 *
 * CORS note: many servers do not set CORS headers. If fetching fails due to
 * CORS, configure a proxy prefix in settings (e.g. https://corsproxy.io/?).
 */

import type { DataProvider } from "./data-provider";
import type { CalendarEvent, CalendarMeta } from "../types";
import type { WebCalSource } from "../store";

// ── Minimal ICS parser ────────────────────────────────────────────────────────

function unfoldLines(raw: string): string[] {
  // RFC 5545: lines folded with CRLF + SPACE or CRLF + TAB
  return raw.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function parseICSValue(line: string): { key: string; value: string } {
  const colon = line.indexOf(":");
  if (colon === -1) return { key: line, value: "" };
  return { key: line.slice(0, colon).toUpperCase(), value: line.slice(colon + 1) };
}

/** Convert ICS datetime string to ISO. Handles DATE and DATETIME forms. */
function icsDateToISO(raw: string): string {
  // DATE: 20240315 → 2024-03-15T00:00:00
  // DATETIME: 20240315T090000Z or 20240315T090000
  const r = raw.trim().replace(/Z$/, "");
  if (r.length === 8) {
    // All-day date
    return `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}`;
  }
  const d = r.slice(0, 8);
  const t = r.slice(9); // after the T
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
}

function isAllDay(dtstart: string): boolean {
  // Param like DTSTART;VALUE=DATE:20240315 → all-day
  return !dtstart.includes("T");
}

interface ParsedEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
}

function parseICS(text: string): ParsedEvent[] {
  const lines = unfoldLines(text);
  const events: ParsedEvent[] = [];
  let current: Partial<ParsedEvent> | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current?.uid && current.start) {
        events.push({
          uid: current.uid,
          title: current.title || "(no title)",
          start: current.start,
          end: current.end || current.start,
          allDay: current.allDay ?? false,
          location: current.location,
          notes: current.notes,
        });
      }
      current = null;
      continue;
    }

    if (!current) continue;

    // Handle parameterized keys: DTSTART;TZID=...:value or DTSTART;VALUE=DATE:value
    const semiColon = trimmed.indexOf(";");
    const colon = trimmed.indexOf(":");
    const keyRaw = semiColon !== -1 && semiColon < colon
      ? trimmed.slice(0, semiColon)
      : trimmed.slice(0, colon);
    const value = colon !== -1 ? trimmed.slice(colon + 1) : "";
    const key = keyRaw.toUpperCase();

    switch (key) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.title = value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
        break;
      case "DTSTART": {
        const iso = icsDateToISO(value);
        current.start = iso;
        current.allDay = isAllDay(iso);
        break;
      }
      case "DTEND": {
        current.end = icsDateToISO(value);
        break;
      }
      case "DURATION":
        // skip duration handling for now
        break;
      case "LOCATION":
        current.location = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "DESCRIPTION":
        current.notes = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
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

  async getCalendars(): Promise<CalendarMeta[]> {
    return this.sources.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      visible: true,
    }));
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const all: CalendarEvent[] = [];

    await Promise.all(
      this.sources.map(async (source) => {
        try {
          const url = source.url.replace(/^webcal:\/\//i, "https://");
          const fetchUrl = this.proxyPrefix ? `${this.proxyPrefix}${encodeURIComponent(url)}` : url;
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          const parsed = parseICS(text);

          for (const e of parsed) {
            const eventStart = new Date(e.start);
            const eventEnd = new Date(e.end);
            // Filter to requested range
            if (eventEnd < start || eventStart > end) continue;
            all.push({
              id: `${source.id}::${e.uid}`,
              title: e.title,
              calendarId: source.id,
              eventTypeId: "meeting", // default — user can remap in event types
              start: e.start,
              end: e.end,
              allDay: e.allDay,
              location: e.location,
              notes: e.notes,
            });
          }
        } catch (err) {
          console.warn(`[WebCalProvider] Failed to fetch ${source.name}:`, err);
        }
      })
    );

    return all;
  }

  // Read-only — write operations are not supported for ICS subscriptions

  async createEvent(): Promise<CalendarEvent> {
    throw new Error("WebCal subscriptions are read-only.");
  }

  async updateEvent(): Promise<CalendarEvent> {
    throw new Error("WebCal subscriptions are read-only.");
  }

  async deleteEvent(): Promise<void> {
    throw new Error("WebCal subscriptions are read-only.");
  }
}
