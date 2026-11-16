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
});
