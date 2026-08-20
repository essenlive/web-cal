import { AlertTriangle, RefreshCw } from "lucide-react";
import { SimpleTooltip } from "../ui/tooltip";
import { useSourceSync } from "../../context/DataProviderContext";

/**
 * Global, non-intrusive sync-state indicator — idle renders nothing (see
 * specs/008-events-perf-caching/research.md Decision I: "non-intrusive" means it
 * only draws the eye when there's something to know). Derived entirely from
 * useSourceSync()'s syncState, itself derived from the same per-connection status
 * map the sidebar's dots already read — never a second source of truth.
 */
export function SyncIndicator() {
  const { syncState } = useSourceSync();

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

  return (
    <SimpleTooltip label="Échec de synchronisation d'au moins une source">
      <span
        role="status"
        aria-live="polite"
        aria-label="Échec de synchronisation d'au moins une source"
        className="inline-flex items-center justify-center text-amber-500 shrink-0"
      >
        <AlertTriangle size={15} />
      </span>
    </SimpleTooltip>
  );
}
