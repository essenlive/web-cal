/**
 * AddConnectionModal — dialog for adding or editing a calendar connection.
 *
 * New connections are ICS/WebCal feeds only (name, URL, colour, optional proxy).
 * CalDAV is no longer offered for new connections, but a connection already
 * persisted with type "caldav" still opens its original form (name, URL,
 * username, password, colour, optional proxy) so existing sources keep working.
 *
 * The [Test] button validates connectivity without saving.
 * The [Add Source] button fires onAdd with the completed connection data.
 */

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DrawerHeader, DrawerTitle } from "../ui/drawer";
import type { CalDAVConnection, Connection, WebCalConnection } from "../../types";
import { CalDAVProvider } from "../../lib/caldav-provider";
import { RuleModal } from "./RuleModal";

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
  label, placeholder, value, onChange, type = "text", error, hint,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === "password" ? "current-password" : undefined}
        aria-describedby={error ? `err-${label}` : undefined}
        className={cn("rounded-lg px-2.5 py-2 h-auto text-sm", error && "border-destructive")}
      />
      {error && (
        <p id={`err-${label}`} className="text-xs text-destructive mt-1">{error}</p>
      )}
      {hint && !error && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ── Color swatch picker ───────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Colour</label>
      <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Connection colour">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className="size-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-primary/50"
            style={{
              backgroundColor: c,
              borderColor: value === c ? "var(--foreground)" : "transparent",
            }}
          />
        ))}
      </div>
    </div>
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
        Advanced
      </button>
      {open && (
        <div className="mt-2">
          <Field
            label="CORS Proxy URL (optional)"
            placeholder="https://corsproxy.io/?"
            value={proxyUrl}
            onChange={onProxyChange}
            hint="Required if the server does not allow cross-origin requests from a browser."
          />
        </div>
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
  const type: "webcal" | "caldav" = connection?.type ?? "webcal";

  // Shared fields
  const [name, setName]       = useState(connection?.name ?? "");
  const [color, setColor]     = useState(() => connection?.color ?? pickInitialColor(existingColors));
  const [proxyUrl, setProxy]  = useState(connection?.proxyUrl ?? "");

  // WebCal-specific
  const [wcUrl, setWcUrl] = useState(connection?.type === "webcal" ? connection.url : "");

  // CalDAV-specific
  const [cdUrl, setCdUrl]   = useState(connection?.type === "caldav" ? connection.url : "");
  const [cdUser, setCdUser] = useState(connection?.type === "caldav" ? connection.username : "");
  const [cdPass, setCdPass] = useState(connection?.type === "caldav" ? connection.password : "");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [ruleFormOpen, setRuleFormOpen] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required.";
    else if (name.trim().length > 80) errs.name = "Name must be 80 characters or fewer.";

    if (type === "webcal") {
      if (!wcUrl.trim()) errs.wcUrl = "Calendar URL is required.";
      else if (!isValidWebCalUrl(wcUrl)) errs.wcUrl = "Must start with https://, http://, or webcal://";
    } else {
      if (!cdUrl.trim()) errs.cdUrl = "Server URL is required.";
      else if (!isValidHttpUrl(cdUrl)) errs.cdUrl = "Must start with https:// or http://";
      if (!cdUser.trim()) errs.cdUser = "Username is required.";
      if (!cdPass.trim()) errs.cdPass = "Password is required.";
    }

    if (proxyUrl.trim() && !isValidHttpUrl(proxyUrl)) {
      errs.proxyUrl = "Proxy URL must start with https:// or http://";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function testConnection() {
    if (!validate()) throw new Error("Fix the highlighted fields");
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
    } else {
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
    }
    onClose();
  }

  const canAdd = type === "webcal"
    ? name.trim() && isValidWebCalUrl(wcUrl)
    : name.trim() && isValidHttpUrl(cdUrl) && cdUser.trim() && cdPass.trim();

  const title = editing
    ? `Edit ${type === "webcal" ? "WebCal" : "CalDAV"} Source`
    : "Add Calendar Source";

  // Creating a rule for this source is a nested form within the same panel —
  // it swaps the content instead of stacking a second drawer (FR-005).
  if (connection && ruleFormOpen) {
    return (
      <RuleModal
        initialMatchType="source"
        initialMatchValue={connection.id}
        onClose={() => setRuleFormOpen(false)}
      />
    );
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
      </DrawerHeader>

          {/* WebCal form — the only option for new connections */}
          {type === "webcal" && (
            <div className="space-y-4 px-4 pb-4">
              <Field
                label="Name *"
                placeholder="Work Holidays"
                value={name}
                onChange={setName}
                error={errors.name}
              />
              <Field
                label="Calendar URL *"
                placeholder="https://… or webcal://…"
                value={wcUrl}
                onChange={setWcUrl}
                error={errors.wcUrl}
                hint="Link to an .ics file or WebCal subscription URL"
              />
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none hover:text-foreground">Where do I find this?</summary>
                <ul className="mt-1.5 ml-4 list-disc space-y-1">
                  <li><strong className="text-foreground">Google Calendar:</strong> Settings → [calendar] → "Secret address in iCal format"</li>
                  <li><strong className="text-foreground">Apple iCloud:</strong> Calendar app → Share Calendar → Public Calendar, then copy the link</li>
                  <li><strong className="text-foreground">Microsoft / Outlook:</strong> Settings → Shared calendars → Publish a calendar → ICS link</li>
                </ul>
              </details>
              <ColorPicker value={color} onChange={setColor} />
              {editing && (
                <button
                  type="button"
                  onClick={() => setRuleFormOpen(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Create a rule for this source
                </button>
              )}
              <AdvancedSection proxyUrl={proxyUrl} onProxyChange={setProxy} />

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                {editing
                  ? (onDelete && (
                      <ActionButton
                        variant="ghost"
                        size="icon"
                        onAction={onDelete}
                        confirmLabel="Confirm removal"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove source"
                      >
                        <Trash2 size={15} />
                      </ActionButton>
                    ))
                  : <div />}
                <div className="flex items-center gap-2">
                  <ActionButton
                    type="button"
                    variant="outline"
                    confirm={false}
                    onAction={testConnection}
                    pendingChildren={<><RefreshCw size={13} className="animate-spin" />Testing…</>}
                    successChildren={<><CheckCircle2 size={13} />Connection OK</>}
                    errorChildren={(err) => (
                      <>
                        <AlertCircle size={13} />
                        {err instanceof Error ? err.message : "Could not reach server"}
                      </>
                    )}
                    className="gap-1.5"
                  >
                    <RefreshCw size={13} />
                    Test
                  </ActionButton>
                  <Button type="button" onClick={handleAdd} disabled={!canAdd}>
                    {editing ? "Save" : "Add Source"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* CalDAV form — only reachable when editing a connection already persisted as CalDAV */}
          {editing && type === "caldav" && (
            <div className="space-y-4 px-4 pb-4">
              <Field
                label="Name *"
                placeholder="Nextcloud – Personal"
                value={name}
                onChange={setName}
                error={errors.name}
              />
              <Field
                label="Server URL *"
                placeholder="https://nextcloud.example.com/dav/"
                value={cdUrl}
                onChange={setCdUrl}
                error={errors.cdUrl}
              />
              <Field
                label="Username *"
                placeholder="user@example.com"
                value={cdUser}
                onChange={setCdUser}
                error={errors.cdUser}
              />
              <Field
                label="Password / App Password *"
                placeholder="••••••••"
                type="password"
                value={cdPass}
                onChange={setCdPass}
                error={errors.cdPass}
              />
              <ColorPicker value={color} onChange={setColor} />
              {editing && (
                <button
                  type="button"
                  onClick={() => setRuleFormOpen(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Create a rule for this source
                </button>
              )}
              <AdvancedSection proxyUrl={proxyUrl} onProxyChange={setProxy} />

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                {onDelete && (
                  <ActionButton
                    variant="ghost"
                    size="icon"
                    onAction={onDelete}
                    confirmLabel="Confirm removal"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove source"
                  >
                    <Trash2 size={15} />
                  </ActionButton>
                )}
                <div className="flex items-center gap-2">
                  <ActionButton
                    type="button"
                    variant="outline"
                    confirm={false}
                    onAction={testConnection}
                    pendingChildren={<><RefreshCw size={13} className="animate-spin" />Testing…</>}
                    successChildren={<><CheckCircle2 size={13} />Connection OK</>}
                    errorChildren={(err) => (
                      <>
                        <AlertCircle size={13} />
                        {err instanceof Error ? err.message : "Could not reach server"}
                      </>
                    )}
                    className="gap-1.5"
                  >
                    <RefreshCw size={13} />
                    Test
                  </ActionButton>
                  <Button type="button" onClick={handleAdd} disabled={!canAdd}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
