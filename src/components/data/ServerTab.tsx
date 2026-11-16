"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Server } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { useConnectionStore, useEventTypeStore, usePresetStore, useRuleStore, useServerStore } from "../../store";
import type { Connection, EventType, Preset, Rule } from "../../types";
import { useSourceSync } from "../../context/DataProviderContext";

type Detection = "checking" | "available" | "absent";
interface ServerSource {
  id: string;
  name: string;
  color: string;
}

type TestState =
  | { phase: "idle" }
  | { phase: "testing" }
  | { phase: "ok"; known: number; writable: number; missing: ServerSource[] }
  | { phase: "error"; message: string };

/** Sources the server knows that this device doesn't have yet. */
export function missingSources(server: Record<string, { name: string; color: string }>, localIds: string[]): ServerSource[] {
  return Object.entries(server)
    .filter(([id]) => !localIds.includes(id))
    .map(([id, c]) => ({ id, name: c.name, color: c.color }));
}

async function queryServer(token: string) {
  const now = new Date();
  const params = new URLSearchParams({ from: now.toISOString(), to: new Date(now.getTime() + 86_400_000).toISOString() });
  const res = await fetch(`/api/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error("Jeton refusé par le serveur.");
  if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
  return ((await res.json()) as { connections: Record<string, { name: string; color: string; writable: boolean }> }).connections;
}

/** Entering the admin token makes this page read its calendars from the Overcal server it is served from. */
export function ServerTab() {
  const { token, setToken } = useServerStore();
  const { refresh } = useSourceSync();
  const { connections, addConnection } = useConnectionStore();
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

  async function check(candidate: string, persist: boolean) {
    setTest({ phase: "testing" });
    try {
      const server = await queryServer(candidate);
      const entries = Object.values(server);
      if (persist) setToken(candidate);
      setTest({
        phase: "ok",
        known: entries.length,
        writable: entries.filter((c) => c.writable).length,
        missing: missingSources(server, connections.map((c) => c.id)),
      });
      if (persist) void refresh();
    } catch (err) {
      setTest({ phase: "error", message: err instanceof Error ? err.message : "Connexion impossible." });
    }
  }

  function addMissing(missing: ServerSource[]) {
    for (const m of missing) addConnection({ type: "webcal", id: m.id, name: m.name, color: m.color, url: "", serverOnly: true } as Parameters<typeof addConnection>[0] & { url: string });
    setTest((t) => (t.phase === "ok" ? { ...t, missing: [] } : t));
    void refresh();
  }

  // Already connected: show what the server knows without making the user re-enter the token.
  useEffect(() => {
    if (!token || detection !== "available") return;
    let cancelled = false;
    queryServer(token)
      .then((server) => {
        if (cancelled) return;
        const entries = Object.values(server);
        setTest({
          phase: "ok",
          known: entries.length,
          writable: entries.filter((c) => c.writable).length,
          missing: missingSources(server, useConnectionStore.getState().connections.map((c) => c.id)),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [detection, token]);

  async function pushToServer() {
    if (!window.confirm("Remplacer la configuration du serveur (sources, types, règles, presets) par celle de cet appareil ?")) return;
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          v: 1,
          connections: useConnectionStore.getState().connections,
          eventTypes: useEventTypeStore.getState().types,
          rules: useRuleStore.getState().rules,
          presets: usePresetStore.getState().presets,
        }),
      });
      if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
      toast.success("Configuration envoyée au serveur");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    }
  }

  async function pullFromServer() {
    if (!window.confirm("Remplacer les sources, types, règles et presets de cet appareil par ceux du serveur ?")) return;
    try {
      const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
      const body = (await res.json()) as { connections: Connection[]; eventTypes: EventType[]; rules: Rule[]; presets: Preset[] };
      useConnectionStore.setState({ connections: body.connections });
      useEventTypeStore.setState({ types: body.eventTypes });
      useRuleStore.setState({ rules: body.rules });
      usePresetStore.setState({ presets: body.presets });
      toast.success("Configuration récupérée depuis le serveur");
      setTest({ phase: "idle" });
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Récupération impossible.");
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
            <Button onClick={() => check(draft.trim(), true)} disabled={!draft.trim() || test.phase === "testing"}>
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
          {test.phase === "ok" && test.missing.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm">Absente{test.missing.length > 1 ? "s" : ""} de cet appareil : {test.missing.map((m) => m.name).join(", ")}.</p>
              <Button size="sm" onClick={() => addMissing(test.missing)}>
                Ajouter {test.missing.length > 1 ? `les ${test.missing.length} sources` : "cette source"}
              </Button>
            </div>
          )}
          {test.phase === "error" && (
            <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="size-4" /> {test.message}</p>
          )}
          {token && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-medium">Réglages</p>
              <p className="text-xs text-muted-foreground">Sources, types, règles et presets existent sur cet appareil et sur le serveur. Choisis le sens de la copie ; l&rsquo;autre côté est remplacé.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={pullFromServer}>Récupérer du serveur</Button>
                <Button size="sm" variant="outline" onClick={pushToServer}>Envoyer au serveur</Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Le jeton reste dans ce navigateur. Il n&rsquo;est ni exporté ni synchronisé avec tes réglages.</p>
        </div>
      )}
    </div>
  );
}
