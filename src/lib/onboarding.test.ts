import { describe, expect, it } from "vitest";
import { coreDone, isFreshInstance, onboardingSteps, type OnboardingState } from "./onboarding";
import type { Connection } from "../types";

const demo: Connection = { type: "demo", id: "demo", name: "Démo", color: "#6366f1" };
const real: Connection = { type: "webcal", id: "work", name: "Travail", url: "https://x.test/a.ics", color: "#ef4444" };
const seeded = new Set(["meeting", "deadline"]);
const builtins = new Set(["light", "dark"]);
const fresh: OnboardingState = {
  connections: [demo],
  types: [{ id: "meeting", label: "Classique", color: "#000000", icon: "Users", allDayStyle: "block", timedStyle: "block", isDefault: true }],
  rules: [
    { id: "seed-deadline", matchType: "name", matchValue: "Rendu", displayTypeId: "deadline", enabled: true, createdAt: 1 },
    { id: "src", matchType: "source", matchValue: "demo", displayTypeId: "meeting", enabled: true, createdAt: 0 },
  ],
  presets: [],
  customThemes: [],
  selectedThemeId: "light",
  aiImported: false,
};
const done = (s: OnboardingState) => Object.fromEntries(onboardingSteps(s, seeded, builtins).map((x) => [x.id, x.done]));

describe("onboardingSteps", () => {
  it("a fresh instance has nothing done — seeded types/rules and the source rule don't count", () => {
    expect(done(fresh)).toEqual({ source: false, removeDemo: false, type: false, rule: false, preset: false, theme: false, ai: false });
    expect(isFreshInstance(fresh.connections)).toBe(true);
    expect(onboardingSteps(fresh, seeded, builtins).find((s) => s.id === "removeDemo")?.visible).toBe(false);
  });

  it("ticks each step from the user's own additions; demo removal is offered, not required", () => {
    const s: OnboardingState = {
      ...fresh,
      connections: [demo, real],
      types: [...fresh.types, { id: "sport", label: "Sport", color: "#000000", icon: "Bike", allDayStyle: "block", timedStyle: "block" }],
      rules: [...fresh.rules, { id: "r1", matchType: "name", matchValue: "bad", displayTypeId: "sport", enabled: true, createdAt: 2 }],
    };
    const steps = onboardingSteps(s, seeded, builtins);
    expect(steps.find((x) => x.id === "removeDemo")).toMatchObject({ visible: true, done: false });
    expect(coreDone(steps)).toBe(true);
    expect(isFreshInstance(s.connections)).toBe(false);
    expect(done({ ...s, selectedThemeId: "dark", presets: [{ id: "p", name: "P", connections: {}, eventTypes: {} }], aiImported: true }))
      .toMatchObject({ theme: true, preset: true, ai: true });
  });
});
