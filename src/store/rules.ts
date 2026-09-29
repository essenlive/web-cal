import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Rule, RuleMatchType } from "../types";
import { storage } from "./storage";
import { DEFAULT_EVENT_TYPES } from "./event-types";

// ── Rule Store ─────────────────────────────────────────────────────────────────

/** Lower = matched/prioritized first. "all" (catch-all) always sorts last. Used only to place new rules at their default position. */
function tierOf(matchType: RuleMatchType): number {
  if (matchType === "event") return 0;
  if (matchType === "name") return 1;
  if (matchType === "source") return 2;
  return 3; // "all" — catch-all
}

/** Ensures exactly one matchType:"all" (catch-all) rule exists, appending one if missing. */
function seedCatchAllRule(rules: Rule[]): Rule[] {
  if (rules.some((r) => r.matchType === "all")) return rules;
  const catchAll: Rule = {
    id: crypto.randomUUID(),
    matchType: "all",
    matchValue: "",
    displayTypeId: DEFAULT_EVENT_TYPES.find((t) => t.isDefault)?.id ?? DEFAULT_EVENT_TYPES[0].id,
    enabled: true,
    createdAt: 0,
  };
  return [...rules, catchAll];
}

/**
 * First-run-only rule set: a handful of illustrative name-pattern rules matching the
 * demo events in mock-seed.ts, so a fresh install (no connections, no rules yet) shows
 * the rules engine actually differentiating event types instead of one flat color.
 * Only used as useRuleStore's initial state — never re-applied to an already-persisted
 * store (see onRehydrateStorage below, which only tops up the catch-all).
 */
function seedDemoRules(): Rule[] {
  const demo: Omit<Rule, "id" | "enabled">[] = [
    { matchType: "name", matchValue: "Rendu|Livraison", displayTypeId: "deadline", createdAt: 1 },
    { matchType: "name", matchValue: "Atelier|Workshop|Conf", displayTypeId: "workshop", createdAt: 2 },
    { matchType: "name", matchValue: "Focus", displayTypeId: "focus-time", createdAt: 3 },
    { matchType: "name", matchValue: "Admin", displayTypeId: "admin", createdAt: 4 },
    { matchType: "name", matchValue: "Apéro|Cinéma|Dîner|Vacances", displayTypeId: "social", createdAt: 5 },
  ];
  return seedCatchAllRule(demo.map((r) => ({ ...r, id: `seed-${r.displayTypeId}`, enabled: true })));
}

interface RuleStore {
  /** Array order IS priority — index 0 matches first. The catch-all (matchType:"all") rule is always last. */
  rules: Rule[];
  addRule: (r: Omit<Rule, "id" | "createdAt" | "enabled"> & { enabled?: boolean }) => void;
  updateRule: (r: Rule) => void;
  /** No-op for the catch-all rule — it cannot be deleted. */
  removeRule: (id: string) => void;
  /** No-op for the catch-all rule; otherwise clamps so it can never be reordered above the catch-all. */
  reorderRule: (id: string, toIndex: number) => void;
  /** No-op for the catch-all rule — it is always enabled. */
  toggleRule: (id: string) => void;
  removeRulesForConnection: (connectionId: string) => void;
}

export const useRuleStore = create<RuleStore>()(
  persist(
    (set) => ({
      rules: seedDemoRules(),
      addRule: (r) =>
        set((s) => {
          const rule: Rule = { ...r, id: crypto.randomUUID(), createdAt: Date.now(), enabled: r.enabled ?? true };
          const tier = tierOf(rule.matchType);
          // Insert at the top of its tier's block (default: newest-first within a tier,
          // event-id rules above name-pattern rules above source rules above the catch-all).
          const insertAt = s.rules.findIndex((x) => tierOf(x.matchType) >= tier);
          const rules = insertAt === -1 ? [...s.rules, rule] : [...s.rules.slice(0, insertAt), rule, ...s.rules.slice(insertAt)];
          return { rules };
        }),
      // The catch-all rule's displayTypeId is vestigial — it always resolves to the
      // default EventType (see resolveEventType), which is set via setDefaultType instead.
      updateRule: (r) =>
        set((s) => ({
          rules: s.rules.map((x) => (x.id === r.id && x.matchType !== "all" ? r : x)),
        })),
      removeRule: (id) =>
        set((s) => {
          const rule = s.rules.find((x) => x.id === id);
          if (!rule || rule.matchType === "all") return s;
          return { rules: s.rules.filter((x) => x.id !== id) };
        }),
      reorderRule: (id, toIndex) =>
        set((s) => {
          const idx = s.rules.findIndex((x) => x.id === id);
          if (idx === -1 || s.rules[idx].matchType === "all") return s;
          const rules = [...s.rules];
          const [item] = rules.splice(idx, 1);
          const catchAllIdx = rules.findIndex((x) => x.matchType === "all");
          const maxIndex = catchAllIdx === -1 ? rules.length : catchAllIdx;
          rules.splice(Math.min(toIndex, maxIndex), 0, item);
          return { rules };
        }),
      toggleRule: (id) =>
        set((s) => ({
          rules: s.rules.map((x) => (x.id === id && x.matchType !== "all" ? { ...x, enabled: !x.enabled } : x)),
        })),
      removeRulesForConnection: (connectionId) =>
        set((s) => ({
          rules: s.rules.filter((x) => !(x.matchType === "source" && x.matchValue === connectionId)),
        })),
    }),
    {
      name: "overcal:rules",
      storage,
      onRehydrateStorage: () => (state) => {
        if (state) state.rules = seedCatchAllRule(state.rules);
      },
    }
  )
);
