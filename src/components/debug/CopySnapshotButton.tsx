import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../../store";
import { useDebugCache } from "../../context/DataProviderContext";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import type { Connection } from "../../types";

/** Connection with any credential field stripped, for safe pasting into a bug report. */
function redact(conn: Connection): Connection {
  if (conn.type === "caldav") return { ...conn, password: "«redacted»" };
  return conn;
}

export function CopySnapshotButton() {
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { events } = useEventsStore();
  const getCache = useDebugCache();
  const { visibleEvents } = useResolvedEvents();

  const copy = async () => {
    const cache = getCache();
    const snapshot = {
      generatedAt: new Date().toISOString(),
      connections: connections.map(redact),
      cacheEntries: Array.from(cache.entries()).map(([id, entry]) => ({
        connectionId: id,
        coveredRanges: entry.coveredRanges,
        eventCount: entry.events.length,
        lastFetchedAt: entry.lastFetchedAt,
        nextRetryAt: entry.nextRetryAt,
        backoffMs: entry.backoffMs,
        fetchSeq: entry.fetchSeq,
      })),
      rules,
      eventTypes: types,
      totalEvents: events.length,
      visibleEvents: visibleEvents.length,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success("Instantané copié dans le presse-papiers.");
    } catch {
      toast.error("Impossible de copier l'instantané.");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 shrink-0">
      <Copy size={14} />
      Copier l&apos;instantané
    </Button>
  );
}
