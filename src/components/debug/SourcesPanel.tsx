import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { statusColor, statusLabel } from "../sidebar/Sidebar";
import { useConnectionStore } from "../../store";
import { useConnectionStatusMap, useConnectionSyncMeta, useSourceSync, useDebugCache } from "../../context/DataProviderContext";
import { cn } from "../../lib/utils";

function fmt(ms: number | null) {
  return ms ? format(ms, "d MMM HH:mm:ss", { locale: fr }) : "—";
}

/** Plain helper (not inlined in JSX) so the Date.now() read doesn't run during render — same
 *  pattern as Sidebar.tsx's connectionStatusDetail(). */
function retryLabel(entry?: { nextRetryAt: number | null; backoffMs: number }) {
  if (!entry?.nextRetryAt || entry.nextRetryAt <= Date.now()) return "—";
  return `${fmt(entry.nextRetryAt)} (backoff ${Math.round(entry.backoffMs / 1000)}s)`;
}

export function SourcesPanel() {
  const { connections } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const syncMeta = useConnectionSyncMeta();
  const { lastUpdated } = useSourceSync();
  const getCache = useDebugCache();

  // Re-reads the (non-reactive) cache ref whenever something that mutates it also
  // touches syncMeta/lastUpdated — see useDebugCache()'s doc comment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cacheEntries = useMemo(() => getCache(), [getCache, syncMeta, lastUpdated]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:py-2">
            <th>Source</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Plages en cache</th>
            <th>Événements</th>
            <th>Dernière récup.</th>
            <th>Prochaine tentative</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {connections.map((c) => {
            const entry = cacheEntries.get(c.id);
            const status = statusMap[c.id] ?? "unchecked";
            const meta = syncMeta[c.id];
            return (
              <tr key={c.id} className="align-top">
                <td className="px-3 py-2 font-medium text-foreground">
                  {c.name}
                  {c.hidden && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">masquée</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{c.type}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full shrink-0", statusColor(status))} />
                    {statusLabel(status)}
                  </div>
                  {meta?.message && <div className="text-muted-foreground mt-0.5">{meta.message}</div>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {entry && entry.coveredRanges.length > 0 ? (
                    <ul className="space-y-0.5">
                      {entry.coveredRanges.map((r, i) => (
                        <li key={i}>{format(new Date(r.start), "d MMM", { locale: fr })} → {format(new Date(r.end), "d MMM", { locale: fr })}</li>
                      ))}
                    </ul>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{entry?.events.length ?? 0}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmt(entry?.lastFetchedAt ?? null)}</td>
                <td className="px-3 py-2 text-muted-foreground">{retryLabel(entry)}</td>
              </tr>
            );
          })}
          {connections.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Aucune source.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
