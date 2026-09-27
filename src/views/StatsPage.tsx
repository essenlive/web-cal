"use client";

/**
 * StatsPage — dedicated "how busy is each source/type/rule" view. Iterated a few times
 * in the project thread: started as a compact pill in each drawer row (dropped), then a
 * page with one chart per row (dropped for being scattered), settled on: one combined
 * stacked chart with every source/type/rule as its own series, a granularity picker
 * (day/week/month/year), and a summary table below with the same rows' totals.
 */

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { useConnectionStore, useEventTypeStore, useRuleStore, useEventsStore } from "../store";
import { useEventStatsByGroup } from "../hooks/useEventStatsByGroup";
import { useEventPeriod } from "../hooks/useEventPeriod";
import {
  formatHours, emptyStats, enumerateBuckets, fillBuckets, bucketLabel,
  GRANULARITIES, type RangeStats, type BucketGranularity,
} from "../lib/eventStats";
import { describeMatch } from "../lib/rules";
import { EnsureSourceRule } from "./RulesPage";
import { ItemBadge } from "../components/sidebar/ItemRow";
import { EventPeriodPicker } from "../components/events/EventPeriodPicker";
import { SimpleTooltip } from "../components/ui/tooltip";
import { getIconEl } from "../lib/icons";
import type { Rule } from "../types";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "types", label: "Types" },
  { id: "rules", label: "Règles" },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface GroupRow {
  key: string;
  badge: React.ReactNode;
  name: string;
  color: string;
  stats: RangeStats;
}

/** Combined stacked chart — one bar per bucket, one colored segment per group. Horizontally
 *  scrollable so a fine granularity (day) over a long period doesn't get squeezed unreadable;
 *  bucket labels are thinned out past a point to avoid overlapping text. */
