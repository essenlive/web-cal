import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storage } from "./storage";

// ── Server Store ──────────────────────────────────────────────────────────────
// The admin token of the Overcal server this page is served from. Deliberately not part of
// the exported/synced settings bundle: it is a credential for this browser only.
interface ServerStore {
  token: string;
  setToken: (token: string) => void;
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      token: "",
      setToken: (token) => set({ token: token.trim() }),
    }),
    { name: "overcal:server", storage }
  )
);
