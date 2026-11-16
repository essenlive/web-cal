import { createDAVClient, type DAVCalendar } from "tsdav";
import { parseICS } from "../../lib/ics-parse";
import { buildEventCalendar } from "../feeds/ics-writer";
import type { CaldavEndpoint, Connector } from "./types";

/** Read/write connector over CalDAV (Radicale, Nextcloud, iCloud, Fastmail...). */
export function createCaldavConnector(endpoint: CaldavEndpoint): Connector {
  async function client() {
    return createDAVClient({
      serverUrl: endpoint.url,
      credentials: { username: endpoint.username, password: endpoint.password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
  }

  async function pickCalendar(c: Awaited<ReturnType<typeof client>>, calendarId?: string): Promise<DAVCalendar> {
    const calendars = await c.fetchCalendars();
    const wanted = calendarId ?? endpoint.calendar;
    const found = wanted ? calendars.find((cal) => cal.url === wanted || cal.displayName === wanted) : calendars[0];
    if (!found) throw new Error(wanted ? `CalDAV calendar "${wanted}" not found` : "No CalDAV calendar found");
    return found;
  }

  return {
    async listCalendars() {
      const c = await client();
      return (await c.fetchCalendars()).map((cal) => ({
        id: cal.url,
        name: typeof cal.displayName === "string" ? cal.displayName : cal.url,
      }));
    },
    async getEvents(range, calendarId) {
      const c = await client();
      const calendar = await pickCalendar(c, calendarId);
      const objects = await c.fetchCalendarObjects({
        calendar,
        timeRange: { start: range.start.toISOString(), end: range.end.toISOString() },
        expand: false,
      });
      const events = [];
      for (const obj of objects) {
        if (typeof obj.data !== "string") continue;
        for (const e of parseICS(obj.data, range.start, range.end) ?? []) {
          events.push({ id: e.uid, title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, notes: e.notes });
        }
      }
      return events;
    },
    async createEvent(event, calendarId) {
      const c = await client();
      const calendar = await pickCalendar(c, calendarId);
      const uid = crypto.randomUUID();
      const res = await c.createCalendarObject({
        calendar,
        filename: `${uid}.ics`,
        iCalString: buildEventCalendar({ ...event, id: uid, calendarId: "", eventTypeId: "" }),
      });
      if (!res.ok) throw new Error(`CalDAV create failed: ${res.status} ${res.statusText}`);
      return uid;
    },
  };
}
