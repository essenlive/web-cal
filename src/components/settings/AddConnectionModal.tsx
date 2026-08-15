/**
 * AddConnectionModal — dialog for adding or editing a calendar connection.
 *
 * New connections are ICS/WebCal feeds only (name, URL, colour, optional proxy).
 * CalDAV is no longer offered for new connections, but a connection already
 * persisted with type "caldav" still opens its original form (name, URL,
 * username, password, colour, optional proxy) so existing sources keep working.
 *
 * The [Test] button validates connectivity without saving — it sits right next
 * to the URL field it tests, rather than down in the footer.
 * The [Add Source] button fires onAdd with the completed connection data.
 */

import { useState, type ReactNode } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { ActionButton } from "../ui/action-button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ColorPicker } from "./ColorPicker";
import { PanelHeader, PanelFooter } from "./PanelHeader";
import { RuleEditRow } from "./RuleEditRow";
import { AddItemButton } from "./DrawerItemRow";
import { useRuleStore, useEventTypeStore } from "../../store";
import type { CalDAVConnection, Connection, DemoConnection, WebCalConnection } from "../../types";
import { CalDAVProvider } from "../../lib/caldav-provider";

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6",
];

/** Pick the first palette colour not already used by an existing connection. */
function pickInitialColor(existingColors: string[]): string {
  const unused = PALETTE.find((c) => !existingColors.includes(c));
  return unused ?? PALETTE[0];
}

// ── Validation helpers ────────────────────────────────────────────────────────

function isValidWebCalUrl(url: string): boolean {
  return /^(https?|webcal):\/\/.+/i.test(url.trim());
}

function isValidHttpUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test(url.trim());
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChange, type = "text", error, hint, action,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  hint?: string;
  /** Rendered next to the input, e.g. a "Tester" button for a URL field. */
  action?: ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={type === "password" ? "current-password" : undefined}
          aria-describedby={error ? `err-${label}` : undefined}
          className={cn("flex-1 min-w-0 rounded-lg px-2.5 py-2 h-auto text-sm", error && "border-destructive")}
        />
        {action}
      </div>
      {error && (
        <p id={`err-${label}`} className="text-xs text-destructive mt-1">{error}</p>
      )}
      {hint && !error && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/** The "Tester" action for a WebCal/CalDAV URL field — validates connectivity without saving. */
function TestButton({ onTest }: { onTest: () => Promise<void> }) {
  return (
    <ActionButton
      type="button"
      variant="outline"
      confirm={false}
      onAction={onTest}
      pendingChildren={<><RefreshCw size={13} className="animate-spin" />Test en cours…</>}
      successChildren={<><CheckCircle2 size={13} />Connexion OK</>}
      errorChildren={(err) => (
        <>
          <AlertCircle size={13} />
          {err instanceof Error ? err.message : "Impossible de contacter le serveur"}
        </>
      )}
      className="shrink-0 gap-1.5 h-auto py-2"
    >
      <RefreshCw size={13} />
      Tester
    </ActionButton>
  );
}

// ── Advanced section (CORS proxy) ─────────────────────────────────────────────

function AdvancedSection({ proxyUrl, onProxyChange }: { proxyUrl: string; onProxyChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Avancé
      </button>
      {open && (
        <div className="mt-2">
          <Field
            label="URL du proxy CORS (optionnel)"
            placeholder="https://corsproxy.io/?"
            value={proxyUrl}
            onChange={onProxyChange}
            hint="Nécessaire si le serveur n'autorise pas les requêtes cross-origin depuis un navigateur."
          />
        </div>
      )}
    </div>
  );
}

// ── Rules for this source — at most one (matchType "source", matchValue = connection.id) ──

function SourceRuleSection({ connection }: { connection: Connection }) {
  const { rules, addRule, removeRule } = useRuleStore();
  const { getDefaultType } = useEventTypeStore();
  const rule = rules.find((r) => r.matchType === "source" && r.matchValue === connection.id);

  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1 block">Règles</label>
      <p className="text-xs text-muted-foreground mb-2">
        Applique un type d&apos;affichage à tous les événements de cette source.
      </p>
      {rule ? (
        <RuleEditRow rule={rule} onDelete={() => removeRule(rule.id)} lockMatch />
      ) : (
        <AddItemButton
          label="Ajouter une règle"
          onClick={() => addRule({ matchType: "source", matchValue: connection.id, displayTypeId: getDefaultType().id })}
        />
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AddConnectionModalProps {
  onAdd: (conn: Omit<Connection, "id">) => void;
  /**
   * Colors already used by existing connections.
   * The modal auto-selects the first palette colour not present in this list,
   * so new connections default to a visually distinct colour.
   * Wraps to PALETTE[0] when all 8 palette colours are already in use.
   */
  existingColors: string[];
  /** When set, the modal opens in edit mode for this connection instead of add mode. */
  connection?: Connection;
  /** Called instead of onAdd when editing an existing connection. */
  onUpdate?: (conn: Connection) => void;
  /** When set, editing this connection shows a delete button. Omitted when adding. */
  onDelete?: () => void;
  /** Called to dismiss this panel (Cancel, or after a successful save). */
  onClose: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AddConnectionModal({ onAdd, existingColors, connection, onUpdate, onDelete, onClose }: AddConnectionModalProps) {
  const editing = !!connection;
  // Never changed after mount — new connections are always "webcal"; an existing
  // "caldav" connection keeps its type (there's no UI to convert one to the other).
  // "demo" is never created here either — it only ever comes pre-seeded (see
  // useConnectionStore) and can only be edited (name/colour) or deleted.
  const type: "webcal" | "caldav" | "demo" = connection?.type ?? "webcal";

  // Shared fields
  const [name, setName]       = useState(connection?.name ?? "");
  const [color, setColor]     = useState(() => connection?.color ?? pickInitialColor(existingColors));
  const [proxyUrl, setProxy]  = useState(connection?.type !== "demo" ? connection?.proxyUrl ?? "" : "");

  // WebCal-specific
  const [wcUrl, setWcUrl] = useState(connection?.type === "webcal" ? connection.url : "");

  // CalDAV-specific
  const [cdUrl, setCdUrl]   = useState(connection?.type === "caldav" ? connection.url : "");
  const [cdUser, setCdUser] = useState(connection?.type === "caldav" ? connection.username : "");
  const [cdPass, setCdPass] = useState(connection?.type === "caldav" ? connection.password : "");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Le nom est requis.";
    else if (name.trim().length > 80) errs.name = "Le nom doit comporter 80 caractères ou moins.";

    if (type === "webcal") {
      if (!wcUrl.trim()) errs.wcUrl = "L'URL du calendrier est requise.";
      else if (!isValidWebCalUrl(wcUrl)) errs.wcUrl = "Doit commencer par https://, http:// ou webcal://";
    } else if (type === "caldav") {
      if (!cdUrl.trim()) errs.cdUrl = "L'URL du serveur est requise.";
      else if (!isValidHttpUrl(cdUrl)) errs.cdUrl = "Doit commencer par https:// ou http://";
      if (!cdUser.trim()) errs.cdUser = "Le nom d'utilisateur est requis.";
      if (!cdPass.trim()) errs.cdPass = "Le mot de passe est requis.";
    }

    if (proxyUrl.trim() && !isValidHttpUrl(proxyUrl)) {
      errs.proxyUrl = "L'URL du proxy doit commencer par https:// ou http://";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function testConnection() {
    if (!validate()) throw new Error("Corrigez les champs en surbrillance");
    if (type === "webcal") {
      const url = wcUrl.trim().replace(/^webcal:\/\//i, "https://");
      // Same default as WebCalProvider.getEvents: route through the app's
      // own same-origin proxy unless an external proxy is configured,
      // since most .ics hosts don't send CORS headers.
      const fetchUrl = proxyUrl.trim()
        ? `${proxyUrl.trim()}${encodeURIComponent(url)}`
        : `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else {
      const p = new CalDAVProvider(cdUrl.trim(), cdUser.trim(), cdPass, proxyUrl.trim());
      await p.getCalendars();
    }
  }

  function handleAdd() {
    if (!validate()) return;
    const proxy = proxyUrl.trim() || undefined;
    if (type === "webcal") {
      const conn: Omit<WebCalConnection, "id"> = {
        type: "webcal", name: name.trim(), url: wcUrl.trim(), color, proxyUrl: proxy,
      };
      if (editing) onUpdate?.({ ...conn, id: connection!.id });
      else onAdd(conn);
    } else if (type === "caldav") {
      const conn: Omit<CalDAVConnection, "id"> = {
        type: "caldav",
        name: name.trim(),
        url: cdUrl.trim(),
        username: cdUser.trim(),
        password: cdPass,
        color,
        proxyUrl: proxy,
      };
      if (editing) onUpdate?.({ ...conn, id: connection!.id });
      else onAdd(conn);
    } else {
      const conn: DemoConnection = { type: "demo", id: connection!.id, name: name.trim(), color, hidden: connection!.hidden };
      onUpdate?.(conn);
    }
    onClose();
  }

  const canAdd = type === "webcal"
    ? name.trim() && isValidWebCalUrl(wcUrl)
    : type === "caldav"
    ? name.trim() && isValidHttpUrl(cdUrl) && cdUser.trim() && cdPass.trim()
    : !!name.trim();

  const title = editing
    ? `Modifier la source ${type === "webcal" ? "WebCal" : type === "caldav" ? "CalDAV" : "de démonstration"}`
    : "Ajouter une source de calendrier";

  return (
    <>
      <PanelHeader
        title={title}
        onBack={onClose}
        description="Renseignez les informations de connexion pour ajouter cette source à votre calendrier."
      />

          {/* WebCal form — the only option for new connections */}
          {type === "webcal" && (
            <div className="space-y-4 px-4 pb-4">
              <Field
                label="Nom *"
                placeholder="Vacances - Travail"
                value={name}
                onChange={setName}
                error={errors.name}
              />
              <Field
                label="URL du calendrier *"
                placeholder="https://… ou webcal://…"
                value={wcUrl}
                onChange={setWcUrl}
                error={errors.wcUrl}
                hint="Lien vers un fichier .ics ou une URL d'abonnement WebCal"
                action={<TestButton onTest={testConnection} />}
              />
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none hover:text-foreground">Où puis-je trouver ça ?</summary>
                <ul className="mt-1.5 ml-4 list-disc space-y-1">
                  <li><strong className="text-foreground">Google Agenda :</strong> Paramètres → [calendrier] → « Adresse secrète au format iCal »</li>
                  <li><strong className="text-foreground">Apple iCloud :</strong> Application Calendrier → Partager le calendrier → Calendrier public, puis copier le lien</li>
                  <li><strong className="text-foreground">Microsoft / Outlook :</strong> Paramètres → Calendriers partagés → Publier un calendrier → lien ICS</li>
                </ul>
              </details>
              <ColorPicker value={color} onChange={setColor} colors={PALETTE} />
              {connection && <SourceRuleSection connection={connection} />}
              <AdvancedSection proxyUrl={proxyUrl} onProxyChange={setProxy} />

              <PanelFooter
                onDelete={editing ? onDelete : undefined}
                onCancel={onClose}
                onSave={handleAdd}
                saveDisabled={!canAdd}
                saveLabel={editing ? "Enregistrer" : "Ajouter la source"}
              />
            </div>
          )}

          {/* CalDAV form — only reachable when editing a connection already persisted as CalDAV */}
          {editing && type === "caldav" && (
            <div className="space-y-4 px-4 pb-4">
              <Field
                label="Nom *"
                placeholder="Nextcloud – Personnel"
                value={name}
                onChange={setName}
                error={errors.name}
              />
              <Field
                label="URL du serveur *"
                placeholder="https://nextcloud.example.com/dav/"
                value={cdUrl}
                onChange={setCdUrl}
                error={errors.cdUrl}
                action={<TestButton onTest={testConnection} />}
              />
              <Field
                label="Nom d'utilisateur *"
                placeholder="user@example.com"
                value={cdUser}
                onChange={setCdUser}
                error={errors.cdUser}
              />
              <Field
                label="Mot de passe / mot de passe d'application *"
                placeholder="••••••••"
                type="password"
                value={cdPass}
                onChange={setCdPass}
                error={errors.cdPass}
              />
              <ColorPicker value={color} onChange={setColor} colors={PALETTE} />
              {connection && <SourceRuleSection connection={connection} />}
              <AdvancedSection proxyUrl={proxyUrl} onProxyChange={setProxy} />

              <PanelFooter onDelete={onDelete} onCancel={onClose} onSave={handleAdd} saveDisabled={!canAdd} saveLabel="Enregistrer" />
            </div>
          )}

          {/* Demo form — only reachable when editing the seeded demo connection */}
          {editing && type === "demo" && (
            <div className="space-y-4 px-4 pb-4">
              <p className="text-xs text-muted-foreground">
                Calendrier de démonstration généré localement, sans connexion réseau. Supprimez-le une fois vos propres sources ajoutées.
              </p>
              <Field
                label="Nom *"
                value={name}
                onChange={setName}
                error={errors.name}
              />
              <ColorPicker value={color} onChange={setColor} colors={PALETTE} />
              {connection && <SourceRuleSection connection={connection} />}
              <PanelFooter onDelete={onDelete} onCancel={onClose} onSave={handleAdd} saveDisabled={!canAdd} saveLabel="Enregistrer" />
            </div>
          )}
    </>
  );
}
