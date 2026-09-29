/** Human-facing connection health: status dot color, label, and the detail tooltip (last sync, or the
 *  failure with its scheduled retry). Shared by the sidebar, Sources drawer, sync dialog, search and /debug. */
import { format } from "date-fns";
import type { ConnectionStatus, ConnectionSyncMeta } from "../types";

export function statusColor(status: ConnectionStatus) {
  switch (status) {
    case "active":  return "bg-green-500";
    case "error":   return "bg-amber-500";
    case "loading": return "bg-muted-foreground animate-pulse";
    default:        return "bg-muted-foreground/40";
  }
}

export function statusLabel(status: ConnectionStatus) {
  switch (status) {
    case "active":  return "Connecté";
    case "error":   return "Échec de connexion";
    case "loading": return "Chargement…";
    default:        return "Non vérifié";
  }
}

/**
 * Full sync detail behind a connection's status dot: the last error (with when it'll
 * retry, if backed off) or, when healthy, when it last actually synced — see
 * useConnectionSyncMeta(). Falls back to the bare statusLabel() before any fetch attempt.
 */
export function connectionStatusDetail(status: ConnectionStatus, meta?: ConnectionSyncMeta): string {
  if (status === "error") {
    const retrying = meta?.nextRetryAt && meta.nextRetryAt > Date.now()
      ? ` — nouvelle tentative à ${format(meta.nextRetryAt, "HH:mm")}`
      : "";
    return (meta?.message ?? statusLabel(status)) + retrying;
  }
  if (meta?.lastSyncedAt) return `${statusLabel(status)} — synchronisé à ${format(meta.lastSyncedAt, "HH:mm")}`;
  return statusLabel(status);
}
