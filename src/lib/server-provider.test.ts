import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerProvider } from "./server-provider";
import type { CalendarEvent } from "../types";
import type { DataProvider } from "./data-provider";

const event = (id: string): CalendarEvent => ({ id, title: id, calendarId: "c", eventTypeId: "meeting", start: "2026-11-17T10:00:00Z", end: "2026-11-17T11:00:00Z", allDay: false });
const range: [Date, Date] = [new Date("2026-11-01"), new Date("2026-12-01")];
const direct: DataProvider = { getEvents: vi.fn(async () => [event("direct")]) };

function mockFetch(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("ServerProvider", () => {
  it("returns the server's events when the connection is synced there", async () => {
    mockFetch(200, { connections: { c: { events: [event("c::1")], lastSyncedAt: 1 } } });
    const events = await new ServerProvider("c", "tok", direct).getEvents(...range);
    expect(events.map((e) => e.id)).toEqual(["c::1"]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("connectionId=c");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it.each([404, 503])("falls back to the direct provider on HTTP %i", async (status) => {
    mockFetch(status);
    const events = await new ServerProvider("c", "tok", direct).getEvents(...range);
    expect(events.map((e) => e.id)).toEqual(["direct"]);
  });

  it("falls back when the server knows the connection but has never synced it", async () => {
    mockFetch(200, { connections: { c: { events: [], lastSyncedAt: null } } });
    const events = await new ServerProvider("c", "tok", direct).getEvents(...range);
    expect(events.map((e) => e.id)).toEqual(["direct"]);
  });

  it("surfaces a rejected token instead of silently falling back", async () => {
    mockFetch(401);
    await expect(new ServerProvider("c", "bad", direct).getEvents(...range)).rejects.toMatchObject({ status: 401 });
  });
});
