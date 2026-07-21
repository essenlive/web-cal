/**
 * ConnectionList — displays all configured calendar connections with live
 * status indicators and per-row remove confirmation.
 */

import { useState } from "react";
import { Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import type { Connection, ConnectionStatus, ConnectionStatusMap, EventType } from "../../types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConnectionListProps {
  connections: Connection[];
  statusMap: ConnectionStatusMap;
  eventTypes: EventType[];
  onRemove: (id: string) => void;
  onUpdate: (conn: Connection) => void;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "loading":
      return (
        <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          Syncing
        </span>
      );
    case "active":
      return (
        <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 size={12} />
          Active
        </span>
      );
    case "error":
      return (
        <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle size={12} />
          Error
        </span>
      );
    default: // unchecked
      return (
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          —
        </span>
      );
  }
}

// ── Display type selector ─────────────────────────────────────────────────────

interface DisplayTypeSelectorProps {
  connection: Connection;
  eventTypes: EventType[];
  onUpdate: (conn: Connection) => void;
}

function getIconEl(name: string, size = 12) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }> | undefined>)[name];
  return Icon ? <Icon size={size} /> : null;
}

function DisplayTypeSelector({ connection, eventTypes, onUpdate }: DisplayTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = eventTypes.find((t) => t.id === connection.displayTypeId);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
          selected
            ? "border-transparent"
            : "border-border text-muted-foreground hover:text-foreground hover:border-border"
        )}
        style={selected ? { backgroundColor: selected.color + "20", borderColor: selected.color, color: selected.color } : {}}
        title="Display type for this calendar"
      >
        {selected ? getIconEl(selected.icon) : <Icons.Palette size={12} />}
        <span className="max-w-[70px] truncate">{selected ? selected.label : "Style"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-border bg-card shadow-lg py-1">
          <button
            onClick={() => { onUpdate({ ...connection, displayTypeId: undefined }); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left",
              !selected && "font-medium text-foreground"
            )}
          >
            <Icons.Minus size={12} className="text-muted-foreground" />
            Aucun
          </button>
          {eventTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => { onUpdate({ ...connection, displayTypeId: t.id }); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left",
                selected?.id === t.id && "font-medium"
              )}
              style={selected?.id === t.id ? { color: t.color } : {}}
            >
              <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Connection row ────────────────────────────────────────────────────────────

interface ConnectionRowProps {
  connection: Connection;
  status: ConnectionStatus;
  eventTypes: EventType[];
  onRemove: (id: string) => void;
  onUpdate: (conn: Connection) => void;
}

function ConnectionRow({ connection, status, eventTypes, onRemove, onUpdate }: ConnectionRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      {/* Colour swatch */}
      <span
        className="size-4 rounded-full shrink-0"
        style={{ backgroundColor: connection.color }}
        aria-hidden="true"
      />

      {/* Name + type badge */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-foreground truncate max-w-[160px]">
          {connection.name}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {connection.type === "webcal" ? "WebCal" : "CalDAV"}
        </span>
      </div>

      {/* Status */}
      <StatusBadge status={status} />

      {/* Display type selector */}
      <DisplayTypeSelector connection={connection} eventTypes={eventTypes} onUpdate={onUpdate} />

      {/* Remove / confirm */}
      {confirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Remove?</span>
          <button
            onClick={() => setConfirming(false)}
            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onRemove(connection.id)}
            className="px-2 py-1 rounded-md text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${connection.name}`}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive shrink-0 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

export function ConnectionList({ connections, statusMap, eventTypes, onRemove, onUpdate }: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No data sources connected.
        <br />
        Add a WebCal subscription or CalDAV account above.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {connections.map((conn) => (
        <ConnectionRow
          key={conn.id}
          connection={conn}
          status={statusMap[conn.id] ?? "unchecked"}
          eventTypes={eventTypes}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      ))}
    </ul>
  );
}