function StackedChart({ groups, bucketKeys, granularity }: {
  groups: GroupRow[];
  bucketKeys: string[];
  granularity: BucketGranularity;
}) {
  if (bucketKeys.length === 0 || groups.length === 0) {
    return <p className="text-xs text-muted-foreground/50 py-2">Aucune donnée sur cette période.</p>;
  }

  const perGroupBuckets = groups.map((g) => {
    const filled = fillBuckets(g.stats.buckets, bucketKeys);
    return new Map(filled.map((b) => [b.key, b.totalMinutes]));
  });

  const bucketTotals = bucketKeys.map((key) => perGroupBuckets.reduce((sum, m) => sum + (m.get(key) ?? 0), 0));
  const maxTotal = Math.max(1, ...bucketTotals);
  const labelEvery = Math.max(1, Math.ceil(bucketKeys.length / 14));

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 h-48 min-w-fit">
        {bucketKeys.map((key, i) => (
          <div key={key} className="flex flex-col items-center gap-1 w-6 shrink-0">
            <div className="w-full flex flex-col-reverse" style={{ height: 176 }}>
              {groups.map((g, gi) => {
                const minutes = perGroupBuckets[gi].get(key) ?? 0;
                if (minutes === 0) return null;
                const height = Math.max(2, Math.round((minutes / maxTotal) * 176));
                return (
                  <SimpleTooltip key={g.key} label={`${g.name} · ${bucketLabel(key, granularity)} · ${formatHours(minutes)}`}>
                    <div className="w-full first:rounded-t" style={{ height, backgroundColor: g.color }} />
                  </SimpleTooltip>
                );
              })}
            </div>
            <span className={cn("text-[9px] text-muted-foreground/70 truncate w-full text-center", i % labelEvery !== 0 && "invisible")}>
              {bucketLabel(key, granularity)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ groups }: { groups: GroupRow[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {groups.map((g) => (
        <div key={g.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
          <span className="truncate max-w-32">{g.name}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryTable({ groups, bucketCount }: { groups: GroupRow[]; bucketCount: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium py-1.5 pr-2">Nom</th>
            <th className="text-right font-medium py-1.5 px-2">Total</th>
            <th className="text-right font-medium py-1.5 px-2">Moyenne / période</th>
            <th className="text-right font-medium py-1.5 px-2">Jours actifs</th>
            <th className="text-right font-medium py-1.5 pl-2">Événements</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-t border-border">
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  {g.badge}
                  <span className="truncate text-foreground">{g.name}</span>
                </div>
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums text-foreground">{formatHours(g.stats.totalMinutes)}</td>
              <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                {formatHours(bucketCount > 0 ? g.stats.totalMinutes / bucketCount : 0)}
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{g.stats.activeDays}</td>
              <td className="text-right py-1.5 pl-2 tabular-nums text-muted-foreground">{g.stats.eventCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsPage() {
  const [tab, setTab] = useState<TabId>("sources");
  const [granularity, setGranularity] = useState<BucketGranularity>("week");
  const { from, to, presetDays, loading, setPreset, setCustom } = useEventPeriod(28);

  const { hasLoadedOnce, events } = useEventsStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { bySource, byType, byRule } = useEventStatsByGroup(from, to, granularity);

  const orderedRules = rules.filter((r) => r.matchType === "name" || r.matchType === "source");
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;
  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;

  const rows: GroupRow[] =
    tab === "sources"
      ? connections.map((c) => ({
          key: c.id,
          badge: <ItemBadge color={c.color}>{c.name.trim().charAt(0).toUpperCase()}</ItemBadge>,
          name: c.name,
          color: c.color,
          stats: bySource.get(c.id) ?? emptyStats(),
        }))
      : tab === "types"
      ? types.map((t) => ({
          key: t.id,
          badge: <ItemBadge color={t.color}>{getIconEl(t.icon, 10, "#fff")}</ItemBadge>,
          name: t.label,
          color: t.color,
          stats: byType.get(t.id) ?? emptyStats(),
        }))
      : orderedRules.map((r: Rule) => {
          const type = types.find((t) => t.id === r.displayTypeId);
          const color = type?.color ?? "#94a3b8";
          return {
            key: r.id,
            badge: type ? <ItemBadge color={color}>{getIconEl(type.icon, 10, "#fff")}</ItemBadge> : <ItemBadge color={color}>?</ItemBadge>,
            name: describeMatch(r, getEventTitle, getConnectionName),
            color,
            stats: byRule.get(r.id) ?? emptyStats(),
          };
        });

  const sortedRows = [...rows].sort((a, b) => b.stats.totalMinutes - a.stats.totalMinutes);
  const bucketKeys = enumerateBuckets(from, to, granularity);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="flex items-center h-14 px-4 border-b border-border bg-card shrink-0 gap-2">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-muted-foreground">
          <ArrowLeft size={16} />
          Calendrier
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-sm font-bold text-foreground">Statistiques</h1>
      </header>

      {connections.map((c) => <EnsureSourceRule key={c.id} connectionId={c.id} />)}

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border border-border overflow-hidden bg-background w-fit">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-colors",
                    tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <EventPeriodPicker from={from} to={to} presetDays={presetDays} loading={loading} onPreset={setPreset} onCustom={setCustom} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Du {format(from, "d MMMM", { locale: fr })} au {format(to, "d MMMM", { locale: fr })}.
              {!hasLoadedOnce && " Chargement des événements…"}
            </p>
            <div className="flex rounded-xl border border-border overflow-hidden bg-background w-fit">
              {GRANULARITIES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGranularity(g.id)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-colors",
                    granularity === g.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-3">
            <Legend groups={sortedRows} />
            <StackedChart groups={sortedRows} bucketKeys={bucketKeys} granularity={granularity} />
          </div>

          {sortedRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Rien à afficher.</p>
          ) : (
            <SummaryTable groups={sortedRows} bucketCount={bucketKeys.length} />
          )}
        </div>
      </main>
    </div>
  );
}
