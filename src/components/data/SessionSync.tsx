"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useServerStore } from "../../store";
import { fetchServerStatus } from "../../lib/server-api";
import { useSourceSync } from "../../context/DataProviderContext";
import { pullSettings, pushDirty, watchLocalChanges } from "../../lib/sync/server-settings";

/**
 * Keeps this browser linked to the Overcal server it is served from: mirrors "I hold a valid
 * device session" into the store on load, and — once linked — makes the server the source of
 * truth for settings (pull on start, push each edit, adopt the server's value on conflict).
 */
export function SessionSync() {
  const { refresh } = useSourceSync();
  const { token, session } = useServerStore();

  useEffect(() => {
    let cancelled = false;
    void fetchServerStatus().then((status) => {
      if (cancelled || !status) return;
      const authenticated = status.enabled && status.authenticated;
      if (useServerStore.getState().session !== authenticated) {
        useServerStore.getState().setSession(authenticated);
        void refresh();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linked = Boolean(token) || session;
  useEffect(() => {
    if (!linked) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void (async () => {
      const changed = await pullSettings(token);
      if (cancelled || changed === null) return; // no versioned settings on this origin
      if (changed.includes("connections")) void refresh();
      await pushDirty(token);
      if (cancelled) return;
      stop = watchLocalChanges(token, () => toast.info("Réglages modifiés ailleurs : la version du serveur a été appliquée."));
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, token]);

  return null;
}
