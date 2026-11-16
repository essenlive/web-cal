import { describe, it, expect } from "vitest";
import ICAL from "ical.js";
import { openDb } from "../../src/server/config/db";
import { importConfig } from "../../src/server/config/import";
import { recordSuccess } from "../../src/server/aggregation/snapshot-store";
import { buildPresetFeed, buildEmptyCalendar } from "../../src/server/feeds/ics-writer";
import type { CalendarEvent, EventType, Preset, Rule, Connection } from "../../src/types";

const defaultType: EventType = { id: "default", label: "D", color: "#000", icon: "x", allDayStyle: "background", timedStyle: "block", isDefault: true };
const hiddenType: EventType = { id: "hid", label: "H", color: "#111", icon: "x", allDayStyle: "background", timedStyle: "block", hidden: true };
const conn: Connection = { type: "webcal", id: "c1", name: "C1", url: "https://e.com/a.ics", color: "#222" };
const rules: Rule[] = [
  { id: "r1", matchType: "name", matchValue: "^Secret", displayTypeId: "hid", enabled: true, createdAt: 1 },
  { id: "all", matchType: "all", matchValue: "", displayTypeId: "default", enabled: true, createdAt: 0 },
];
const preset: Preset = { id: "p1", name: "All", connections: {}, eventTypes: {} };

const ev = (id: string, title: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, title, calendarId: "c1", eventTypeId: "x",
  start: "2026-11-15T10:00:00.000Z", end: "2026-11-15T11:00:00.000Z", allDay: false, ...extra,
});

function setup(events: CalendarEvent[]) {
  const db = openDb(":memory:");
  importConfig(db, { v: 1, connections: [conn], eventTypes: [defaultType, hiddenType], rules, presets: [preset] });
  recordSuccess(db, "c1", events, Date.now());
  return db;
}

function summaries(ics: string): string[] {
  const comp = new ICAL.Component(ICAL.parse(ics));
  return comp.getAllSubcomponents("vevent").map((v) => String(v.getFirstPropertyValue("summary")));
}

describe("ics-writer", () => {
  it("contains only visible events and round-trips through ical.js", () => {
    const db = setup([ev("1", "Meeting, with; chars"), ev("2", "Secret plan"), ev("3", "Holiday", { allDay: true, start: "2026-12-25", end: "2026-12-26" })]);
    const out = buildPresetFeed(db, preset);
    expect(summaries(out).sort()).toEqual(["Holiday", "Meeting, with; chars"]);
  });

  it("returns a valid empty calendar when nothing is visible", () => {
    const db = setup([ev("2", "Secret plan")]);
    expect(summaries(buildPresetFeed(db, preset))).toEqual([]);
    expect(summaries(buildEmptyCalendar())).toEqual([]);
  });
});
