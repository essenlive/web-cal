import { describe, expect, it } from "vitest";
import { buildEventPatch } from "./EventEditDialog";

const base = { title: " Réunion ", allDay: false, start: "2026-12-01T09:00", end: "2026-12-01T10:00", startDay: "2026-12-01", endDay: "2026-12-02", location: " ", notes: "n" };

describe("buildEventPatch", () => {
  it("trims, clears empty location and keeps notes", () => {
    const p = buildEventPatch(base);
    expect(p.title).toBe("Réunion");
    expect(p.location).toBeNull();
    expect(p.notes).toBe("n");
    expect(p.allDay).toBe(false);
  });

  it("turns an inclusive last day into an exclusive end for all-day events", () => {
    const p = buildEventPatch({ ...base, allDay: true });
    expect(p.start).toBe("2026-12-01");
    expect(p.end).toBe("2026-12-03");
  });
});
