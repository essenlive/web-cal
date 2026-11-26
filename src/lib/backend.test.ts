import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendError, ServerBackend } from "./backend";

const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));

afterEach(() => vi.unstubAllGlobals());

describe("ServerBackend", () => {
  it("sends the admin token and returns per-connection events", async () => {
    const fetchMock = reply(200, { connections: { a: { name: "A", events: [], lastSyncedAt: 1, writable: true } } });
    vi.stubGlobal("fetch", fetchMock);
    const res = await new ServerBackend("tok").events(new Date(0), new Date(1000), "a");
    expect(res.a.writable).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("connectionId=a");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("raises BackendError with status and Retry-After", async () => {
    vi.stubGlobal("fetch", reply(429, { error: "slow down" }, { "retry-after": "3" }));
    await expect(new ServerBackend("").events(new Date(), new Date())).rejects.toMatchObject({ status: 429, retryAfterMs: 3000, message: "slow down" });
    expect(new BackendError(404, "x")).toBeInstanceOf(Error);
  });

  it("treats a stale section write as a result, not an error", async () => {
    vi.stubGlobal("fetch", reply(409, { rev: 4, value: [1] }));
    expect(await new ServerBackend("").putSection("rules", 3, [])).toEqual({ ok: false, rev: 4, value: [1] });
  });
});

describe("ServerBackend base URL", () => {
  it("prefixes requests with the server URL and sends the bearer", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
      calls.push([u, init]);
      return new Response(JSON.stringify({ v: 2, revs: {} }), { status: 200 });
    });
    await new ServerBackend("sess", "https://cal.example").getSettings();
    expect(calls[0][0]).toBe("https://cal.example/api/settings");
    expect(JSON.stringify(calls[0][1]?.headers)).toContain("Bearer sess");
    vi.unstubAllGlobals();
  });
});
