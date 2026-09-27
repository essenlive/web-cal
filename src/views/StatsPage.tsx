"use client";

/**
 * StatsPage — dedicated "how busy is each source/type/rule" view. Iterated a few times
 * in the project thread: started as a compact pill in each drawer row (dropped), then a
 * page with one chart per row (dropped for being scattered), settled on: one combined
 * stacked chart with every source/type/rule as its own series, a granularity picker
 * (day/week/month/year), a summary table below, a legend that doubles as a filter (click
 * an item to hide/show it), and an all-day "événements journée" line plotted against a
 * second, independent vertical axis (all-day events have no duration, so they'd
 * otherwise be invisible in an hours-based chart).
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

const CHART_HEIGHT = 176;
const COL_WIDTH = 24;
const COL_GAP = 4;

/** Legend entries double as a filter: click one to hide/show its series everywhere on the
 *  page (chart + table). Hidden entries stay listed, dimmed and struck through, so they can
 *  be toggled back on. */
function Legend({ groups, hidden, onToggle, onReset }: {
  groups: GroupRow[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {groups.map((g) => {
        const isHidden = hidden.has(g.key);
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onToggle(g.key)}
            aria-pressed={!isHidden}
            title={isHidden ? "Afficher" : "Masquer"}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              isHidden ? "text-muted-foreground/40 line-through" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: g.color, opacity: isHidden ? 0.35 : 1 }} />
            <span className="truncate max-w-32">{g.name}</span>
          </button>
        );
      })}
      {hidden.size > 0 && (
        <button type="button" onClick={onReset} className="text-xs text-primary hover:underline">
          Tout afficher
        </button>
      )}
    </div>
  );
}

/** Combined stacked chart — one bar per bucket, one colored segment per group, plus an
 *  all-day "événements journée" line plotted against its own right-hand scale (max shown
 *  in the caption, since all-day events have no duration and would otherwise be invisible
 *  against an hours-based chart). Horizontally scrollable so a fine granularity (day) over
 *  a long period doesn't get squeezed unreadable; bucket labels are thinned out past a
 *  point to avoid overlapping text. */
function StackedChart({ groups, bucketKeys, granularity }: {
  groups: GroupRow[];
  bucketKeys: string[];
  granularity: BucketGranularity;
}) {
  if (bucketKeys.length === 0 || groups.length === 0) {
    return <p className="text-xs text-muted-foreground/50 py-2">Aucune donnée sur cette période.</p>;
  }

  const perGroupFilled = groups.map((g) => fillBuckets(g.stats.buckets, bucketKeys));
  const bucketTotals = bucketKeys.map((_, i) => perGroupFilled.reduce((sum, arr) => sum + arr[i].totalMinutes, 0));
  const allDayCounts = bucketKeys.map((_, i) => perGroupFilled.reduce((sum, arr) => sum + arr[i].allDayCount, 0));
  const maxTotal = Math.max(1, ...bucketTotals);
  const maxAllDay = Math.max(1, ...allDayCounts);
  const hasAllDay = allDayCounts.some((c) => c > 0);
  const labelEvery = Math.max(1, Math.ceil(bucketKeys.length / 14));
  const totalWidth = bucketKeys.length * COL_WIDTH + (bucketKeys.length - 1) * COL_GAP;

  const linePoints = allDayCounts
    .map((c, i) => `${i * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2},${CHART_HEIGHT - (c / maxAllDay) * CHART_HEIGHT}`)
    .join(" ");

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span>Échelle heures : 0 – {formatHours(maxTotal)}</span>
        {hasAllDay && (
          <span className="flex items-center gap-1.5">
            <svg width={12} height={8} className="shrink-0"><line x1={0} y1={4} x2={12} y2={4} stroke="currentColor" strokeWidth={1.5} /></svg>
            Événements journée : 0 – {maxAllDay}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <div style={{ width: totalWidth }}>
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            <div className="absolute inset-0 flex items-end gap-1">
              {bucketKeys.map((key, i) => (
                <div key={key} className="w-6 shrink-0 flex flex-col-reverse" style={{ height: CHART_HEIGHT }}>
                  {groups.map((g, gi) => {
                    const minutes = perGroupFilled[gi][i].totalMinutes;
                    if (minutes === 0) return null;
                    const height = Math.max(2, Math.round((minutes / maxTotal) * CHART_HEIGHT));
                    return (
                      <SimpleTooltip key={g.key} label={`${g.name} · ${bucketLabel(key, granularity)} · ${formatHours(minutes)}`}>
                        <div className="w-full first:rounded-t" style={{ height, backgroundColor: g.color }} />
                      </SimpleTooltip>
                    );
                  })}
                </div>
              ))}
            </div>
            {hasAllDay && (
              <svg
                className="absolute inset-0 pointer-events-none text-foreground"
                width={totalWidth}
                height={CHART_HEIGHT}
                viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
              >
                <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
                {allDayCounts.map((c, i) =>
                  c === 0 ? null : (
                    <circle
                      key={bucketKeys[i]}
                      cx={i * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2}
                      cy={CHART_HEIGHT - (c / maxAllDay) * CHART_HEIGHT}
                      r={3}
                      fill="currentColor"
                    >
                      <title>{`${bucketLabel(bucketKeys[i], granularity)} · ${c} événement${c > 1 ? "s" : ""} journée`}</title>
                    </circle>
                  )
                )}
              </svg>
            )}
          </div>
          <div className="flex gap-1 mt-1">
            {bucketKeys.map((key, i) => (
              <span
                key={key}
                className={cn("text-[9px] text-muted-foreground/70 truncate w-6 shrink-0 text-center", i % labelEvery !== 0 && "invisible")}
              >
                {bucketLabel(key, granularity)}
              </span>
            ))}
          </div>
        </div>
      </div>
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
  const [hiddenByTab, setHiddenByTab] = useState<Record<TabId, Set<string>>>({
    sources: new Set(), types: new Set(), rules: new Set(),
  });
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
  const hidden = hiddenByTab[tab];
  const visibleRows = sortedRows.filter((r) => !hidden.has(r.key));
  const bucketKeys = enumerateBuckets(from, to, granularity);

  function toggleHidden(key: string) {
    setHiddenByTab((prev) => {
      const next = new Set(prev[tab]);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...prev, [tab]: next };
    });
  }

  function resetHidden() {
    setHiddenByTab((prev) => ({ ...prev, [tab]: new Set() }));
  }

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
            <Legend groups={sortedRows} hidden={hidden} onToggle={toggleHidden} onReset={resetHidden} />
            <StackedChart groups={visibleRows} bucketKeys={bucketKeys} granularity={granularity} />
          </div>

          {sortedRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Rien à afficher.</p>
          ) : visibleRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tous les éléments sont masqués — cliquez sur la légende pour les réafficher.</p>
          ) : (
            <SummaryTable groups={visibleRows} bucketCount={bucketKeys.length} />
          )}
        </div>
      </main>
    </div>
  );
}
