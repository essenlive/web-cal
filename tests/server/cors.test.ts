import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";

const req = (method: string, origin = "https://app.example") =>
  new NextRequest("http://localhost/api/settings", { method, headers: { origin } });

afterEach(() => {
  delete process.env.CORS_ORIGINS;
});

describe("opt-in CORS", () => {
  it("adds no CORS header by default", () => {
    expect(proxy(req("GET")).headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows a listed origin and answers preflights", () => {
    process.env.CORS_ORIGINS = "https://app.example, https://other.example";
    expect(proxy(req("GET")).headers.get("access-control-allow-origin")).toBe("https://app.example");
    const pre = proxy(req("OPTIONS"));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-headers")).toContain("Authorization");
  });

  it("ignores an origin that is not listed", () => {
    process.env.CORS_ORIGINS = "https://other.example";
    expect(proxy(req("GET")).headers.get("access-control-allow-origin")).toBeNull();
  });

  it("supports a wildcard", () => {
    process.env.CORS_ORIGINS = "*";
    expect(proxy(req("GET", "https://anything.example")).headers.get("access-control-allow-origin")).toBe("*");
  });
});
