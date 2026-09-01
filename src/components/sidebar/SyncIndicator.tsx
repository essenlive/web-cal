import { format } from "date-fns";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { SimpleTooltip } from "../ui/tooltip";
import { useConnectionSyncMeta, useSourceSync } from "../../context/DataProviderContext";

/**
 * Global, non-intrusive sync-state indicator — idle renders nothing (see
 * specs/008-events-perf-caching/research.md Decision I: "non-intrusive" means it
 * only draws the eye when there's something to know). Derived entirely from
 * useSourceSync()'s syncState, itself derived from the same per-connection status
 * map the sidebar's dots already read — never a second source of truth.
 */
export function SyncIndicator() {
  const { syncState } = useSourceSync();
  const syncMeta = useConnectionSyncMeta();

  if (syncState === "idle") return null;

  if (syncState === "syncing") {
    return (
      <SimpleTooltip label="Synchronisation en cours…">
        <span
          role="status"
          aria-live="polite"
          aria-label="Synchronisation en cours"
          className="inline-flex items-center justify-center text-muted-foreground shrink-0"
        >
          <RefreshCw size={15} className="animate-spin" />
        </span>
      </SimpleTooltip>
    );
  }

  // Earliest scheduled retry across every backed-off source, so the tooltip tells the
  // user this isn't stuck — it's waiting out a cooldown (e.g. a 429) automatically.
  const nextRetryAt = Object.values(syncMeta)
    .map((m) => m.nextRetryAt)
    .filter((t): t is number => t !== null && t !== undefined)
    .sort((a, b) => a - b)[0];
  const label = nextRetryAt
    ? `Échec de synchronisation d'au moins une source — nouvelle tentative à ${format(nextRetryAt, "HH:mm")}`
    : "Échec de synchronisation d'au moins une source";

  return (
    <SimpleTooltip label={label}>
      <span
        role="status"
        aria-live="polite"
        aria-label={label}
        className="inline-flex items-center justify-center text-amber-500 shrink-0"
      >
        <AlertTriangle size={15} />
      </span>
    </SimpleTooltip>
  );
}
