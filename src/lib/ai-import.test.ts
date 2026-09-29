import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CalendarEvent, Connection, EventType, Rule } from "../types";
import { applyAiImport, DISPLAY_STYLES, parseAiImport } from "./ai-import";
import { useConnectionStore, useEventTypeStore, usePresetStore, useRuleStore, useThemeStore } from "../store";
import { BUILTIN_THEMES, THEME_PATTERNS } from "./theme";
import { AI_RULES_PROMPT, buildAiExport, SAMPLE_EVENTS_PER_SOURCE } from "./ai-prompt";

const schema = JSON.parse(readFileSync(path.resolve(__dirname, "../../docs/ai-rules-schema.json"), "utf8"));

const connections: Connection[] = [
  { type: "webcal", id: "src-perso", name: "P-Perso", url: "https://example.com/secret-token.ics", color: "#8b5cf6" },
  { type: "webcal", id: "src-work", name: "W-Equipe", url: "https://dav.example.com/token-hunter2.ics", color: "#ef4444" },
];
const existingIds = new Set(["meeting"]);

function envelope(types: unknown[], rules: unknown[]) {
  return JSON.stringify({
    version: 1,
    exportedAt: "2026-09-28T21:00:00.000Z",
    data: {
      "overcal:event-types": { version: 0, state: { types } },
      "overcal:rules": { version: 0, state: { rules } },
    },
  });
}

const sport = { id: "sport", label: "Sport", color: "#14b8a6", icon: "Dumbbell", badgeLetter: true, allDayStyle: "avatar-bl", timedStyle: "avatar-bl" };

describe("parseAiImport", () => {
  it("accepts a schema-shaped envelope and resolves rules to new and existing types", () => {
    const result = parseAiImport(
      envelope([sport], [
        { matchType: "name", matchValue: "badminton|bad", displayTypeId: "sport", enabled: true },
        { matchType: "source", matchValue: "src-work", displayTypeId: "meeting" },
      ]),
      connections,
      existingIds,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.warnings).toEqual([]);
    expect(result.eventTypes).toEqual([{ originalId: "sport", label: "Sport", color: "#14b8a6", icon: "Dumbbell", badgeLetter: true, allDayStyle: "avatar-bl", timedStyle: "avatar-bl" }]);
    expect(result.rules.map((r) => [r.matchType, r.originalDisplayTypeId, r.enabled])).toEqual([["name", "sport", true], ["source", "meeting", true]]);
  });

  it("rejects anything that isn't the settings envelope", () => {
    expect(parseAiImport("not json", connections, existingIds)).toHaveProperty("error");
    expect(parseAiImport(JSON.stringify({ eventTypes: [], rules: [] }), connections, existingIds)).toHaveProperty("error");
    expect(parseAiImport(JSON.stringify({ version: 1, data: {} }), connections, existingIds)).toHaveProperty("error");
    expect(parseAiImport(JSON.stringify({ version: 1, data: { "overcal:rules": { state: { rules: "x" } } } }), connections, existingIds)).toHaveProperty("error");
  });

  it("degrades bad fields to defaults and drops unusable rules with a warning", () => {
    const result = parseAiImport(
      envelope(
        [{ id: "x", label: "X", color: "red", icon: "NotAnIcon", allDayStyle: "huge", timedStyle: "block" }],
        [
          { matchType: "all", matchValue: "", displayTypeId: "x" },
          { matchType: "name", matchValue: "(", displayTypeId: "x" },
          { matchType: "source", matchValue: "invented-id", displayTypeId: "x" },
          { matchType: "name", matchValue: "ok", displayTypeId: "ghost" },
        ],
      ),
      connections,
      existingIds,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.eventTypes[0]).toMatchObject({ color: "#3b82f6", icon: "Calendar", allDayStyle: "block" });
    expect(result.rules).toEqual([]);
    expect(result.warnings).toHaveLength(7);
  });

  it("never re-creates a type the user already has", () => {
    const result = parseAiImport(envelope([{ ...sport, id: "meeting" }], []), connections, existingIds);
    if ("error" in result) throw new Error(result.error);
    expect(result.eventTypes).toEqual([]);
    expect(result.warnings[0]).toContain("existe déjà");
  });
});

