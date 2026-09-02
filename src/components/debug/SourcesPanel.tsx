import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { statusColor, statusLabel } from "../sidebar/Sidebar";
import { useConnectionStore } from "../../store";
import { useConnectionStatusMap, useConnectionSyncMeta, useSourceSync, useDebugCache } from "../../context/DataProviderContext";
import { cn } from "../../lib/utils";
import { ActionButton } from "../ui/action-button";
import { CopySnapshotButton } from "./CopySnapshotButton";
import { SortHeader, type SortDir } from "./table";
import type { Connection, ConnectionStatus, ConnectionSyncMeta } from "../../types";
import type { ConnectionCacheEntry } from "../../lib/event-cache";

interface Row {
  connection: Connection;
  status: ConnectionStatus;
  meta?: ConnectionSyncMeta;
  entry?: ConnectionCacheEntry;
}

type SortKey = "name" | "type" | "status" | "events" | "lastFetched" | "nextRetry";

function fmt(ms: number | null) {
  return ms ? format(ms, "d MMM HH:mm:ss", { locale: fr }) : "—";
}

/** Plain helper (not inlined in JSX) so the Date.now() read doesn't run during render — same
 *  pattern as Sidebar.tsx's connectionStatusDetail(). */
function retryLabel(entry?: ConnectionCacheEntry) {
  if (!entry?.nextRetryAt || entry.nextRetryAt <= Date.now()) return "—";
  return `${fmt(entry.nextRetryAt)} (backoff ${Math.round(entry.backoffMs / 1000)}s)`;
}

function compareRows(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "name": return a.connection.name.localeCompare(b.connection.name);
    case "type": return a.connection.type.localeCompare(b.connection.type);
    case "status": return a.status.localeCompare(b.status);
    case "events": return (a.entry?.events.length ?? 0) - (b.entry?.events.length ?? 0);
    case "lastFetched": return (a.entry?.lastFetchedAt ?? 0) - (b.entry?.lastFetchedAt ?? 0);
    case "nextRetry": return (a.entry?.nextRetryAt ?? 0) - (b.entry?.nextRetryAt ?? 0);
  }
}

export function SourcesPanel() {
  const { connections } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const syncMeta = useConnectionSyncMeta();
  const { refresh, lastUpdated } = useSourceSync();
  const getCache = useDebugCache();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ConnectionStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Re-reads the (non-reactive) cache ref whenever something that mutates it also
  // touches syncMeta/lastUpdated — see useDebugCache()'s doc comment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cacheEntries = useMemo(() => getCache(), [getCache, syncMeta, lastUpdated]);

  const rows = useMemo<Row[]>(() => connections.map((connection) => ({
    connection,
    status: statusMap[connection.id] ?? "unchecked",
    meta: syncMeta[connection.id],
    entry: cacheEntries.get(connection.id),
  })), [connections, statusMap, syncMeta, cacheEntries]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.connection.name.toLowerCase().includes(q))
      .filter((r) => typeFilter === "all" || r.connection.type === typeFilter)
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => (sortDir === "asc" ? 1 : -1) * compareRows(a, b, sortKey));
  }, [rows, search, typeFilter, statusFilter, sortKey, sortDir]);

  const snapshotData = useMemo(() => ({
    sources: rows.map(({ connection: c, status, meta, entry }) => ({
      name: c.name,
      type: c.type,
      hidden: !!c.hidden,
      status,
      statusMessage: meta?.message ?? null,
      lastSyncedAt: meta?.lastSyncedAt ? new Date(meta.lastSyncedAt).toISOString() : null,
      cachedEventCount: entry?.events.length ?? 0,
      coveredRanges: entry?.coveredRanges ?? [],
      lastFetchedAt: entry?.lastFetchedAt ? new Date(entry.lastFetchedAt).toISOString() : null,
      nextRetryAt: entry?.nextRetryAt ? new Date(entry.nextRetryAt).toISOString() : null,
      backoffMs: entry?.backoffMs ?? 0,
    })),
  }), [rows]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom…"
          className="w-56 max-w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="all">Tous les types</option>
          <option value="webcal">webcal</option>
          <option value="caldav">caldav</option>
          <option value="demo">demo</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="all">Statut : tous</option>
          <option value="active">Connecté</option>
          <option value="error">Échec de connexion</option>
          <option value="loading">Chargement…</option>
          <option value="unchecked">Non vérifié</option>
        </select>
        <ActionButton
          variant="outline"
          size="sm"
          confirm={false}
          onAction={refresh}
          className="gap-1.5 text-xs"
        >
          <RefreshCw size={12} />
          Actualiser la période actuelle
        </ActionButton>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{filtered.length} / {connections.length} sources</span>
        <CopySnapshotButton
          context="web-cal debug snapshot — onglet Sources & cache. Chaque entrée est une source de calendrier configurée (une 'connection') avec son cache local de récupération : plages de dates déjà couvertes, nombre d'événements en cache, dernière récupération réussie, et l'état de réessai/backoff si la source est actuellement en échec. 'status' vaut unchecked | loading | active | error."
          data={snapshotData}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <SortHeader label="Source" sortKey="name" active={sortKey === "name"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Type" sortKey="type" active={sortKey === "type"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Statut" sortKey="status" active={sortKey === "status"} dir={sortDir} onSort={onSort} />
              <th className="px-3 py-2 text-left font-medium">Plages en cache</th>
              <SortHeader label="Événements" sortKey="events" active={sortKey === "events"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Dernière récup." sortKey="lastFetched" active={sortKey === "lastFetched"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Prochaine tentative" sortKey="nextRetry" active={sortKey === "nextRetry"} dir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(({ connection: c, status, meta, entry }) => (
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
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Aucune source.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
