/**
 * "Bien démarrer" checklist (HelpPanel): which steps are done, derived from the stores'
 * current state rather than tracked separately — deleting a type un-ticks its step, and
 * an imported settings file ticks whatever it contains. Only the AI step needs its own
 * flag (useOnboardingStore.aiImported).
 */
import type { Connection, EventType, Preset, Rule, Theme } from "../types";
import type { DrawerPanel } from "../store";

export const DEMO_CONNECTION_ID = "demo";

export type OnboardingStepId = "source" | "removeDemo" | "type" | "rule" | "preset" | "theme" | "ai";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  done: boolean;
  /** Bonus steps don't count toward "C'est prêt". */
  bonus: boolean;
  /** Hidden until it makes sense (removeDemo: only once a real source exists and the demo is still there). */
  visible: boolean;
  /** Drawer whose new-item form completes the step (GettingStarted's "Commencer"). */
  panel?: DrawerPanel;
}

export interface OnboardingState {
  connections: Connection[];
  types: EventType[];
  rules: Rule[];
  presets: Preset[];
  customThemes: Theme[];
  selectedThemeId: string;
  aiImported: boolean;
}

export function onboardingSteps(s: OnboardingState, seededTypeIds: ReadonlySet<string>, builtinThemeIds: ReadonlySet<string>): OnboardingStep[] {
  const hasDemo = s.connections.some((c) => c.id === DEMO_CONNECTION_ID);
  const hasRealSource = s.connections.some((c) => c.id !== DEMO_CONNECTION_ID);
  return [
    { id: "source", title: "Ajouter une source", done: hasRealSource, bonus: false, visible: true, panel: "connection" },
    { id: "removeDemo", title: "Supprimer la source Démo", done: !hasDemo, bonus: true, visible: hasRealSource && hasDemo },
    { id: "type", title: "Créer un type d'affichage", done: s.types.some((t) => !seededTypeIds.has(t.id)), bonus: false, visible: true, panel: "eventType" },
    // Seeded demo rules have ids "seed-…"; source/catch-all rules are auto-created, not the user's.
    { id: "rule", title: "Créer une règle", done: s.rules.some((r) => (r.matchType === "name" || r.matchType === "event") && !r.id.startsWith("seed-")), bonus: false, visible: true, panel: "rules" },
    { id: "preset", title: "Enregistrer un preset", done: s.presets.length > 0, bonus: true, visible: true, panel: "preset" },
    { id: "theme", title: "Personnaliser le thème", done: s.selectedThemeId !== "light" || s.customThemes.some((t) => !builtinThemeIds.has(t.id)), bonus: true, visible: true, panel: "theme" },
    { id: "ai", title: "Générer ses réglages avec l'IA", done: s.aiImported, bonus: true, visible: true },
  ];
}

/** Core steps (not bonus) all done — the toast's trigger. */
export const coreDone = (steps: OnboardingStep[]) => steps.filter((s) => !s.bonus).every((s) => s.done);

/** A fresh instance: nothing but the seeded demo source. Drives the Help drawer's auto-open. */
export const isFreshInstance = (connections: Connection[]) => connections.every((c) => c.id === DEMO_CONNECTION_ID);