describe("schema and code stay in sync", () => {
  it("lists the same display styles and match types the importer accepts", () => {
    expect(schema.$defs.displayStyle.enum).toEqual(DISPLAY_STYLES);
    expect(schema.$defs.rule.properties.matchType.enum).toEqual(["name", "source"]);
    expect(schema.$defs.pattern.enum).toEqual(THEME_PATTERNS.map((p) => p.value));
    expect(Object.keys(schema.properties.data.properties)).toEqual(["overcal:event-types", "overcal:rules", "overcal:presets", "overcal:themes"]);
  });

  it("the prompt's example output parses without warnings", () => {
    const example = AI_RULES_PROMPT.slice(AI_RULES_PROMPT.indexOf("{\n  \"version\""), AI_RULES_PROMPT.indexOf("\n\nContraintes du schéma"))
      .replace("<date ISO 8601>", "2026-09-28T21:00:00.000Z")
      .replaceAll("<id exact d'une de mes sources>", "src-perso")
      .replace("<id d'un type>", "sport");
    const result = parseAiImport(example, connections, existingIds);
    if ("error" in result) throw new Error(result.error);
    expect(result.warnings).toEqual([]);
    expect(result.rules).toHaveLength(2);
    expect(result.presets).toHaveLength(1);
    expect(result.themes).toHaveLength(1);
  });
});

describe("applyAiImport", () => {
  const classique: EventType = { id: "meeting", label: "Classique", color: "#3b82f6", icon: "Users", allDayStyle: "block", timedStyle: "block", isDefault: true };
  const oldType: EventType = { id: "old", label: "Ancien", color: "#000000", icon: "Calendar", allDayStyle: "block", timedStyle: "block" };
  const oldTheme = { id: "t-old", name: "Vieux", mode: "light" as const, accent: "#000000" };

  beforeEach(() => {
    useConnectionStore.setState({ connections });
    useEventTypeStore.setState({ types: [classique, oldType] });
    useRuleStore.setState({ rules: [
      { id: "r-event", matchType: "event", matchValue: "e1", displayTypeId: "old", enabled: true, createdAt: 0 },
      { id: "r-name", matchType: "name", matchValue: "vieux", displayTypeId: "old", enabled: true, createdAt: 0 },
      { id: "r-src", matchType: "source", matchValue: "src-perso", displayTypeId: "old", enabled: true, createdAt: 0 },
      { id: "r-all", matchType: "all", matchValue: "", displayTypeId: "meeting", enabled: true, createdAt: 0 },
    ] });
    usePresetStore.setState({ presets: [{ id: "p-old", name: "Perso", connections: {}, eventTypes: {} }] });
    useThemeStore.setState({ customThemes: [...BUILTIN_THEMES, oldTheme], themeOrder: [...BUILTIN_THEMES.map((t) => t.id), "t-old"], selectedThemeId: "t-old" });
  });

  const json = JSON.stringify({
    version: 1,
    exportedAt: "2026-09-28T21:00:00.000Z",
    data: {
      "overcal:event-types": { version: 0, state: { types: [sport] } },
      "overcal:rules": { version: 0, state: { rules: [{ matchType: "name", matchValue: "bad", displayTypeId: "sport" }] } },
      "overcal:presets": { version: 0, state: { presets: [{ name: "Perso", connections: { "src-perso": false }, eventTypes: { sport: true }, themeId: "soir" }] } },
      "overcal:themes": { version: 0, state: { customThemes: [{ id: "soir", name: "Soir", mode: "dark", accent: "#f59e0b" }] } },
    },
  });

  it("merge adds alongside everything and skips a taken preset name", () => {
    const result = applyAiImport(json, "merge");
    if ("error" in result) throw new Error(result.error);
    expect(useEventTypeStore.getState().types.map((t) => t.id)).toEqual(["meeting", "old", "sport"]);
    expect(useRuleStore.getState().rules.map((r) => r.matchValue)).toEqual(["e1", "bad", "vieux", "src-perso", ""]);
    expect(usePresetStore.getState().presets.map((p) => p.id)).toEqual(["p-old"]);
    expect(useThemeStore.getState().customThemes).toHaveLength(4);
    expect(useThemeStore.getState().selectedThemeId).toBe("t-old");
  });

  it("replace keeps only the undeletable parts plus the AI's version", () => {
    const result = applyAiImport(json, "replace");
    if ("error" in result) throw new Error(result.error);
    expect(useEventTypeStore.getState().types.map((t) => t.id)).toEqual(["meeting", "sport"]);
    // event + name rules dropped; the source rule survives, reset to the default type
    expect(useRuleStore.getState().rules.map((r) => [r.matchValue, r.displayTypeId])).toEqual([["bad", "sport"], ["src-perso", "meeting"], ["", "meeting"]]);
    const themes = useThemeStore.getState();
    const soir = themes.customThemes.find((t) => t.name === "Soir")!;
    expect(themes.customThemes.map((t) => t.id)).toEqual(["light", "dark", soir.id]);
    expect(themes.themeOrder).toEqual(["light", "dark", soir.id]);
    expect(themes.selectedThemeId).toBe(soir.id);
    expect(usePresetStore.getState().presets).toEqual([
      expect.objectContaining({ name: "Perso", connections: { "src-perso": false }, eventTypes: { sport: true }, themeId: soir.id }),
    ]);
  });

  it("replace leaves sections the JSON omits untouched", () => {
    applyAiImport(JSON.stringify({ version: 1, data: { "overcal:themes": { version: 0, state: { customThemes: [] } } } }), "replace");
    expect(useEventTypeStore.getState().types).toHaveLength(2);
    expect(usePresetStore.getState().presets).toHaveLength(1);
    expect(useThemeStore.getState().customThemes.map((t) => t.id)).toEqual(["light", "dark"]);
    expect(useThemeStore.getState().selectedThemeId).toBe("light");
  });
});

