import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storage } from "./storage";

// ── Onboarding Store ──────────────────────────────────────────────────────────
// Only what can't be derived from the other stores — see lib/onboarding.ts for how
// each "Bien démarrer" step is ticked from their state.
interface OnboardingStore {
  /** User clicked "Masquer": the Help drawer stops opening itself on a fresh instance. */
  dismissed: boolean;
  setDismissed: (v: boolean) => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      dismissed: false,
      setDismissed: (dismissed) => set({ dismissed }),
    }),
    { name: "overcal:onboarding", storage }
  )
);
