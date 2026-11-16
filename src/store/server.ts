import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storage } from "./storage";

// ── Server Store ──────────────────────────────────────────────────────────────
// The credentials of the Overcal server this page is served from: the admin token and/or a device session flag. Deliberately not part of
// the exported/synced settings bundle: it is a credential for this browser only.
interface ServerStore {
  token: string;
  setToken: (token: string) => void;
  /** This browser holds a valid device session (httpOnly cookie, mirrored here as a flag only). */
  session: boolean;
  setSession: (session: boolean) => void;
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      token: "",
      setToken: (token) => set({ token: token.trim() }),
      session: false,
      setSession: (session) => set({ session }),
    }),
    { name: "overcal:server", storage }
  )
);
