"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Server } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useServerStore } from "../../store";
import { useSourceSync } from "../../context/DataProviderContext";

type Detection = "checking" | "available" | "absent";
type TestState =
  | { phase: "idle" }
  | { phase: "testing" }
  | { phase: "ok"; known: number; writable: number }
  | { phase: "error"; message: string };

/** Entering the admin token makes this page read its calendars from the Overcal server it is served from. */
export function ServerTab() {
  const { token, setToken } = useServerStore();
  const { refresh } = useSourceSync();
  const [draft, setDraft] = useState(token);
  const [detection, setDetection] = useState<Detection>("checking");
  const [test, setTest] = useState<TestState>({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/server/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { enabled?: boolean } | null) => {
        if (!cancelled) setDetection(body?.enabled ? "available" : "absent");
      })
      .catch(() => {
        if (!cancelled) setDetection("absent");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    const candidate = draft.trim();
    setTest({ phase: "testing" });
    try {
      const now = new Date();
      const params = new URLSearchParams({ from: now.toISOString(), to: new Date(now.getTime() + 86_400_000).toISOString() });
      const res = await fetch(`/api/events?${params}`, { headers: { Authorization: `Bearer ${candidate}` } });
      if (res.status === 401) throw new Error("Jeton refusé par le serveur.");
      if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
      const body = (await res.json()) as { connections: Record<string, { writable: boolean }> };
      const entries = Object.values(body.connections);
      setToken(candidate);
      setTest({ phase: "ok", known: entries.length, writable: entries.filter((c) => c.writable).length });
      void refresh();
    } catch (err) {
      setTest({ phase: "error", message: err instanceof Error ? err.message : "Connexion impossible." });
    }
  }

  function disconnect() {
    setToken("");
    setDraft("");
    setTest({ phase: "idle" });
    void refresh();
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Si cette page est servie par un serveur Overcal, tes calendriers peuvent être lus depuis ses données déjà agrégées, sans passer par le relais du navigateur. Les sources inconnues du serveur continuent d&rsquo;être lues directement.
      </p>

      {detection === "checking" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Recherche du serveur…</p>
      )}
      {detection === "absent" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Server className="size-4" /> Aucun serveur Overcal détecté sur cette adresse : l&rsquo;application lit les calendriers directement.</p>
      )}

      {detection === "available" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="server-token">Jeton d&rsquo;administration</label>
          <Input
            id="server-token"
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="OVERCAL_ADMIN_TOKEN"
          />
          <div className="flex gap-2">
            <Button onClick={save} disabled={!draft.trim() || test.phase === "testing"}>
              {test.phase === "testing" ? <Loader2 className="animate-spin" /> : <Server />} Enregistrer et tester
            </Button>
            {token && <Button variant="outline" onClick={disconnect}>Se déconnecter</Button>}
          </div>
          {token && test.phase === "idle" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Check className="size-4" /> Cet appareil lit depuis le serveur.</p>
          )}
          {test.phase === "ok" && (
            <p className="text-sm flex items-center gap-2"><Check className="size-4" /> Connecté : {test.known} source{test.known > 1 ? "s" : ""} connue{test.known > 1 ? "s" : ""} du serveur, dont {test.writable} inscriptible{test.writable > 1 ? "s" : ""}.</p>
          )}
          {test.phase === "error" && (
            <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="size-4" /> {test.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Le jeton reste dans ce navigateur. Il n&rsquo;est ni exporté ni synchronisé avec tes réglages.</p>
        </div>
      )}
    </div>
  );
}
