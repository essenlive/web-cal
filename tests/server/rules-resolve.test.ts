import { describe, it, expect } from "vitest";
import { resolveEventType, isEventHidden } from "../../src/server/rules/resolve";
import type { CalendarEvent, Connection, EventType, Rule } from "../../src/types";

const defaultType: EventType = {
  id: "default",
  label: "Default",
  color: "#000000",
  icon: "calendar",
  allDayStyle: "background",
  timedStyle: "block",
  isDefault: true,
};

const workType: EventType = {
  id: "work",
  label: "Work",
  color: "#6366f1",
  icon: "briefcase",
  allDayStyle: "background",
  timedStyle: "block",
};

const hiddenType: EventType = {
  id: "hidden-type",
  label: "Hidden",
  color: "#999999",
  icon: "eye-off",
  allDayStyle: "background",
  timedStyle: "block",
  hidden: true,
};

const types = new Map<string, EventType>([
  [defaultType.id, defaultType],
  [workType.id, workType],
  [hiddenType.id, hiddenType],
]);
const getType = (id: string) => types.get(id);

const connections: Connection[] = [
  { type: "webcal", id: "conn-visible", name: "Visible", url: "https://example.com/visible.ics", color: "#111111" },
  { type: "webcal", id: "conn-hidden", name: "Hidden source", url: "https://example.com/hidden.ics", color: "#222222", hidden: true },
];
const getConnection = (calendarId: string) => connections.find((c) => c.id === calendarId);

const rules: Rule[] = [
  { id: "r-work", matchType: "source", matchValue: "conn-visible", displayTypeId: "work", enabled: true, createdAt: 1 },
  { id: "r-broken", matchType: "name", matchValue: "^Broken$", displayTypeId: "nonexistent-type", enabled: true, createdAt: 2 },
  { id: "r-hidden-type", matchType: "name", matchValue: "^SecretEvent$", displayTypeId: "hidden-type", enabled: true, createdAt: 3 },
  { id: "r-all", matchType: "all", matchValue: "", displayTypeId: defaultType.id, enabled: true, createdAt: 0 },
];

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "evt-1",
    title: "Meeting",
    calendarId: "conn-visible",
    eventTypeId: "ignored",
    start: "2026-11-15T10:00:00.000Z",
    end: "2026-11-15T11:00:00.000Z",
    allDay: false,
    ...overrides,
  };
}

describe("server/rules/resolve", () => {
  it("resolves via the matching rule's display type, same as EventChip", () => {
    const event = makeEvent({});
    expect(resolveEventType(event, getType, rules, defaultType)).toBe(workType);
  });

  it("falls back to the default type for the catch-all rule", () => {
    const event = makeEvent({ calendarId: "no-match-source" });
    expect(resolveEventType(event, getType, rules, defaultType)).toBe(defaultType);
  });

  it("falls back to the default type when the matched rule's target type was deleted", () => {
    const event = makeEvent({ title: "Broken", calendarId: "no-match-source" });
    expect(resolveEventType(event, getType, rules, defaultType)).toBe(defaultType);
  });

  it("is hidden when the resolved type is hidden", () => {
    const event = makeEvent({ title: "SecretEvent", calendarId: "no-match-source" });
    expect(isEventHidden(event, getType, getConnection, rules, defaultType)).toBe(true);
  });

  it("is hidden when the source connection is hidden, regardless of type", () => {
    const event = makeEvent({ calendarId: "conn-hidden" });
    expect(isEventHidden(event, getType, getConnection, rules, defaultType)).toBe(true);
  });

  it("is visible when neither the source nor the resolved type is hidden", () => {
    const event = makeEvent({});
    expect(isEventHidden(event, getType, getConnection, rules, defaultType)).toBe(false);
  });
});
