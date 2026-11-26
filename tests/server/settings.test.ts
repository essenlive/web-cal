import { describe, it, expect } from "vitest";
import { openDb } from "../../src/server/config/db";
import { getSettings, putSection } from "../../src/server/config/settings";
import { getTokenByPresetId } from "../../src/server/feeds/tokens";
import type { Connection } from "../../src/types";

const conn = (id: string, url = "https://e.com/x.ics"): Connection => ({ type: "webcal", id, name: id, url, color: "#111" });

describe("versioned settings", () => {
  it("starts at revision 0 and increments on each accepted write", () => {
    const db = openDb(":memory:");
    expect(getSettings(db).revs.rules).toBe(0);
    expect(putSection(db, "rules", 0, [])).toEqual({ ok: true, rev: 1 });
    expect(putSection(db, "rules", 1, [{ id: "r" }])).toEqual({ ok: true, rev: 2 });
    expect(getSettings(db).rules).toEqual([{ id: "r" }]);
  });

  it("rejects a stale write with the current value", () => {
    const db = openDb(":memory:");
    putSection(db, "rules", 0, [{ id: "a" }]);
    const res = putSection(db, "rules", 0, [{ id: "b" }]);
    expect(res).toEqual({ ok: false, rev: 1, value: [{ id: "a" }] });
    expect(getSettings(db).rules).toEqual([{ id: "a" }]);
  });

  it("keeps server-only connections and creates feed tokens for presets", () => {
    const db = openDb(":memory:");
    putSection(db, "connections", 0, [conn("a"), conn("radicale", "http://r/perso/")]);
    putSection(db, "connections", 1, [conn("a"), { ...conn("radicale", ""), serverOnly: true } as Connection, { ...conn("ghost", ""), serverOnly: true } as Connection]);
    const urls = (getSettings(db).connections as Connection[]).map((c) => (c as { url: string }).url);
    expect(urls).toEqual(["https://e.com/x.ics", "http://r/perso/"]);
    putSection(db, "presets", 0, [{ id: "p1", name: "P", connections: {}, eventTypes: {} }]);
    expect(getTokenByPresetId(db, "p1")).not.toBeNull();
  });

  it("stores themes and ui as objects", () => {
    const db = openDb(":memory:");
    expect(putSection(db, "themes", 0, { selectedThemeId: "dark" }).ok).toBe(true);
    expect(getSettings(db).themes).toEqual({ selectedThemeId: "dark" });
    expect(getSettings(db).ui).toBeNull();
  });
});
