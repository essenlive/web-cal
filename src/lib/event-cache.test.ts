import { describe, expect, it } from "vitest";
import { cacheState, createEmptyCacheEntry, mergeFetchedRange } from "./event-cache";

describe("cacheState", () => {
  const window = { start: "2026-01-01T00:00:00.000Z", end: "2026-04-01T00:00:00.000Z" };
  const fresh = (start: string, end: string) => mergeFetchedRange(createEmptyCacheEntry("k"), { start, end }, []);

  it("classifies empty, partial, full and stale", () => {
    expect(cacheState(undefined, window)).toBe("empty");
    expect(cacheState(createEmptyCacheEntry("k"), window)).toBe("empty");
    expect(cacheState(fresh("2026-02-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"), window)).toBe("partial");
    expect(cacheState(fresh("2025-12-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z"), window)).toBe("full");
    const old = { ...fresh(window.start, window.end), lastFetchedAt: Date.now() - 60 * 60 * 1000 };
    expect(cacheState(old, window)).toBe("stale");
  });
});
