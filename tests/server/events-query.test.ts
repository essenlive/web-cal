import { describe, it, expect } from "vitest";
import { openDb } from "../../src/server/config/db";
import { importConfig } from "../../src/server/config/import";
import { recordSuccess } from "../../src/server/aggregation/snapshot-store";
import { listServerEvents } from "../../src/server/events/query";
import type { Connection, EventType } from "../../src/types";

const t: EventType = { id: "d", label: "D", color: "#000", icon: "x", allDayStyle: "background", timedStyle: "block", isDefault: true };
const conn = (id: string): Connection => ({ type: "webcal", id, name: id, url: "https://e.com/x.ics", color: "#111" });
const evt = (id: string, start: string, end: string) => ({ id, title: id, calendarId: "", eventTypeId: "", start, end, allDay: false });

describe("listServerEvents", () => {
  it("namespaces ids, filters to the range and reports writable endpoints", () => {
    const db = openDb(":memory:");
    process.env.SECRET_KEY = "test-key";
    importConfig(db, {
      v: 1,
      connections: [conn("a"), conn("b")],
      eventTypes: [t],
      rules: [],
      presets: [],
      endpoints: [{ connectionId: "b", kind: "caldav", url: "http://r/", username: "u", password: "p" }],
    });
    recordSuccess(db, "a", [evt("in", "2026-11-17T10:00:00Z", "2026-11-17T11:00:00Z"), evt("out", "2026-12-25T10:00:00Z", "2026-12-25T11:00:00Z")], Date.now());

    const range = { start: new Date("2026-11-16T00:00:00Z"), end: new Date("2026-11-30T00:00:00Z") };
    const all = listServerEvents(db, range);
    expect(all.a.events.map((e) => e.id)).toEqual(["a::in"]);
    expect(all.a.events[0].calendarId).toBe("a");
    expect(all.a.writable).toBe(false);
    expect(all.b).toMatchObject({ events: [], lastSyncedAt: null, writable: true });

    expect(Object.keys(listServerEvents(db, range, "b"))).toEqual(["b"]);
  });
});
