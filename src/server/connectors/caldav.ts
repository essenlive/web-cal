import ICAL from "ical.js";
import { createDAVClient, type DAVCalendar } from "tsdav";
import { parseICS } from "../../lib/ics-parse";
import { buildEventCalendar } from "../feeds/ics-writer";
import { ConnectorError, type CaldavEndpoint, type Connector, type EventPatch } from "./types";

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

  async function findObject(c: Awaited<ReturnType<typeof client>>, calendar: DAVCalendar, uid: string) {
    const wanted = new RegExp(`^UID:\\s*${uid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
    const objects = await c.fetchCalendarObjects({ calendar });
    const found = objects.find((o) => typeof o.data === "string" && wanted.test(o.data.replace(/\r?\n[ \t]/g, "")));
    if (!found) throw new ConnectorError("Événement introuvable sur le serveur CalDAV", 404);
    return found as typeof found & { data: string };
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
          events.push({ id: e.uid, title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, notes: e.notes, etag: obj.etag });
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
    async updateEvent(uid, patch: EventPatch, etag, calendarId) {
      const c = await client();
      const calendar = await pickCalendar(c, calendarId);
      const obj = await findObject(c, calendar, uid);
      const root = new ICAL.Component(ICAL.parse(obj.data));
      const vevents = root.getAllSubcomponents("vevent");
      if (vevents.length !== 1 || vevents[0].hasProperty("rrule") || vevents[0].hasProperty("recurrence-id")) {
        throw new ConnectorError("Les événements récurrents ne sont pas modifiables ici", 422);
      }
      const vevent = vevents[0];
      const current = new ICAL.Event(vevent);
      const allDay = patch.allDay ?? current.startDate.isDate;
      if (patch.title !== undefined) vevent.updatePropertyWithValue("summary", patch.title);
      if (patch.start !== undefined || patch.end !== undefined || patch.allDay !== undefined) {
        const toTime = (iso: string) => (allDay ? ICAL.Time.fromDateString(iso.slice(0, 10)) : ICAL.Time.fromJSDate(new Date(iso), true));
        const startIso = patch.start ?? current.startDate.toJSDate().toISOString();
        const endIso = patch.end ?? current.endDate.toJSDate().toISOString();
        vevent.removeProperty("duration");
        vevent.updatePropertyWithValue("dtstart", toTime(startIso));
        vevent.updatePropertyWithValue("dtend", toTime(endIso));
      }
      for (const [field, prop] of [["location", "location"], ["notes", "description"]] as const) {
        const value = patch[field];
        if (value === undefined) continue;
        if (value === null || value === "") vevent.removeProperty(prop);
        else vevent.updatePropertyWithValue(prop, value);
      }
      vevent.updatePropertyWithValue("last-modified", ICAL.Time.now());
      const res = await c.updateCalendarObject({ calendarObject: { url: obj.url, data: root.toString(), etag: etag ?? obj.etag } });
      if (res.status === 412) throw new ConnectorError("Événement modifié ailleurs entre-temps", 412);
      if (!res.ok) throw new ConnectorError(`CalDAV update failed: ${res.status} ${res.statusText}`, 502);
    },
    async deleteEvent(uid, etag, calendarId) {
      const c = await client();
      const calendar = await pickCalendar(c, calendarId);
      const obj = await findObject(c, calendar, uid);
      const res = await c.deleteCalendarObject({ calendarObject: { url: obj.url, etag: etag ?? obj.etag } });
      if (res.status === 412) throw new ConnectorError("Événement modifié ailleurs entre-temps", 412);
      if (!res.ok) throw new ConnectorError(`CalDAV delete failed: ${res.status} ${res.statusText}`, 502);
    },
  };
}
