import { createJSONStorage, type StateStorage } from "zustand/middleware";

// Next.js server-renders "use client" components once for the initial HTML,
// where `localStorage` doesn't exist — fall back to a no-op store there.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
export const storage = createJSONStorage(() => (typeof window !== "undefined" ? localStorage : noopStorage));
