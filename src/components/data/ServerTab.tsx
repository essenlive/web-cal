"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Server, Smartphone, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { useConnectionStore, useServerStore } from "../../store";
import { useSourceSync } from "../../context/DataProviderContext";
import { BackendError, ServerBackend } from "../../lib/backend";
import { defaultDeviceName, fetchServerStatus, normalizeServerUrl, serverHeaders, type ServerStatus } from "../../lib/server-api";

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

async function queryServer(token: string, base: string) {
  const now = new Date();
  try {
    return await new ServerBackend(token, base).events(now, new Date(now.getTime() + 86_400_000));
  } catch (err) {
    if (err instanceof BackendError && err.status === 401) throw new Error("Accès refusé par le serveur.", { cause: err });
    if (err instanceof BackendError) throw new Error(`Le serveur a répondu HTTP ${err.status}.`, { cause: err });
    throw err;
  }
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
 * Connects this browser to an Overcal server: the one serving this page (empty URL) or any other
 * reachable one (its URL). First launch: the admin token, typed once and never stored, defines a
 * passphrase. Afterwards each device signs in with the passphrase (or is paired by QR code from an
 * already-connected device) and keeps a bearer session that never expires until revoked.
 */
export function ServerTab() {
  const { serverUrl, setServerUrl, sessionToken, setSessionToken, session, setSession } = useServerStore();
  const token = sessionToken;
  const base = serverUrl;
  const { refresh } = useSourceSync();
  const { addConnection } = useConnectionStore();
  const [status, setStatus] = useState<ServerStatus | null | "checking">("checking");
  const [draft, setDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ phase: "idle" });
  const [devices, setDevices] = useState<{ list: Device[]; currentId: string | null } | null>(null);
  const [pairing, setPairing] = useState<{ qr: string; expiresAt: number } | null>(null);

  const linked = Boolean(token) || (base === "" && session);
  const detection: Detection = status === "checking" ? "checking" : status?.enabled ? "available" : "absent";

  const loadStatus = useCallback(async () => {
    const { serverUrl: b, sessionToken: t } = useServerStore.getState();
    const next = await fetchServerStatus(b, t);
    setStatus(next);
    if (next?.enabled && b === "") setSession(next.authenticated);
    return next;
  }, [setSession]);

  useEffect(() => {
    let cancelled = false;
    const { serverUrl: b, sessionToken: t } = useServerStore.getState();
    void fetchServerStatus(b, t).then((next) => {
      if (cancelled) return;
      setStatus(next);
      if (next?.enabled && b === "") useServerStore.getState().setSession(next.authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyUrl() {
    const normalized = normalizeServerUrl(urlDraft);
    if (normalized === null) return setUrlError("Adresse invalide : attendu http(s)://hôte.");
    setUrlError(null);
    if (normalized !== serverUrl) {
      setServerUrl(normalized);
      setTest({ phase: "idle" });
      setDevices(null);
      setPairing(null);
    }
    setUrlDraft(normalized);
    setStatus("checking");
    const next = await loadStatus();
    if (!next) setUrlError("Serveur injoignable (adresse, CORS_ORIGINS côté serveur, ou contenu mixte http/https).");
    void refresh();
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
    queryServer(token, base)
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
  }, [detection, linked, token, base]);

  const loadDevices = useCallback(async () => {
    try {
      const { serverUrl: b, sessionToken: t } = useServerStore.getState();
      const res = await fetch(`${b}/api/auth/sessions`, { headers: serverHeaders(t) });
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
      const res = await fetch(`${base}/api/auth/${path}`, {
        method: "POST",
        headers: serverHeaders(path === "setup" ? draft.trim() : "", { "Content-Type": "application/json" }),
        body: JSON.stringify({ passphrase, deviceName: defaultDeviceName() }),
      });
      if (!res.ok) throw new Error(await readError(res, path === "setup" ? "Définition impossible" : "Connexion impossible"));
      setPassphrase("");
      setConfirmation("");
      setDraft("");
      const body = (await res.json().catch(() => null)) as { token?: string } | null;
      if (body?.token) setSessionToken(body.token);
      if (base === "") setSession(true);
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
    if (linked) await fetch(`${base}/api/auth/logout`, { method: "POST", headers: serverHeaders(token) }).catch(() => {});
    setSession(false);
    setSessionToken("");
    setDraft("");
    setDevices(null);
    setPairing(null);
    setTest({ phase: "idle" });
    await loadStatus();
    void refresh();
  }

  async function revoke(id: string) {
    const res = await fetch(`${base}/api/auth/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: serverHeaders(token) });
    if (!res.ok) return toast.error(await readError(res, "Révocation impossible"));
    if (id === devices?.currentId) return void logout();
    void loadDevices();
  }

  async function startPairing() {
    try {
      const res = await fetch(`${base}/api/auth/pair`, { method: "POST", headers: serverHeaders(token) });
      if (!res.ok) throw new Error(await readError(res, "Jumelage impossible"));
      const { code, expiresAt } = (await res.json()) as { code: string; expiresAt: number };
      // The code travels in the URL fragment so it never reaches server or proxy logs.
      const qr = await QRCode.toDataURL(`${base || window.location.origin}/pair#${code}`, { margin: 1, width: 220 });
      setPairing({ qr, expiresAt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Jumelage impossible.");
    }
  }

  const passphraseSet = status !== "checking" && status?.passphraseSet === true;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Connecte cette application à un serveur Overcal : celui qui sert cette page, ou n&rsquo;importe quel autre. Tes calendriers sont alors lus depuis ses données déjà agrégées. Les sources inconnues du serveur continuent d&rsquo;être lues directement.
      </p>

      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="server-url">Adresse du serveur</label>
        <div className="flex gap-2">
          <Input
            id="server-url"
            inputMode="url"
            autoComplete="off"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void applyUrl()}
            placeholder="vide = ce site, ou https://cal.exemple.fr"
          />
          <Button variant="outline" onClick={() => void applyUrl()}>Vérifier</Button>
        </div>
        {urlError && <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="size-4" /> {urlError}</p>}
        {urlDraft.trim() && urlDraft.trim().startsWith("http:") && typeof window !== "undefined" && window.location.protocol === "https:" && (
          <p className="text-xs text-muted-foreground">Une page https ne peut pas joindre un serveur http : utilise une adresse https.</p>
        )}
      </div>

      {detection === "checking" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Recherche du serveur…</p>
      )}
      {detection === "absent" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Server className="size-4" /> Aucun serveur Overcal détecté{base ? " à cette adresse" : " sur ce site"} : l&rsquo;application lit les calendriers directement.</p>
      )}

      {detection === "available" && !linked && (
        <div className="space-y-3">
          {!passphraseSet ? (
            <>
              <p className="text-sm">Premier lancement : choisis une passphrase. Le jeton d&rsquo;administration n&rsquo;est demandé que cette fois et n&rsquo;est pas conservé : ensuite chaque appareil se connecte avec la passphrase.</p>
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
        </div>
      )}

      {detection === "available" && linked && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground flex items-center gap-2 mr-auto"><Check className="size-4" /> Cet appareil lit depuis le serveur{base ? ` ${base}` : ""}.</p>
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

          <p className="text-xs text-muted-foreground">Sources, types, règles, presets et thèmes sont synchronisés automatiquement avec le serveur, qui fait foi : toute modification est envoyée, et si un autre appareil a modifié la même rubrique entre-temps, sa version est appliquée ici.</p>

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
          <p className="text-xs text-muted-foreground">La session reste dans ce navigateur et n’expire pas : révoque-la ici si l&rsquo;appareil est perdu.</p>
        </div>
      )}
    </div>
  );
}
