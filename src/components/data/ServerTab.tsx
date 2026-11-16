"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Server, Smartphone, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { useConnectionStore, useEventTypeStore, usePresetStore, useRuleStore, useServerStore } from "../../store";
import type { Connection, EventType, Preset, Rule } from "../../types";
import { useSourceSync } from "../../context/DataProviderContext";
import { defaultDeviceName, fetchServerStatus, serverHeaders, type ServerStatus } from "../../lib/server-api";

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
  const res = await fetch(`/api/events?${params}`, { headers: serverHeaders(token) });
  if (res.status === 401) throw new Error("Accès refusé par le serveur.");
  if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
  return ((await res.json()) as { connections: Record<string, { name: string; color: string; writable: boolean }> }).connections;
}

interface Device {
  id: string;
  deviceName: string;
  createdAt: number;
  lastUsedAt: number;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const detail = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
  return detail ?? `${fallback} (HTTP ${res.status}).`;
}

const formatDate = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/**
 * Connects this page to the Overcal server it is served from. First launch: the admin token
 * defines a passphrase. Afterwards each device signs in with the passphrase (or is paired by QR
 * code from an already-connected device) and keeps a session that never expires until revoked.
 * The admin token stays available as an advanced alternative.
 */
export function ServerTab() {
  const { token, setToken, session, setSession } = useServerStore();
  const { refresh } = useSourceSync();
  const { connections, addConnection } = useConnectionStore();
  const [status, setStatus] = useState<ServerStatus | null | "checking">("checking");
  const [draft, setDraft] = useState(token);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [test, setTest] = useState<TestState>({ phase: "idle" });
  const [devices, setDevices] = useState<{ list: Device[]; currentId: string | null } | null>(null);
  const [pairing, setPairing] = useState<{ qr: string; expiresAt: number } | null>(null);

  const linked = Boolean(token) || session;
  const detection: Detection = status === "checking" ? "checking" : status?.enabled ? "available" : "absent";

  const loadStatus = useCallback(async () => {
    const next = await fetchServerStatus();
    setStatus(next);
    if (next?.enabled) setSession(next.authenticated);
    return next;
  }, [setSession]);

  useEffect(() => {
    let cancelled = false;
    void fetchServerStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      if (next?.enabled) useServerStore.getState().setSession(next.authenticated);
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

  // Already connected: show what the server knows without making the user sign in again.
  useEffect(() => {
    if (!linked || detection !== "available") return;
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
  }, [detection, linked, token]);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/sessions", { headers: serverHeaders(useServerStore.getState().token) });
      if (!res.ok) return;
      const body = (await res.json()) as { sessions: Device[]; currentId: string | null };
      setDevices({ list: body.sessions, currentId: body.currentId });
    } catch {
      /* the list is a convenience; the rest of the tab still works */
    }
  }, []);

  useEffect(() => {
    if (!linked || detection !== "available") return;
    queueMicrotask(() => void loadDevices());
  }, [linked, detection, loadDevices]);

  async function authenticate(path: "setup" | "login") {
    setFormError(null);
    if (path === "setup" && passphrase !== confirmation) {
      setFormError("Les deux passphrases ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: serverHeaders(path === "setup" ? draft.trim() : "", { "Content-Type": "application/json" }),
        body: JSON.stringify({ passphrase, deviceName: defaultDeviceName() }),
      });
      if (!res.ok) throw new Error(await readError(res, path === "setup" ? "Définition impossible" : "Connexion impossible"));
      setPassphrase("");
      setConfirmation("");
      setDraft("");
      setSession(true);
      await loadStatus();
      void refresh();
      toast.success(path === "setup" ? "Passphrase définie, cet appareil est connecté" : "Appareil connecté");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (session) await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(false);
    setToken("");
    setDraft("");
    setDevices(null);
    setPairing(null);
    setTest({ phase: "idle" });
    await loadStatus();
    void refresh();
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/auth/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: serverHeaders(token) });
    if (!res.ok) return toast.error(await readError(res, "Révocation impossible"));
    if (id === devices?.currentId) return void logout();
    void loadDevices();
  }

  async function startPairing() {
    try {
      const res = await fetch("/api/auth/pair", { method: "POST", headers: serverHeaders(token) });
      if (!res.ok) throw new Error(await readError(res, "Jumelage impossible"));
      const { code, expiresAt } = (await res.json()) as { code: string; expiresAt: number };
      // The code travels in the URL fragment so it never reaches server or proxy logs.
      const qr = await QRCode.toDataURL(`${window.location.origin}/pair#${code}`, { margin: 1, width: 220 });
      setPairing({ qr, expiresAt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Jumelage impossible.");
    }
  }

  async function pushToServer() {
    if (!window.confirm("Remplacer la configuration du serveur (sources, types, règles, presets) par celle de cet appareil ?")) return;
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: serverHeaders(token, { "Content-Type": "application/json" }),
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
      const res = await fetch("/api/settings", { headers: serverHeaders(token) });
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

  const passphraseSet = status !== "checking" && status?.passphraseSet === true;

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

      {detection === "available" && !linked && (
        <div className="space-y-3">
          {!passphraseSet ? (
            <>
              <p className="text-sm">Premier lancement : choisis une passphrase. Tu pourras ensuite connecter chaque appareil avec elle, sans retaper le jeton d&rsquo;administration.</p>
              <label className="block text-sm font-medium" htmlFor="server-token">Jeton d&rsquo;administration</label>
              <Input id="server-token" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="OVERCAL_ADMIN_TOKEN" />
              <label className="block text-sm font-medium" htmlFor="server-passphrase">Passphrase (10 caractères minimum)</label>
              <Input id="server-passphrase" type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
              <Input aria-label="Confirmer la passphrase" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Confirmer la passphrase" />
              <Button onClick={() => authenticate("setup")} disabled={busy || !draft.trim() || passphrase.length < 10}>
                {busy ? <Loader2 className="animate-spin" /> : <Server />} Définir la passphrase
              </Button>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium" htmlFor="server-passphrase">Passphrase</label>
              <Input
                id="server-passphrase"
                type="password"
                autoComplete="current-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && passphrase && !busy && void authenticate("login")}
              />
              <Button onClick={() => authenticate("login")} disabled={busy || !passphrase}>
                {busy ? <Loader2 className="animate-spin" /> : <Server />} Connecter cet appareil
              </Button>
              <p className="text-xs text-muted-foreground">Déjà connecté sur un autre appareil ? Ouvre Données › Serveur là-bas et scanne le QR code de jumelage.</p>
            </>
          )}
          {formError && <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="size-4" /> {formError}</p>}

          <div className="pt-1">
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowAdmin((v) => !v)}>
              {showAdmin ? "Masquer" : "Utiliser plutôt le jeton d’administration"}
            </button>
            {showAdmin && (
              <div className="mt-2 space-y-2">
                <Input aria-label="Jeton d’administration" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="OVERCAL_ADMIN_TOKEN" />
                <Button variant="outline" onClick={() => check(draft.trim(), true)} disabled={!draft.trim() || test.phase === "testing"}>
                  {test.phase === "testing" ? <Loader2 className="animate-spin" /> : <Server />} Enregistrer et tester
                </Button>
                {test.phase === "error" && <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="size-4" /> {test.message}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {detection === "available" && linked && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground flex items-center gap-2 mr-auto"><Check className="size-4" /> Cet appareil lit depuis le serveur{session ? "" : " (jeton d’administration)"}.</p>
            <Button variant="outline" size="sm" onClick={logout}>Se déconnecter</Button>
          </div>
          {test.phase === "ok" && (
            <p className="text-sm flex items-center gap-2"><Check className="size-4" /> {test.known} source{test.known > 1 ? "s" : ""} connue{test.known > 1 ? "s" : ""} du serveur, dont {test.writable} inscriptible{test.writable > 1 ? "s" : ""}.</p>
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

          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Réglages</p>
            <p className="text-xs text-muted-foreground">Sources, types, règles et presets existent sur cet appareil et sur le serveur. Choisis le sens de la copie ; l&rsquo;autre côté est remplacé.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={pullFromServer}>Récupérer du serveur</Button>
              <Button size="sm" variant="outline" onClick={pushToServer}>Envoyer au serveur</Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Appareils connectés</p>
            {devices && devices.list.length > 0 ? (
              <ul className="space-y-1">
                {devices.list.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <Smartphone className="size-4 text-muted-foreground" />
                    <span className="mr-auto">{d.deviceName}{d.id === devices.currentId ? " (cet appareil)" : ""} <span className="text-xs text-muted-foreground">· depuis le {formatDate(d.createdAt)}</span></span>
                    <Button variant="ghost" size="icon" aria-label={`Révoquer ${d.deviceName}`} onClick={() => revoke(d.id)}><Trash2 className="size-4" /></Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune session ouverte par passphrase.</p>
            )}
            {passphraseSet && (
              <div className="pt-1 space-y-2">
                <Button size="sm" variant="outline" onClick={startPairing}>Jumeler un autre appareil</Button>
                {pairing && (
                  <div className="space-y-1">
                    <img src={pairing.qr} alt="QR code de jumelage" width={220} height={220} className="rounded-md border border-border bg-white" />
                    <p className="text-xs text-muted-foreground">Scanne-le avec l&rsquo;autre appareil. Valable 5 minutes, à usage unique.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">La session reste dans un cookie de ce navigateur et n’expire pas : révoque-la ici si l&rsquo;appareil est perdu. Rien n&rsquo;est exporté ni synchronisé avec tes réglages.</p>
        </div>
      )}
    </div>
  );
}
