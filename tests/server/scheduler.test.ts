import { describe, it, expect } from "vitest";
import { openDb } from "../../src/server/config/db";
import { importConfig } from "../../src/server/config/import";
import { runAggregationCycle } from "../../src/server/aggregation/scheduler";
import { getSnapshot } from "../../src/server/aggregation/snapshot-store";
import type { Connection, EventType } from "../../src/types";

const t: EventType = { id: "d", label: "D", color: "#000", icon: "x", allDayStyle: "background", timedStyle: "block", isDefault: true };
const c = (id: string): Connection => ({ type: "webcal", id, name: id, url: "https://e.com/x.ics", color: "#111" });
const keeper = { baseUrl: "http://k", token: "t" };
const calendars = [{ id: "a", name: "a" }, { id: "b", name: "b" }];
const evt = (id: string) => ({ id, title: id, start: "2026-11-15T10:00:00Z", end: "2026-11-15T11:00:00Z", allDay: false });

describe("scheduler", () => {
  it("one failing source does not block others and keeps last-good data", async () => {
    const db = openDb(":memory:");
    importConfig(db, { v: 1, connections: [c("a"), c("b")], eventTypes: [t], rules: [], presets: [] });
    await runAggregationCycle(db, { keeper, calendars, fetchEvents: async () => [evt("e1")] });
    expect(getSnapshot(db, "b")?.events).toHaveLength(1);

    await runAggregationCycle(db, {
      keeper,
      calendars,
      fetchEvents: async (_k, id) => {
        if (id === "a") throw new Error("down");
        return [evt("e1"), evt("e2")];
      },
    });
    expect(getSnapshot(db, "a")?.lastError).toBe("down");
    expect(getSnapshot(db, "a")?.events).toHaveLength(1);
    expect(getSnapshot(db, "b")?.events).toHaveLength(2);
  });
});
