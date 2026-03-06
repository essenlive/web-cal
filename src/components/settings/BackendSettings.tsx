import { useState } from "react";
import { Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { useBackendStore, useEventsStore, type BackendType, type WebCalSource } from "../../store";
import { MockDataProvider } from "../../lib/mock-data-provider";
import { WebCalProvider } from "../../lib/webcal-provider";
import { CalDAVProvider } from "../../lib/caldav-provider";

// ── Provider selector ─────────────────────────────────────────────────────────

const PROVIDERS: { id: BackendType; label: string; description: string }[] = [
  { id: "mock",   label: "Demo (local)",  description: "Données fictives stockées localement. Aucune connexion réseau." },
  { id: "webcal", label: "WebCal / iCal", description: "Abonnement lecture seule à une ou plusieurs URLs .ics (webcal:// ou https://)." },
  { id: "caldav", label: "CalDAV",        description: "Lecture/écriture via CalDAV. Compatible Proton, Nextcloud, Fastmail, Google Calendar…" },
];

// ── WebCal source form ────────────────────────────────────────────────────────

const SOURCE_COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899","#06b6d4","#64748b"];

function WebCalSourceRow({ source, onRemove }: { source: WebCalSource; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: source.color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{source.name}</div>
        <div className="text-xs text-muted-foreground truncate">{source.url}</div>
      </div>
      <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-muted text-destructive shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function AddWebCalSourceForm({ onAdd }: { onAdd: (s: WebCalSource) => void }) {
  const [name, setName]   = useState("");
  const [url, setUrl]     = useState("");
  const [color, setColor] = useState(SOURCE_COLORS[0]);

  const submit = () => {
    if (!name.trim() || !url.trim()) return;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), url: url.trim(), color });
    setName(""); setUrl(""); setColor(SOURCE_COLORS[0]);
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du calendrier"
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center gap-1 shrink-0">
          {SOURCE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="size-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: color === c ? "var(--foreground)" : "transparent" }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… ou webcal://…"
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={submit}
          disabled={!name.trim() || !url.trim()}
          className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Connection test helper ────────────────────────────────────────────────────

type TestState = "idle" | "testing" | "ok" | "error";

function useConnectionTest() {
  const [state, setState] = useState<TestState>("idle");
  const [message, setMessage] = useState("");

  const test = async (fn: () => Promise<void>) => {
    setState("testing");
    setMessage("");
    try {
      await fn();
      setState("ok");
      setMessage("Connexion réussie !");
    } catch (err: any) {
      setState("error");
      setMessage(err?.message ?? "Erreur de connexion.");
    }
  };

  return { state, message, test };
}

// ── Main component ────────────────────────────────────────────────────────────

export function BackendSettings() {
  const { config, updateConfig } = useBackendStore();
  const { setEvents } = useEventsStore();
  const { state: testState, message: testMsg, test } = useConnectionTest();

  // Local draft state for CalDAV fields (only committed on "Save")
  const [caldavUrl, setCaldavUrl]         = useState(config.caldavUrl);
  const [caldavUser, setCaldavUser]       = useState(config.caldavUsername);
  const [caldavPass, setCaldavPass]       = useState(config.caldavPassword);
  const [caldavProxy, setCaldavProxy]     = useState(config.caldavProxyUrl);

  const setType = (type: BackendType) => {
    updateConfig({ type });
    // Re-seed events when switching to mock
    if (type === "mock") {
      const mock = new MockDataProvider();
      const now = new Date();
      mock.getEvents(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth() + 2, 1)
      ).then(setEvents);
    }
  };

  const saveCalDAV = () => {
    updateConfig({
      caldavUrl: caldavUrl.trim(),
      caldavUsername: caldavUser.trim(),
      caldavPassword: caldavPass,
      caldavProxyUrl: caldavProxy.trim(),
    });
  };

  const testCalDAV = () =>
    test(async () => {
      const p = new CalDAVProvider(caldavUrl.trim(), caldavUser.trim(), caldavPass, caldavProxy.trim());
      await p.getCalendars();
    });

  const testWebCal = () =>
    test(async () => {
      if (config.webcalSources.length === 0) throw new Error("Ajoutez au moins une source WebCal.");
      const p = new WebCalProvider(config.webcalSources, config.caldavProxyUrl);
      const now = new Date();
      await p.getEvents(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth() + 2, 1)
      );
    });

  const addSource = (s: WebCalSource) =>
    updateConfig({ webcalSources: [...config.webcalSources, s] });

  const removeSource = (id: string) =>
    updateConfig({ webcalSources: config.webcalSources.filter((s) => s.id !== id) });

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setType(p.id)}
            className={cn(
              "w-full text-left rounded-xl border px-4 py-3 transition-all",
              config.type === p.id
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-primary/40 bg-card"
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("size-3 rounded-full border-2", config.type === p.id ? "border-primary bg-primary" : "border-muted-foreground bg-transparent")} />
              <span className="text-sm font-medium text-foreground">{p.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-5">{p.description}</p>
          </button>
        ))}
      </div>

      {/* WebCal config */}
      {config.type === "webcal" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Sources iCal</h3>

          {config.webcalSources.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucune source ajoutée.</p>
          )}

          {config.webcalSources.map((s) => (
            <WebCalSourceRow key={s.id} source={s} onRemove={() => removeSource(s.id)} />
          ))}

          <AddWebCalSourceForm onAdd={addSource} />

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Proxy CORS <span className="font-normal">(optionnel, si votre serveur bloque les requêtes cross-origin)</span>
            </label>
            <input
              value={config.caldavProxyUrl}
              onChange={(e) => updateConfig({ caldavProxyUrl: e.target.value })}
              placeholder="https://corsproxy.io/?"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={testWebCal}
              disabled={testState === "testing" || config.webcalSources.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <RefreshCw size={13} className={testState === "testing" ? "animate-spin" : ""} />
              Tester la connexion
            </button>
            <TestFeedback state={testState} message={testMsg} />
          </div>
        </div>
      )}

      {/* CalDAV config */}
      {config.type === "caldav" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Serveur CalDAV</h3>

          <Field
            label="URL du serveur"
            placeholder="https://calendar.proton.me/dav"
            value={caldavUrl}
            onChange={setCaldavUrl}
          />
          <Field
            label="Nom d'utilisateur"
            placeholder="user@example.com"
            value={caldavUser}
            onChange={setCaldavUser}
          />
          <Field
            label="Mot de passe / app-password"
            placeholder="••••••••"
            type="password"
            value={caldavPass}
            onChange={setCaldavPass}
          />
          <Field
            label="Proxy CORS (optionnel)"
            placeholder="https://corsproxy.io/?"
            value={caldavProxy}
            onChange={setCaldavProxy}
            hint="Requis si le serveur CalDAV ne supporte pas les requêtes cross-origin depuis un navigateur."
          />

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={saveCalDAV}
              className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Enregistrer
            </button>
            <button
              onClick={testCalDAV}
              disabled={testState === "testing" || !caldavUrl.trim() || !caldavUser.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted disabled:opacity-40"
            >
              <RefreshCw size={13} className={testState === "testing" ? "animate-spin" : ""} />
              Tester
            </button>
            <TestFeedback state={testState} message={testMsg} />
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Serveurs compatibles : Proton Calendar, Nextcloud, Fastmail, Baikal, Apple Calendar, Google Calendar
            (via <code className="font-mono">https://www.googleapis.com/caldav/v2/</code>), Radicale…
          </p>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChange, type = "text", hint,
}: {
  label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; type?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === "password" ? "current-password" : undefined}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function TestFeedback({ state, message }: { state: TestState; message: string }) {
  if (state === "idle" || state === "testing") return null;
  return (
    <span className={cn("flex items-center gap-1 text-xs", state === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive")}>
      {state === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      {message}
    </span>
  );
}
