/**
 * Last-write-wins clock for synced settings. Bumped on every mutation to any of the
 * six synced stores (see store/index.ts) so bundle.ts can tell which of two devices'
 * settings is newer. Kept out of the stores themselves and out of Zustand's own
 * `persist` bookkeeping — it's a plain localStorage string, not app state.
 */

export const CLOCK_STORAGE_KEY = "overcal:settings-updated-at";
const KEY = CLOCK_STORAGE_KEY;

/** 0 if never set (fresh install — always loses to an incoming bundle). */
export function getSettingsUpdatedAt(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(KEY)) || 0;
}

export function setSettingsUpdatedAt(ms: number): void {
  if (typeof window !== "undefined") localStorage.setItem(KEY, String(ms));
}

export function bumpSettingsUpdatedAt(): void {
  setSettingsUpdatedAt(Date.now());
}
