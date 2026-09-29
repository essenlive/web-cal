"use client";

/**
 * StatsPage — dedicated "how busy is each source/type/rule" view. Iterated a few times
 * in the project thread: started as a compact pill in each drawer row (dropped), then a
 * page with one chart per row (dropped for being scattered), settled on: one combined
 * chart (Recharts — the lightweight charting library shadcn/ui itself builds its Chart
 * component on) with every source/type/rule as its own stacked-bar series, a granularity
 * picker (day/week/month/year), a summary table below, a legend that doubles as a filter
 * (click an item to hide/show it), and all-day "événements journée" plotted as a line
 * against a second, independent axis — timed events are a duration (summed into hours),
 * an all-day event has none (so it's counted instead), and the two are never mixed into
 * the same number anywhere on this page.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
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
import { getIconEl } from "../lib/icons";
import type { Rule } from "../types";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "types", label: "Types" },
  { id: "rules", label: "Règles" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ALL_DAY_SUFFIX = "__allday";
function allDayKey(groupKey: string) {
  return `${groupKey}${ALL_DAY_SUFFIX}`;
}

interface GroupRow {
  key: string;
  badge: React.ReactNode;
  name: string;
  color: string;
  stats: RangeStats;
}

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

interface TooltipEntry { dataKey: string; value: number; color: string }

/** Custom tooltip — kept deliberately explicit about units: timed series are summed
 *  minutes shown as hours, all-day series are a plain count of events, and the two are
 *  never added together into one number. Both are broken down per source/type/rule, so
 *  each group gets its own line in each section. */
function ChartTooltip({ active, payload, label, groupsByKey }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  groupsByKey: Map<string, GroupRow>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const hourEntries = payload.filter((p) => !p.dataKey.endsWith(ALL_DAY_SUFFIX) && p.value > 0);
  const allDayEntries = payload.filter((p) => p.dataKey.endsWith(ALL_DAY_SUFFIX) && p.value > 0);

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {hourEntries.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          {groupsByKey.get(p.dataKey)?.name ?? p.dataKey} · {formatHours(p.value)}
        </div>
      ))}
      {allDayEntries.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-border pt-1">
          {allDayEntries.map((p) => {
            const groupKey = p.dataKey.slice(0, -ALL_DAY_SUFFIX.length);
            return (
              <div key={p.dataKey} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                {groupsByKey.get(groupKey)?.name ?? groupKey} · {p.value} événement{p.value > 1 ? "s" : ""} journée
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Combined chart — one Bar series (stacked, left "Heures" axis) per visible source/type/
 *  rule, plus a second stacked-Bar cluster per group for all-day event counts against its
 *  own right "Événements" axis, since all-day events have no duration and would otherwise
 *  be invisible against an hours-based chart — broken down the same way as the hours bars
 *  rather than combined into one line, so a single all-day-heavy group doesn't get lost in
 *  a flat total. Fills the full container width by default (min-width only kicks in once a
 *  fine granularity over a long period needs more room than that, forcing horizontal
 *  scroll instead of squeezing bars unreadable). */
function CombinedChart({ groups, bucketKeys, granularity }: {
  groups: GroupRow[];
  bucketKeys: string[];
  granularity: BucketGranularity;
}) {
  const groupsByKey = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups]);

  const chartData = useMemo(() => bucketKeys.map((key) => {
    const row: Record<string, number | string> = { key, label: bucketLabel(key, granularity) };
    for (const g of groups) {
      const bucket = fillBuckets(g.stats.buckets, [key])[0];
      row[g.key] = bucket.totalMinutes;
      row[allDayKey(g.key)] = bucket.allDayCount;
    }
    return row;
  }), [groups, bucketKeys, granularity]);

  const hasAllDay = groups.some((g) => chartData.some((row) => (row[allDayKey(g.key)] as number) > 0));
  const labelEvery = Math.max(1, Math.ceil(bucketKeys.length / 14));
  const chartWidth = Math.max(600, bucketKeys.length * 32);

  if (bucketKeys.length === 0 || groups.length === 0) {
    return <p className="text-xs text-muted-foreground/50 py-2">Aucune donnée sur cette période.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ width: "100%", minWidth: chartWidth, height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="label"
              interval={labelEvery - 1}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ className: "stroke-border" }}
            />
            <YAxis
              yAxisId="hours"
              tickFormatter={(v: number) => formatHours(v)}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={40}
              label={{ value: "Heures", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
            />
            {hasAllDay && (
              <YAxis
                yAxisId="events"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={36}
                label={{ value: "Événements", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
              />
            )}
            <Tooltip content={<ChartTooltip groupsByKey={groupsByKey} />} cursor={{ className: "fill-muted/40" }} />
            {groups.map((g) => (
              <Bar key={g.key} yAxisId="hours" dataKey={g.key} stackId="hours" fill={g.color} radius={[0, 0, 0, 0]} maxBarSize={28} />
            ))}
            {hasAllDay && groups.map((g) => (
              <Bar
                key={allDayKey(g.key)}
                yAxisId="events"
                dataKey={allDayKey(g.key)}
                stackId="events"
                fill={g.color}
                radius={[0, 0, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Covers the chart + table while a period change is still being fetched into the shared
 *  event cache, or before the very first load has resolved — otherwise the numbers
 *  underneath would silently jump from stale to correct with no visible cue. */
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-[1px]">
      <Loader2 size={22} className="animate-spin text-muted-foreground" />
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
            <th className="text-right font-medium py-1.5 px-2">Heures</th>
            <th className="text-right font-medium py-1.5 px-2">Moyenne / période</th>
            <th className="text-right font-medium py-1.5 px-2">Jours actifs</th>
            <th className="text-right font-medium py-1.5 px-2">Événements horaires</th>
            <th className="text-right font-medium py-1.5 pl-2">Événements journée</th>
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
              <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{g.stats.timedEventCount}</td>
              <td className="text-right py-1.5 pl-2 tabular-nums text-muted-foreground">{g.stats.allDayEventCount}</td>
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
    <div className="flex flex-col h-screen overflow-hidden bg-background bg-pattern">
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
          <div className="flex flex-wrap items-start justify-between gap-3">
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
            <EventPeriodPicker from={from} to={to} presetDays={presetDays} onPreset={setPreset} onCustom={setCustom} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Du {format(from, "d MMMM", { locale: fr })} au {format(to, "d MMMM", { locale: fr })}.
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

          <div className="relative space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
              <Legend groups={sortedRows} hidden={hidden} onToggle={toggleHidden} onReset={resetHidden} />
              <CombinedChart groups={visibleRows} bucketKeys={bucketKeys} granularity={granularity} />
            </div>

            {sortedRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Rien à afficher.</p>
            ) : visibleRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tous les éléments sont masqués — cliquez sur la légende pour les réafficher.</p>
            ) : (
              <SummaryTable groups={visibleRows} bucketCount={bucketKeys.length} />
            )}

            {(loading || !hasLoadedOnce) && <LoadingOverlay />}
          </div>
        </div>
      </main>
    </div>
  );
}
