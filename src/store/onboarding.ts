import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storage } from "./storage";

// ── Onboarding Store ──────────────────────────────────────────────────────────
// Only what can't be derived from the other stores — see lib/onboarding.ts for how
// each "Bien démarrer" step is ticked from their state.
interface OnboardingStore {
  /** User clicked "Masquer": the Help drawer stops opening itself on a fresh instance. */
  dismissed: boolean;
  /** An AI settings import succeeded at least once (not derivable from the imported data). */
  aiImported: boolean;
  setDismissed: (v: boolean) => void;
  markAiImported: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      dismissed: false,
      aiImported: false,
      setDismissed: (dismissed) => set({ dismissed }),
      markAiImported: () => set({ aiImported: true }),
    }),
    { name: "overcal:onboarding", storage }
  )
);
