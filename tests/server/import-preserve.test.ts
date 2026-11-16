import { describe, it, expect } from "vitest";
import { openDb } from "../../src/server/config/db";
import { getConfig, getEndpoints, importConfig } from "../../src/server/config/import";
import type { Connection, EventType } from "../../src/types";

const t: EventType = { id: "d", label: "D", color: "#000", icon: "x", allDayStyle: "background", timedStyle: "block", isDefault: true };
const conn = (id: string, url = "https://e.com/x.ics"): Connection => ({ type: "webcal", id, name: id, url, color: "#111" });

describe("importConfig from a client push", () => {
  it("keeps endpoints and server-only connections the client doesn't define", () => {
    process.env.SECRET_KEY = "test-key";
    const db = openDb(":memory:");
    importConfig(db, {
      v: 1, connections: [conn("a"), conn("radicale", "http://r/perso/")], eventTypes: [t], rules: [], presets: [],
      endpoints: [{ connectionId: "radicale", kind: "caldav", url: "http://r/", username: "u", password: "p" }],
    });
    importConfig(db, {
      v: 1,
      connections: [conn("a", "https://e.com/changed.ics"), { ...conn("radicale", ""), serverOnly: true } as Connection, { ...conn("ghost", ""), serverOnly: true } as Connection],
      eventTypes: [t], rules: [], presets: [],
    });
    const conns = getConfig(db, "connections") as Connection[];
    expect(conns.map((c) => c.id)).toEqual(["a", "radicale"]);
    expect((conns[0] as { url: string }).url).toBe("https://e.com/changed.ics");
    expect((conns[1] as { url: string }).url).toBe("http://r/perso/");
    expect(getEndpoints(db)).toHaveLength(1);
  });
});
