import { describe, it, expect } from "vitest";
import { createCaldavConnector } from "../../src/server/connectors/caldav";

const url = process.env.CALDAV_TEST_URL;

describe.skipIf(!url)("caldav connector (needs CALDAV_TEST_URL, e.g. a local Radicale)", () => {
  it("creates an event and reads it back", async () => {
    const connector = createCaldavConnector({ connectionId: "c", kind: "caldav", url: url!, username: "tester", password: "x", calendar: "work" });
    const start = new Date(Date.now() + 86_400_000);
    const uid = await connector.createEvent!({ title: "Test, avec; caractères", start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString(), allDay: false, location: "Paris" });
    const events = await connector.getEvents({ start: new Date(Date.now() - 86_400_000), end: new Date(Date.now() + 7 * 86_400_000) });
    const found = events.find((e) => e.id === uid);
    expect(found?.title).toBe("Test, avec; caractères");
    expect(found?.location).toBe("Paris");
  });

  it("updates and deletes with etag concurrency", async () => {
    const connector = createCaldavConnector({ connectionId: "c", kind: "caldav", url: url!, username: "tester", password: "x", calendar: "work" });
    const start = new Date(Date.now() + 2 * 86_400_000);
    const range = { start: new Date(Date.now() - 86_400_000), end: new Date(Date.now() + 7 * 86_400_000) };
    const uid = await connector.createEvent!({ title: "A modifier", start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString(), allDay: false, location: "Lyon" });
    const before = (await connector.getEvents(range)).find((e) => e.id === uid)!;
    expect(before.etag).toBeTruthy();

    await connector.updateEvent!(uid, { title: "Modifié", location: null }, before.etag);
    const after = (await connector.getEvents(range)).find((e) => e.id === uid)!;
    expect(after.title).toBe("Modifié");
    expect(after.location).toBeUndefined();
    expect(after.etag).not.toBe(before.etag);

    // Stale etag → 412
    await expect(connector.updateEvent!(uid, { title: "Perdu" }, before.etag)).rejects.toMatchObject({ status: 412 });
    await expect(connector.deleteEvent!(uid, before.etag)).rejects.toMatchObject({ status: 412 });

    await connector.deleteEvent!(uid, after.etag);
    expect((await connector.getEvents(range)).find((e) => e.id === uid)).toBeUndefined();
  });
});
