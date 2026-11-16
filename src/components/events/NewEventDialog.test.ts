import { describe, expect, it } from "vitest";
import { buildNewEventPayload } from "./NewEventDialog";

const base = { title: "  Dentiste ", allDay: false, start: "2026-11-17T10:00", end: "2026-11-17T11:00", day: "2026-11-17", location: " " };

describe("buildNewEventPayload", () => {
  it("sends timed events as ISO instants and trims text", () => {
    const p = buildNewEventPayload(base);
    expect(p.title).toBe("Dentiste");
    expect(p.allDay).toBe(false);
    expect(p.start).toBe(new Date("2026-11-17T10:00").toISOString());
    expect(p.end).toBe(new Date("2026-11-17T11:00").toISOString());
    expect("location" in p).toBe(false);
  });

  it("sends all-day events as plain dates with an exclusive end", () => {
    expect(buildNewEventPayload({ ...base, allDay: true, location: "Paris" })).toMatchObject({
      start: "2026-11-17",
      end: "2026-11-18",
      allDay: true,
      location: "Paris",
    });
  });
});
