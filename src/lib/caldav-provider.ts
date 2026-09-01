/**
 * CalDAVProvider — generic read-only DataProvider using CalDAV (RFC 4791).
 *
 * Works with any CalDAV server: Proton Calendar, Nextcloud, Fastmail,
 * Apple Calendar Server, Google Calendar (via CalDAV), Baikal, etc.
 *
 * Auth: HTTP Basic (username + password / app-password).
 *
 * CORS note: most CalDAV servers do not serve CORS headers, so direct browser
 * fetch will be blocked. Set caldavProxyUrl to a CORS proxy prefix, e.g.:
 *   https://corsproxy.io/?  (then the real URL is appended URL-encoded)
 *   http://localhost:8080/  (local proxy you run yourself)
 *
 * The proxy must forward Authorization headers to the upstream server.
 */

import { toast } from "sonner";
import { describeHttpError, type DataProvider } from "./data-provider";
import type { CalendarEvent } from "../types";

/** Internal representation of a CalDAV calendar collection. */
interface CalendarCollection {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function basicAuth(username: string, password: string): string {
  return "Basic " + btoa(`${username}:${password}`);
}

function proxyUrl(base: string, proxy: string): string {
  if (!proxy) return base;
  return proxy + encodeURIComponent(base);
}

async function davRequest(
  method: string,
  url: string,
  auth: string,
  proxy: string,
  body?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: auth,
    "Content-Type": body ? (method === "REPORT" || method === "PROPFIND" ? "application/xml; charset=utf-8" : "text/calendar; charset=utf-8") : "application/xml",
    Depth: method === "PROPFIND" || method === "REPORT" ? "1" : "0",
    ...extraHeaders,
  };

  if (!proxy) {
    // No external proxy configured — tunnel through the app's own same-origin
    // proxy (PROPFIND/REPORT aren't standard fetch methods Next.js route
    // handlers can dispatch on directly, hence the POST envelope).
    const res = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, url, headers, body }),
    });
    return res;
  }

  const res = await fetch(proxyUrl(url, proxy), { method, headers, body });
  return res;
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function parseMultiStatus(xml: string): Array<{ href: string; ics: string; etag: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const responses = Array.from(doc.querySelectorAll("response"));
  return responses.map((r) => ({
    href: r.querySelector("href")?.textContent?.trim() ?? "",
    ics: r.querySelector("calendar-data")?.textContent ?? "",
    etag: r.querySelector("getetag")?.textContent ?? "",
  })).filter((r) => r.ics);
}

// ── Minimal ICS parser (same approach as WebCalProvider) ─────────────────────

function unfoldLines(raw: string): string[] {
  return raw.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function icsDateToISO(raw: string): string {
  const r = raw.trim().replace(/Z$/, "");
  if (r.length === 8) return `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}`;
  const d = r.slice(0, 8);
  const t = r.slice(9);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
}

function parseSingleEvent(ics: string, calendarId: string): CalendarEvent | null {
  const lines = unfoldLines(ics);
  let uid = "", title = "", start = "", end = "", allDay = false, location: string | undefined, notes: string | undefined;

  for (const rawLine of lines) {
    const semiColon = rawLine.indexOf(";");
    const colon = rawLine.indexOf(":");
    if (colon === -1) continue;
    const keyRaw = semiColon !== -1 && semiColon < colon ? rawLine.slice(0, semiColon) : rawLine.slice(0, colon);
    const value = rawLine.slice(colon + 1);
    const key = keyRaw.toUpperCase();
    switch (key) {
      case "UID": uid = value.trim(); break;
      case "SUMMARY": title = value.replace(/\\n/g, "\n").replace(/\\,/g, ","); break;
      case "DTSTART": { const iso = icsDateToISO(value); start = iso; allDay = !iso.includes("T"); break; }
      case "DTEND": end = icsDateToISO(value); break;
      case "LOCATION": location = value.replace(/\\,/g, ","); break;
      case "DESCRIPTION": notes = value.replace(/\\n/g, "\n").replace(/\\,/g, ","); break;
    }
  }

  if (!uid || !start) return null;
  return { id: uid, title: title || "(no title)", calendarId, eventTypeId: "meeting", start, end: end || start, allDay, location, notes };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class CalDAVProvider implements DataProvider {
  private auth: string;
  private serverUrl: string;
  private proxy: string;

  constructor(
    serverUrl: string,  // e.g. https://calendar.proton.me/dav
    username: string,
    password: string,
    proxy = ""
  ) {
    this.proxy = proxy;
    this.auth = basicAuth(username, password);
    // Normalise: strip trailing slash
    this.serverUrl = serverUrl.replace(/\/$/, "");
  }

  /** Discover calendar collections via PROPFIND. */
  async getCalendars(): Promise<CalendarCollection[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <C:calendar-description/>
  </D:prop>
</D:propfind>`;

    const res = await davRequest("PROPFIND", this.serverUrl, this.auth, this.proxy, body);
    if (!res.ok && res.status !== 207) throw new Error(describeHttpError(res.status));
    const xml = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const responses = Array.from(doc.querySelectorAll("response"));

    const calendars: CalendarCollection[] = [];
    const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];

    for (const r of responses) {
      const isCalendar = r.querySelector("calendar") !== null;
      if (!isCalendar) continue;
      const href = r.querySelector("href")?.textContent?.trim() ?? "";
      const name = r.querySelector("displayname")?.textContent?.trim() || href.split("/").filter(Boolean).pop() || "Calendar";
      calendars.push({
        id: href,
        name,
        color: colors[calendars.length % colors.length],
        visible: true,
      });
    }

    return calendars.length > 0 ? calendars : [{ id: "/", name: "Calendar", color: "#3b82f6", visible: true }];
  }

  /** Fetch events in range using REPORT calendar-query. */
  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const calendars = await this.getCalendars();
    const all: CalendarEvent[] = [];

    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    await Promise.all(
      calendars.map(async (cal) => {
        const calUrl = cal.id.startsWith("http") ? cal.id : `${this.serverUrl}${cal.id}`;
        const body = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${fmt(start)}" end="${fmt(end)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

        try {
          const res = await davRequest("REPORT", calUrl, this.auth, this.proxy, body);
          if (!res.ok && res.status !== 207) return;
          const xml = await res.text();
          const items = parseMultiStatus(xml);
          for (const item of items) {
            const event = parseSingleEvent(item.ics, cal.id);
            if (event) all.push(event);
          }
        } catch (err) {
          console.warn(`[CalDAVProvider] Failed to fetch ${cal.name}:`, err);
          toast.error(`Échec du chargement de « ${cal.name} ».`, {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      })
    );

    return all;
  }
}
