"use client";

import { useEffect } from "react";
import { useServerStore } from "../../store";
import { fetchServerStatus } from "../../lib/server-api";
import { useSourceSync } from "../../context/DataProviderContext";

/** On load, mirrors "this browser holds a valid server session" into the store so a paired device reads from the server without an admin token. */
export function SessionSync() {
  const { refresh } = useSourceSync();
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
  return null;
}
