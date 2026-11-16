"use client";

import { useEffect, useState } from "react";
import { useServerStore } from "../../store";
import { defaultDeviceName } from "../../lib/server-api";

/** Landing page of the pairing QR code: /pair#<one-time code>. Exchanges the code for a device session, then opens the calendar. */
export default function PairPage() {
  const [message, setMessage] = useState("Jumelage en cours…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = window.location.hash.slice(1);
    // Drop the code from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      queueMicrotask(() => {
        setFailed(true);
        setMessage("Aucun code de jumelage dans ce lien.");
      });
      return;
    }
    fetch("/api/auth/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, deviceName: defaultDeviceName() }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const detail = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
          throw new Error(detail ?? `Erreur HTTP ${res.status}`);
        }
        useServerStore.getState().setSession(true);
        window.location.replace("/");
      })
      .catch((err: unknown) => {
        setFailed(true);
        setMessage(err instanceof Error ? err.message : "Jumelage impossible.");
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="space-y-2">
        <p className={failed ? "text-destructive" : "text-muted-foreground"}>{message}</p>
        {failed && <a href="/" className="text-sm underline">Retour au calendrier</a>}
      </div>
    </main>
  );
}
