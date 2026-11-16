import { parseICS } from "../../lib/ics-parse";
import type { Connector } from "./types";

/** Read-only connector over a public .ics / webcal:// URL. */
export function createIcsConnector(url: string, name = url): Connector {
  const httpUrl = url.replace(/^webcal:\/\//i, "https://");
  return {
    async listCalendars() {
      return [{ id: httpUrl, name }];
    },
    async getEvents(range) {
      const res = await fetch(httpUrl);
      if (!res.ok) throw new Error(`ICS fetch failed: ${res.status} ${res.statusText}`);
      const parsed = parseICS(await res.text(), range.start, range.end);
      if (!parsed) throw new Error("ICS feed could not be parsed");
      return parsed.map((e) => ({
        id: e.uid,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        location: e.location,
        notes: e.notes,
      }));
    },
  };
}
