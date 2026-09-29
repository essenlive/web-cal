import { describe, expect, it } from "vitest";
import { fromSearch, historyAction, toSearch, type UrlState } from "./url-state";

const base: UrlState = { view: "month", date: "2026-09-29" };

describe("url-state", () => {
  it("round-trips through the query string and ignores invalid parts", () => {
    const s: UrlState = { ...base, presetId: "p1", drawer: { panel: "theme", editId: "t1" } };
    expect(fromSearch(toSearch(s))).toMatchObject(s);
    expect(fromSearch("?view=year&date=nope&panel=bogus")).toEqual({});
  });

  it("pushes navigation, replaces tweaks, and steps back when closing a drawer it opened", () => {
    expect(historyAction(base, base, false)).toBe("none");
    expect(historyAction(base, { ...base, view: "week" }, false)).toBe("push");
    expect(historyAction(base, { ...base, date: "2026-10-29" }, false)).toBe("push");
    expect(historyAction(base, { ...base, presetId: "p1" }, false)).toBe("push");
    expect(historyAction({ ...base, presetId: "p1" }, base, false)).toBe("replace");
    const open = { ...base, drawer: { panel: "theme" as const } };
    expect(historyAction(base, open, false)).toBe("push");
    expect(historyAction(open, { ...base, drawer: { panel: "rules" as const } }, true)).toBe("replace");
    expect(historyAction(open, base, true)).toBe("back");
    expect(historyAction(open, base, false)).toBe("replace");
  });
});