describe("buildAiExport", () => {
  const events: CalendarEvent[] = Array.from({ length: 30 }, (_, i) => ({
    id: `e${i}`,
    title: i < 5 ? "Badminton" : `Badminton ${i}`,
    calendarId: "src-perso",
    eventTypeId: "meeting",
    start: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T18:00:00`,
    end: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T19:00:00`,
    allDay: false,
    location: "12 rue Secrète",
    notes: "code porte 1234",
  }));
  const types: EventType[] = [{ id: "meeting", label: "Classique", color: "#3b82f6", icon: "Users", allDayStyle: "block", timedStyle: "block", isDefault: true }];
  const rules: Rule[] = [{ id: "r1", matchType: "all", matchValue: "", displayTypeId: "meeting", enabled: true, createdAt: 0 }];

  const text = buildAiExport(connections, events, types, rules);
  const data = JSON.parse(text.slice(text.indexOf("```json\n") + 8, text.lastIndexOf("\n```")));

  it("starts with the prompt and never leaks URLs, credentials, locations or notes", () => {
    expect(text.startsWith(AI_RULES_PROMPT)).toBe(true);
    for (const secret of ["secret-token", "dav.example.com", "hunter2", "12 rue Secrète", "code porte"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("samples distinct titles per source, capped", () => {
    const perso = data.sources.find((s: { id: string }) => s.id === "src-perso");
    expect(perso.nbEvenements).toBe(30);
    expect(perso.echantillon).toHaveLength(SAMPLE_EVENTS_PER_SOURCE);
    expect(new Set(perso.echantillon.map((e: { title: string }) => e.title)).size).toBe(SAMPLE_EVENTS_PER_SOURCE);
    expect(data.sources.find((s: { id: string }) => s.id === "src-work").echantillon).toEqual([]);
    expect(data.typesExistants[0]).toMatchObject({ id: "meeting", parDefaut: true });
    expect(data.reglesExistantes).toEqual([]);
  });
});
