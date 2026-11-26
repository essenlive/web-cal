import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storage } from "./storage";

// ── Server Store ──────────────────────────────────────────────────────────────
// How this browser reaches an Overcal server: its URL ("" = the server that serves this page) and the
// device session it holds there. Deliberately not part of the exported/synced settings bundle: these are
// credentials for this browser only. The admin token is never kept here: it is typed once to define the
// passphrase, then forgotten.
interface ServerStore {
  /** Base URL of the Overcal server, without trailing slash. "" = same origin as this page. */
  serverUrl: string;
  setServerUrl: (url: string) => void;
  /** Device-session token, sent as a bearer: works across origins, unlike the cookie. */
  sessionToken: string;
  setSessionToken: (token: string) => void;
  /** Same-origin only: the httpOnly session cookie is valid (mirrored here as a flag only). */
  session: boolean;
  setSession: (session: boolean) => void;
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      serverUrl: "",
      setServerUrl: (serverUrl) => set({ serverUrl, sessionToken: "", session: false }),
      sessionToken: "",
      setSessionToken: (sessionToken) => set({ sessionToken }),
      session: false,
      setSession: (session) => set({ session }),
    }),
    {
      name: "overcal:server",
      storage,
      version: 1,
      // v0 kept the admin token here; it no longer lives in the client.
      migrate: (persisted) => {
        const { token: _token, ...rest } = (persisted ?? {}) as Record<string, unknown>;
        void _token;
        return rest as unknown as ServerStore;
      },
    }
  )
);

/** What every call to the server needs: where it is, and the bearer to present (if any). */
export function serverConnection() {
  const { serverUrl, sessionToken, session } = useServerStore.getState();
  return { base: serverUrl, token: sessionToken, linked: Boolean(sessionToken) || (serverUrl === "" && session) };
}
