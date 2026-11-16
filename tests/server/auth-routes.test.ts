import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDb } from "../../src/server/config/db";

const db = openDb(":memory:");
vi.mock("../../src/server/config/db", async (orig) => ({ ...(await orig<typeof import("../../src/server/config/db")>()), getDb: () => db }));

import { POST as setup } from "../../src/app/api/auth/setup/route";
import { POST as login } from "../../src/app/api/auth/login/route";
import { POST as pair } from "../../src/app/api/auth/pair/route";
import { POST as redeem } from "../../src/app/api/auth/redeem/route";
import { POST as logout } from "../../src/app/api/auth/logout/route";
import { GET as sessions } from "../../src/app/api/auth/sessions/route";
import { GET as status } from "../../src/app/api/server/status/route";
import { GET as settings } from "../../src/app/api/settings/route";

const url = "http://localhost/api/x";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

beforeEach(() => {
  process.env.ADMIN_TOKEN = "admin-secret";
  process.env.SECRET_KEY = "test-key";
  db.exec("DELETE FROM auth; DELETE FROM sessions; DELETE FROM pairing_codes;");
});

describe("passphrase login flow", () => {
  it("setup needs the admin token and a long enough passphrase", async () => {
    expect((await setup(post({ passphrase: "long enough pass" }))).status).toBe(401);
    expect((await setup(post({ passphrase: "short" }, { authorization: "Bearer admin-secret" }))).status).toBe(400);
    const ok = await setup(post({ passphrase: "long enough pass", deviceName: "Mac" }, { authorization: "Bearer admin-secret" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/overcal_session=.+HttpOnly.+SameSite=Lax/);
  });

  it("login then access with the cookie alone; logout revokes", async () => {
    await setup(post({ passphrase: "long enough pass" }, { authorization: "Bearer admin-secret" }));
    expect((await login(post({ passphrase: "wrong passphrase" }, { "x-forwarded-for": "9.9.9.9" }))).status).toBe(401);
    const res = await login(post({ passphrase: "long enough pass", deviceName: "Phone" }));
    expect(res.status).toBe(200);
    const cookie = cookieOf(res);

    expect((await settings(new Request(url))).status).toBe(401);
    expect((await settings(new Request(url, { headers: { cookie } }))).status).toBe(200);
    expect(await (await status(new Request(url, { headers: { cookie } }))).json()).toMatchObject({ enabled: true, passphraseSet: true, authenticated: true, deviceName: "Phone" });

    await logout(new Request(url, { method: "POST", headers: { cookie } }));
    expect((await settings(new Request(url, { headers: { cookie } }))).status).toBe(401);
  });

  it("admin token keeps working next to sessions", async () => {
    expect((await settings(new Request(url, { headers: { authorization: "Bearer admin-secret" } }))).status).toBe(200);
  });
});

describe("QR pairing", () => {
  it("pairs a second device with a single-use code", async () => {
    await setup(post({ passphrase: "long enough pass" }, { authorization: "Bearer admin-secret" }));
    const first = cookieOf(await login(post({ passphrase: "long enough pass" })));
    expect((await pair(new Request(url, { method: "POST" }))).status).toBe(401);

    const { code } = (await (await pair(new Request(url, { method: "POST", headers: { cookie: first } }))).json()) as { code: string };
    const res = await redeem(post({ code, deviceName: "Tablet" }));
    expect(res.status).toBe(200);
    const second = cookieOf(res);
    expect(second).not.toBe(first);
    expect((await redeem(post({ code }, { "x-forwarded-for": "8.8.8.8" }))).status).toBe(401);

    const list = (await (await sessions(new Request(url, { headers: { cookie: second } }))).json()) as { sessions: Array<{ deviceName: string }> };
    expect(list.sessions.map((s) => s.deviceName)).toContain("Tablet");
  });
});
