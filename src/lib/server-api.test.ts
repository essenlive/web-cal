import { describe, expect, it } from "vitest";
import { normalizeServerUrl } from "./server-api";

describe("normalizeServerUrl", () => {
  it("treats empty as same origin", () => expect(normalizeServerUrl("  ")).toBe(""));
  it("strips trailing slashes and keeps a path prefix", () => {
    expect(normalizeServerUrl("https://cal.example/")).toBe("https://cal.example");
    expect(normalizeServerUrl("https://x.example/overcal//")).toBe("https://x.example/overcal");
  });
  it("assumes https when no scheme is given", () => expect(normalizeServerUrl("cal.example")).toBe("https://cal.example"));
  it("rejects non-http schemes", () => expect(normalizeServerUrl("ftp://cal.example")).toBeNull());
});
