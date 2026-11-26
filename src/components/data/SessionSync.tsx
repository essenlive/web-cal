"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useServerStore } from "../../store";
import { fetchServerStatus } from "../../lib/server-api";
import { useSourceSync } from "../../context/DataProviderContext";
import { useBackend } from "../../lib/backend";
import { pullSettings, pushDirty, watchLocalChanges } from "../../lib/sync/server-settings";

/**
 * Keeps this browser linked to the Overcal server it is served from: mirrors "I hold a valid
 * device session" into the store on load, and — once linked — makes the server the source of
 * truth for settings (pull on start, push each edit, adopt the server's value on conflict).
 */
export function SessionSync() {
  const { refresh } = useSourceSync();
  const backend = useBackend();

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

  useEffect(() => {
    if (!backend) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void (async () => {
      const changed = await pullSettings(backend);
      if (cancelled || changed === null) return; // no versioned settings on this origin
      if (changed.includes("connections")) void refresh();
      await pushDirty(backend);
      if (cancelled) return;
      stop = watchLocalChanges(backend, () => toast.info("Réglages modifiés ailleurs : la version du serveur a été appliquée."));
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  return null;
}
