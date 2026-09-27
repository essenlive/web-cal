"use client";

/**
 * StatsPage — dedicated "how busy is each source/type/rule" view (see project thread:
 * Quentin picked a full page over per-drawer summaries once he saw the compact-pill
 * version, then asked for the period to be freely editable — not just fixed presets —
 * and for the charts to be bigger and clearer).
 *
 * Three tabs (Sources/Types/Règles) share one aggregation (useEventStatsByGroup) over a
 * period picked with the shared EventPeriodPicker/useEventPeriod (presets + custom
 * dates, which also loads the range into the shared event cache). Each row shows
 * total hours/event count/active days for that period plus a per-week bar chart
 * (hover a bar for that week's total).
 */

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { useConnectionStore, useEventTypeStore, useRuleStore, useEventsStore } from "../store";
import { useEventStatsByGroup } from "../hooks/useEventStatsByGroup";
import { useEventPeriod } from "../hooks/useEventPeriod";
import { formatHours, emptyStats, enumerateWeeks, fillWeeks, type RangeStats, type WeekBucket } from "../lib/eventStats";
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

/** Per-week bar chart — one bar per week in range, scaled to the tab's tallest bar so rows stay visually comparable. A short date labels each bar; hovering shows that week's total. */
function WeekChart({ weeks, maxMinutes }: { weeks: WeekBucket[]; maxMinutes: number }) {
  if (weeks.length === 0) {
    return <p className="text-xs text-muted-foreground/50 py-1">Aucune donnée sur cette période.</p>;
  }
  return (
    <div className="flex items-end gap-1.5 h-20">
      {weeks.map((w) => {
        const height = maxMinutes > 0 ? Math.max(3, Math.round((w.totalMinutes / maxMinutes) * 72)) : 3;
        return (
          <div key={w.weekStart} className="flex-1 min-w-0 flex flex-col items-center gap-1">
            <SimpleTooltip label={`Semaine du ${format(new Date(w.weekStart), "d MMMM", { locale: fr })} · ${formatHours(w.totalMinutes)}`}>
              <div className="w-full max-w-8 rounded-t bg-primary/70 hover:bg-primary transition-colors" style={{ height }} />
            </SimpleTooltip>
            <span className="text-[10px] text-muted-foreground/70 truncate w-full text-center">
              {format(new Date(w.weekStart), "d MMM", { locale: fr })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GroupCard({ badge, name, stats, chartWeeks, maxWeekMinutes, weekCount }: {
  badge: React.ReactNode;
  name: React.ReactNode;
  stats: RangeStats;
  /** stats.weeks filled in with zero-hour weeks for the ones with no events — see enumerateWeeks/fillWeeks. */
  chartWeeks: WeekBucket[];
  maxWeekMinutes: number;
  weekCount: number;
}) {
  const perWeek = weekCount > 0 ? stats.totalMinutes / weekCount : 0;
  const daysPerWeek = weekCount > 0 ? stats.activeDays / weekCount : 0;
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-3 space-y-2">
      <div className="flex items-center gap-3">
        {badge}
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{name}</span>
        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground tabular-nums">
          <span className="w-16 text-right">{formatHours(stats.totalMinutes)} total</span>
          <span className="w-16 text-right">{formatHours(perWeek)}/sem</span>
          <span className="w-16 text-right">{daysPerWeek.toFixed(1)} j/sem</span>
          <span className="w-14 text-right">{stats.eventCount} évt.</span>
        </div>
      </div>
      <WeekChart weeks={chartWeeks} maxMinutes={maxWeekMinutes} />
    </div>
  );
}

export function StatsPage() {
  const [tab, setTab] = useState<TabId>("sources");
  const { from, to, presetDays, loading, setPreset, setCustom } = useEventPeriod(28);
  const weeks = Math.max(1, (differenceInCalendarDays(to, from) + 1) / 7);

  const { hasLoadedOnce, events } = useEventsStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { bySource, byType, byRule } = useEventStatsByGroup(from, to);

  const orderedRules = rules.filter((r) => r.matchType === "name" || r.matchType === "source");
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;
  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;

  const rows =
    tab === "sources"
      ? connections.map((c) => ({
          key: c.id,
          badge: <ItemBadge color={c.color}>{c.name.trim().charAt(0).toUpperCase()}</ItemBadge>,
          name: c.name,
          stats: bySource.get(c.id) ?? emptyStats(),
        }))
      : tab === "types"
      ? types.map((t) => ({
          key: t.id,
          badge: <ItemBadge color={t.color}>{getIconEl(t.icon, 10, "#fff")}</ItemBadge>,
          name: t.label,
          stats: byType.get(t.id) ?? emptyStats(),
        }))
      : orderedRules.map((r: Rule) => {
          const type = types.find((t) => t.id === r.displayTypeId);
          return {
            key: r.id,
            badge: type
              ? <ItemBadge color={type.color}>{getIconEl(type.icon, 10, "#fff")}</ItemBadge>
              : <ItemBadge color="#94a3b8">?</ItemBadge>,
            name: describeMatch(r, getEventTitle, getConnectionName),
            stats: byRule.get(r.id) ?? emptyStats(),
          };
        });

  const sortedRows = [...rows].sort((a, b) => b.stats.totalMinutes - a.stats.totalMinutes);
  const allWeeks = enumerateWeeks(from, to);
  const maxWeekMinutes = Math.max(0, ...sortedRows.flatMap((r) => r.stats.weeks.map((w) => w.totalMinutes)));

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

          <p className="text-xs text-muted-foreground">
            Du {format(from, "d MMMM", { locale: fr })} au {format(to, "d MMMM", { locale: fr })} — heures totales, moyenne par semaine, jours actifs par semaine.
            {!hasLoadedOnce && " Chargement des événements…"}
          </p>

          <div className="space-y-2">
            {sortedRows.length === 0 && <p className="text-xs text-muted-foreground">Rien à afficher.</p>}
            {sortedRows.map((r) => (
              <GroupCard
                key={r.key}
                badge={r.badge}
                name={r.name}
                stats={r.stats}
                chartWeeks={fillWeeks(r.stats.weeks, allWeeks)}
                maxWeekMinutes={maxWeekMinutes}
                weekCount={weeks}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
