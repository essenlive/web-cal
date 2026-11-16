import { describe, expect, it } from "vitest";
import { missingSources } from "./ServerTab";

describe("missingSources", () => {
  it("lists server sources absent from the device", () => {
    const server = { a: { name: "A", color: "#111" }, b: { name: "Perso", color: "#222" } };
    expect(missingSources(server, ["a", "demo"])).toEqual([{ id: "b", name: "Perso", color: "#222" }]);
    expect(missingSources(server, ["a", "b"])).toEqual([]);
  });
});
