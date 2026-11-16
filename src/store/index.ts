/**
 * Zustand stores, one file each, persisted to localStorage via ./storage. This index
 * re-exports them (app code imports from "store" only) and wires the sync clock below.
 */
import { bumpSettingsUpdatedAt } from "../lib/sync/clock";
import { useConnectionStore } from "./connections";
import { useEventTypeStore } from "./event-types";
import { useRuleStore } from "./rules";
import { usePresetStore } from "./presets";
import { useThemeStore } from "./themes";
import { useUIStore } from "./ui";

export * from "./connections";
export * from "./event-types";
export * from "./rules";
export * from "./presets";
export * from "./onboarding";
export * from "./server";
export * from "./events";
export * from "./ui";
export * from "./themes";


/**
 * Every localStorage key the /data page's Reset action clears. Excludes
 * overcal:event-cache: not a setting, just re-fetchable data.
 */
export const SETTINGS_STORAGE_KEYS = [
  "overcal:connections",
  "overcal:event-types",
  "overcal:rules",
  "overcal:presets",
  "overcal:ui",
  "overcal:themes",
  // Not synced, but a reset instance should get the "Bien démarrer" checklist back.
  "overcal:onboarding",
];

// ── Sync clock wiring ────────────────────────────────────────────────────────
//
// Bumps overcal:settings-updated-at (see lib/sync/clock.ts) on every genuine
// mutation to a synced store, for the /data page's Sync tab to pick the newer
// of two devices' settings on pairing. Subscribing here — after every store has
// already been created (imported above) — is safe without any "was this the initial
// hydration?" guard: persist's hydrate() reads from plain localStorage, which
// is synchronous, so zustand's internal toThenable() resolves the whole
// rehydration (including notifying subscribers) synchronously during each
// create() call, before this code ever runs. So the one setState this
// would otherwise wrongly count as an edit has always already happened by the
// time we get here, and every subscribe() below only ever sees real mutations.
if (typeof window !== "undefined") {
  for (const store of [useConnectionStore, useEventTypeStore, useRuleStore, usePresetStore, useThemeStore]) {
    store.subscribe(bumpSettingsUpdatedAt);
  }
  // useUIStore also holds session-local fields (currentDate, sidebarOpen, activeDrawer,
  // ...) that change on ordinary navigation and must NOT count as a settings edit — only
  // bump for the same subset useUIStore's own `partialize` persists.
  useUIStore.subscribe((state, prev) => {
    if (
      state.view !== prev.view ||
      state.weekStartsOnMonday !== prev.weekStartsOnMonday ||
      state.use24h !== prev.use24h ||
      state.dateFormatEU !== prev.dateFormatEU ||
      state.timezone !== prev.timezone ||
      state.collapsedSections !== prev.collapsedSections
    ) {
      bumpSettingsUpdatedAt();
    }
  });
}
