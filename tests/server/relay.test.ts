import { beforeEach, describe, expect, it } from "vitest";
import { isValidRoom, putSlot, resetRelay, takeSlot } from "../../src/server/relay";

describe("relay mailbox", () => {
  beforeEach(resetRelay);

  it("validates room ids", () => {
    expect(isValidRoom("ABCDEFGH")).toBe(true);
    expect(isValidRoom("../etc")).toBe(false);
    expect(isValidRoom("abc")).toBe(false);
  });

  it("delivers a slot once", () => {
    putSlot("ABCDEFGH", "join", "cipher");
    expect(takeSlot("ABCDEFGH", "init")).toBeNull();
    expect(takeSlot("ABCDEFGH", "join")).toBe("cipher");
    expect(takeSlot("ABCDEFGH", "join")).toBeNull();
  });

  it("expires after the TTL", () => {
    putSlot("ABCDEFGH", "init", "x", 1000);
    expect(takeSlot("ABCDEFGH", "init", 1000 + 5 * 60 * 1000 + 1)).toBeNull();
  });

  it("refuses new rooms when full", () => {
    for (let i = 0; i < 200; i++) expect(putSlot(`ROOM${i.toString(36).padStart(4, "A")}`, "init", "x")).toBe(true);
    expect(putSlot("ZZZZZZZZ", "init", "x")).toBe(false);
  });
});
