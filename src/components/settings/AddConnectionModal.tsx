/**
 * AddConnectionModal — two-step wizard dialog for adding a new calendar connection.
 *
 * Step 1: Choose type (WebCal or CalDAV)
 * Step 2a: WebCal form (name, URL, colour, optional proxy)
 * Step 2b: CalDAV form (name, URL, username, password, colour, optional proxy)
 *
 * The [Test] button validates connectivity without saving.
 * The [Add Source] button fires onAdd with the completed connection data.
 */

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
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

// ── Test-button state ─────────────────────────────────────────────────────────

type TestStatus = "idle" | "testing" | "ok" | "error";

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
            className="size-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50"
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

// ── Delete control ────────────────────────────────────────────────────────────

function DeleteControl({ confirming, onConfirmingChange, onDelete }: {
  confirming: boolean; onConfirmingChange: (v: boolean) => void; onDelete: () => void;
}) {
  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Remove this source?</span>
        <button type="button" onClick={() => onConfirmingChange(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        <button type="button" onClick={onDelete} className="text-xs font-medium text-destructive">Confirm</button>
      </div>
    );
  }
  return (
    <Button type="button" variant="ghost" size="icon" onClick={() => onConfirmingChange(true)} className="text-muted-foreground hover:text-destructive" aria-label="Remove source">
      <Trash2 size={15} />
    </Button>
  );
}

// ── Test feedback ─────────────────────────────────────────────────────────────

function TestFeedback({ status, message }: { status: TestStatus; message: string }) {
  if (status === "idle" || status === "testing") return null;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        status === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive"
      )}
    >
      {status === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      {message}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AddConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

// ── Main component ────────────────────────────────────────────────────────────

export function AddConnectionModal({ open, onOpenChange, onAdd, existingColors, connection, onUpdate, onDelete }: AddConnectionModalProps) {
  const editing = !!connection;
  const [step, setStep] = useState<1 | 2>(editing ? 2 : 1);
  const [type, setType] = useState<"webcal" | "caldav">(connection?.type ?? "webcal");

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

  // Test state
  const [testStatus, setTestStatus]   = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function reset() {
    setStep(editing ? 2 : 1);
    setType(connection?.type ?? "webcal");
    setName(connection?.name ?? "");
    setColor(connection?.color ?? pickInitialColor(existingColors));
    setProxy(connection?.proxyUrl ?? "");
    setWcUrl(connection?.type === "webcal" ? connection.url : "");
    setCdUrl(connection?.type === "caldav" ? connection.url : "");
    setCdUser(connection?.type === "caldav" ? connection.username : "");
    setCdPass(connection?.type === "caldav" ? connection.password : "");
    setErrors({}); setTestStatus("idle"); setTestMessage("");
    setConfirmingDelete(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

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

  async function handleTest() {
    if (!validate()) return;
    setTestStatus("testing");
    setTestMessage("");
    try {
      if (type === "webcal") {
        const url = wcUrl.trim().replace(/^webcal:\/\//i, "https://");
        const fetchUrl = proxyUrl.trim() ? `${proxyUrl.trim()}${encodeURIComponent(url)}` : url;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const p = new CalDAVProvider(cdUrl.trim(), cdUser.trim(), cdPass, proxyUrl.trim());
        await p.getCalendars();
      }
      setTestStatus("ok");
      setTestMessage("Connection OK");
      setTimeout(() => setTestStatus("idle"), 3000);
    } catch (err: unknown) {
      setTestStatus("error");
      setTestMessage(err instanceof Error ? err.message : "Could not reach server");
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
    reset();
    onOpenChange(false);
  }

  const canAdd = type === "webcal"
    ? name.trim() && isValidWebCalUrl(wcUrl)
    : name.trim() && isValidHttpUrl(cdUrl) && cdUser.trim() && cdPass.trim();

  const title = editing
    ? `Edit ${type === "webcal" ? "WebCal" : "CalDAV"} Source`
    : step === 1 ? "Add Calendar Source" : type === "webcal" ? "Add WebCal Source" : "Add CalDAV Source";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

          {/* Step 1 — type selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["webcal", "caldav"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-all",
                      type === t
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/40 bg-background"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "size-3 rounded-full border-2",
                          type === t ? "border-primary bg-primary" : "border-muted-foreground"
                        )}
                      />
                      <span className="text-sm font-medium text-foreground">
                        {t === "webcal" ? "WebCal" : "CalDAV"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-5">
                      {t === "webcal" ? "ICS feed subscription (read-only)" : "CalDAV server (read-only in v1)"}
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button type="button" onClick={() => setStep(2)}>
                  Next →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2a — WebCal form */}
          {step === 2 && type === "webcal" && (
            <div className="space-y-4">
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
              <ColorPicker value={color} onChange={setColor} />
              {editing && (
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Create a rule for this source
                </button>
              )}
              <AdvancedSection proxyUrl={proxyUrl} onProxyChange={setProxy} />

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                {editing
                  ? (onDelete && <DeleteControl confirming={confirmingDelete} onConfirmingChange={setConfirmingDelete} onDelete={onDelete} />)
                  : (
                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground">
                      ← Back
                    </Button>
                  )}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={handleTest} disabled={testStatus === "testing"} className="gap-1.5">
                    <RefreshCw size={13} className={testStatus === "testing" ? "animate-spin" : ""} />
                    {testStatus === "testing" ? "Testing…" : "Test"}
                  </Button>
                  <Button type="button" onClick={handleAdd} disabled={!canAdd}>
                    {editing ? "Save" : "Add Source"}
                  </Button>
                </div>
              </div>
              <TestFeedback status={testStatus} message={testMessage} />
            </div>
          )}

          {/* Step 2b — CalDAV form */}
          {step === 2 && type === "caldav" && (
            <div className="space-y-4">
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
                  onClick={() => setRuleModalOpen(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Create a rule for this source
                </button>
              )}
              <AdvancedSection proxyUrl={proxyUrl} onProxyChange={setProxy} />

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                {editing
                  ? (onDelete && <DeleteControl confirming={confirmingDelete} onConfirmingChange={setConfirmingDelete} onDelete={onDelete} />)
                  : (
                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground">
                      ← Back
                    </Button>
                  )}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={handleTest} disabled={testStatus === "testing"} className="gap-1.5">
                    <RefreshCw size={13} className={testStatus === "testing" ? "animate-spin" : ""} />
                    {testStatus === "testing" ? "Testing…" : "Test"}
                  </Button>
                  <Button type="button" onClick={handleAdd} disabled={!canAdd}>
                    {editing ? "Save" : "Add Source"}
                  </Button>
                </div>
              </div>
              <TestFeedback status={testStatus} message={testMessage} />
            </div>
          )}
      </DialogContent>

      {connection && (
        <RuleModal
          open={ruleModalOpen}
          onOpenChange={setRuleModalOpen}
          initialMatchType="source"
          initialMatchValue={connection.id}
        />
      )}
    </Dialog>
  );
}
