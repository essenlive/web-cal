/**
 * Whole-settings snapshot: capture/apply for export, import, and P2P sync alike (one
 * bundle format for all three — see specs/.../plan.md). Synced as one atomic unit,
 * not per-store, because `presets` references `connections`/`eventTypes` ids —
 * applying stores independently risks dangling references.
 *
 * Deliberately excludes `useEventsStore` (a re-fetched cache, not a setting) and the
 * session-local half of `useUIStore` (currentDate, sidebarOpen, activeDrawer).
 */

import type { CalendarView, Connection, EventType, Preset, Rule, Theme } from "../../types";
import { useConnectionStore, useEventTypeStore, useRuleStore, usePresetStore, useThemeStore, useUIStore } from "../../store";
import { getSettingsUpdatedAt, setSettingsUpdatedAt } from "./clock";

export const BUNDLE_VERSION = 1;

export interface SettingsBundle {
  v: typeof BUNDLE_VERSION;
  /** Epoch ms this snapshot was captured at — see clock.ts. */
  updatedAt: number;
  connections: Connection[];
  eventTypes: EventType[];
  rules: Rule[];
  presets: Preset[];
  ui: {
    view: CalendarView;
    weekStartsOnMonday: boolean;
    use24h: boolean;
    dateFormatEU: boolean;
    collapsedSections: Record<string, boolean>;
  };
  themes: {
    customThemes: Theme[];
    selectedThemeId: string;
    themeOrder: string[];
  };
}

export function captureBundle(): SettingsBundle {
  const ui = useUIStore.getState();
  const themes = useThemeStore.getState();
  return {
    v: BUNDLE_VERSION,
    updatedAt: getSettingsUpdatedAt(),
    connections: useConnectionStore.getState().connections,
    eventTypes: useEventTypeStore.getState().types,
    rules: useRuleStore.getState().rules,
    presets: usePresetStore.getState().presets,
    ui: {
      view: ui.view,
      weekStartsOnMonday: ui.weekStartsOnMonday,
      use24h: ui.use24h,
      dateFormatEU: ui.dateFormatEU,
      collapsedSections: ui.collapsedSections,
    },
    themes: {
      customThemes: themes.customThemes,
      selectedThemeId: themes.selectedThemeId,
      themeOrder: themes.themeOrder,
    },
  };
}

/** Loose shape check — enough to reject a JSON file that isn't a settings bundle at all, not a full schema. */
export function isSettingsBundle(value: unknown): value is SettingsBundle {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    b.v === BUNDLE_VERSION &&
    Array.isArray(b.connections) &&
    Array.isArray(b.eventTypes) &&
    Array.isArray(b.rules) &&
    Array.isArray(b.presets) &&
    typeof b.ui === "object" &&
    typeof b.themes === "object"
  );
}

/**
 * Replaces the six synced stores' state wholesale. Called only after the caller has
 * confirmed with the user — this overwrites local settings, never applied silently.
 */
export function applyBundle(bundle: SettingsBundle): void {
  useConnectionStore.setState({ connections: bundle.connections });
  useEventTypeStore.setState({ types: bundle.eventTypes });
  useRuleStore.setState({ rules: bundle.rules });
  usePresetStore.setState({ presets: bundle.presets });
  useUIStore.setState(bundle.ui);
  useThemeStore.setState(bundle.themes);
  // Runs last: each setState above triggers store/index.ts's "bump clock to now"
  // subscriber, which this overrides with the bundle's own timestamp so the clock
  // reflects when the data was actually last edited, not when it was imported.
  setSettingsUpdatedAt(bundle.updatedAt);
}
