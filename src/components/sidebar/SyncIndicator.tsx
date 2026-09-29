import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CloudAlert, CloudCheck, RefreshCw } from "lucide-react";
import { SimpleTooltip } from "../ui/tooltip";
import { ActionButton } from "../ui/action-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useConnectionStore, useUIStore } from "../../store";
import {
  useConnectionStatusMap, useConnectionSyncMeta, useDebugCache, useSourceSync, windowAround,
} from "../../context/DataProviderContext";
import { cacheState, type CacheState } from "../../lib/event-cache";
import { cn } from "../../lib/utils";
import { connectionStatusDetail, statusColor } from "./Sidebar";

/**
 * Global sync state + entry point to the sync dialog. Mounted in the calendar Header and
 * the /debug page header — anywhere syncing matters. Idle is a quiet cloud-check; it only
 * draws the eye (spinner / amber alert) when there's something to know. Derived entirely
 * from useSourceSync()'s syncState, itself derived from the same per-connection status map
 * the sidebar's dots read — never a second source of truth.
 */
export function SyncIndicator() {
  const { syncState } = useSourceSync();
  const syncMeta = useConnectionSyncMeta();

  // Earliest scheduled retry across every backed-off source, so the tooltip tells the
  // user this isn't stuck — it's waiting out a cooldown (e.g. a 429) automatically.
  const nextRetryAt = Object.values(syncMeta)
    .map((m) => m.nextRetryAt)
    .filter((t): t is number => t !== null && t !== undefined)
    .sort((a, b) => a - b)[0];
  const label =
    syncState === "syncing" ? "Synchronisation en cours…"
    : syncState === "error"
      ? `Échec de synchronisation d'au moins une source${nextRetryAt ? ` — nouvelle tentative à ${format(nextRetryAt, "HH:mm")}` : ""}`
      : "Sources synchronisées";

  return (
    <Dialog>
      <SimpleTooltip label={label}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`${label} — ouvrir la synchronisation`}
            className={cn(
              "inline-flex items-center justify-center rounded-md p-1.5 shrink-0 hover:bg-muted",
              syncState === "error" ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {syncState === "syncing" && <RefreshCw size={15} className="animate-spin" />}
            {syncState === "error" && <CloudAlert size={15} />}
            {syncState === "idle" && <CloudCheck size={15} />}
          </button>
        </DialogTrigger>
      </SimpleTooltip>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <SyncPanel />
      </DialogContent>
    </Dialog>
  );
}

const BACK_OPTIONS = [1, 2, 3, 6, 12];
const FORWARD_OPTIONS = [1, 3, 6, 12];

const CACHE_LABEL: Record<CacheState, { text: string; className: string }> = {
  full:    { text: "Complet", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  partial: { text: "Partiel", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  stale:   { text: "Périmé",  className: "bg-muted text-muted-foreground" },
  empty:   { text: "Vide",    className: "bg-muted text-muted-foreground" },
};

const day = (d: Date | string) => format(new Date(d), "d MMM yyyy", { locale: fr });

function SyncPanel() {
  const { connections } = useConnectionStore();
  const { currentDate, cacheMonths, setCacheMonths } = useUIStore();
  const statusMap = useConnectionStatusMap();
  const syncMeta = useConnectionSyncMeta();
  const { refresh, lastUpdated } = useSourceSync();
  const getCache = useDebugCache();

  // Re-reads the (non-reactive) cache ref whenever something that mutates it also touches
  // syncMeta/statusMap/lastUpdated — see useDebugCache()'s doc comment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => new Map(getCache()), [getCache, syncMeta, statusMap, lastUpdated]);
  // cacheMonths is read inside windowAround, not passed — keep it in deps so the period updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const period = useMemo(() => windowAround(currentDate), [currentDate, cacheMonths]);
  const periodRange = { start: period.start.toISOString(), end: period.end.toISOString() };

  const select = "rounded-md border border-border bg-background px-2 py-1 text-xs";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Synchronisation</DialogTitle>
        <DialogDescription>
          Les sources se resynchronisent seules en arrière-plan toutes les 5 minutes et au retour sur l&apos;onglet ;
          une source en échec est réessayée automatiquement.
        </DialogDescription>
      </DialogHeader>

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Période en cache</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
          <label className="flex items-center gap-1.5">
            Passé
            <select className={select} value={cacheMonths.back} onChange={(e) => setCacheMonths({ ...cacheMonths, back: Number(e.target.value) })}>
              {BACK_OPTIONS.map((n) => <option key={n} value={n}>{n} mois</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            À venir
            <select className={select} value={cacheMonths.forward} onChange={(e) => setCacheMonths({ ...cacheMonths, forward: Number(e.target.value) })}>
              {FORWARD_OPTIONS.map((n) => <option key={n} value={n}>{n} mois</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Du {day(period.start)} au {day(period.end)}, autour de la date affichée. Une période plus longue rend la
          navigation instantanée mais alourdit chaque synchronisation.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sources</h3>
        {connections.length === 0 && <p className="text-xs text-muted-foreground">Aucune source.</p>}
        <ul className="space-y-1.5">
          {connections.map((c) => {
            const status = statusMap[c.id] ?? "unchecked";
            const entry = entries.get(c.id);
            const cache = CACHE_LABEL[cacheState(entry, periodRange)];
            const span = syncMeta[c.id]?.cachedRange;
            return (
              <li key={c.id} className="rounded-lg bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{c.name}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", cache.className)}>{cache.text}</span>
                  <span aria-hidden className={cn("size-1.5 rounded-full shrink-0", statusColor(status))} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {connectionStatusDetail(status, syncMeta[c.id])}
                  {span && ` · en cache : ${day(span.start)} – ${day(span.end)}`}
                  {entry && ` · ${entry.events.length} événement${entry.events.length > 1 ? "s" : ""}`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {lastUpdated ? `Actualisé à ${format(lastUpdated, "HH:mm", { locale: fr })}` : "Pas encore actualisé"}
        </span>
        <ActionButton confirm={false} onAction={refresh} className="gap-1.5">
          <RefreshCw size={14} /> Tout synchroniser
        </ActionButton>
      </div>
    </>
  );
}
