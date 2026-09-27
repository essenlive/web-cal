"use client";

/**
 * StatsPage — dedicated "how busy is each source/type/rule" view (see project thread:
 * Quentin picked a full page over per-drawer summaries once he saw the compact-pill
 * version and wanted the underlying numbers displayed on their own, with a range picker
 * and a bit of visual interactivity, rather than squeezed into the existing drawers).
 *
 * Three tabs (Sources/Types/Règles) share one aggregation (useEventStatsByGroup) over a
 * user-picked date range, each row showing total hours/event count/active days for that
 * range plus a small per-week bar sparkline (hover a bar for that week's total).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useConnectionStore, useEventTypeStore, useRuleStore, useEventsStore } from "../store";
import { useSourceSync } from "../context/DataProviderContext";
import { useEventStatsByGroup } from "../hooks/useEventStatsByGroup";
import { formatHours, emptyStats, type RangeStats, type WeekBucket } from "../lib/eventStats";
import { describeMatch } from "../lib/rules";
import { EnsureSourceRule } from "./RulesPage";
import { ItemBadge } from "../components/sidebar/ItemRow";
import { SimpleTooltip } from "../components/ui/tooltip";
import { getIconEl } from "../lib/icons";
import type { Rule } from "../types";

const RANGE_PRESETS = [
  { days: 7, label: "7 jours" },
  { days: 28, label: "28 jours" },
  { days: 90, label: "3 mois" },
] as const;

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "types", label: "Types" },
  { id: "rules", label: "Règles" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Small per-week bar chart — one bar per week in range, scaled to the tab's tallest bar so rows stay visually comparable. Hover a bar for that week's total. */
function Sparkline({ weeks, maxMinutes }: { weeks: WeekBucket[]; maxMinutes: number }) {
  if (weeks.length === 0) return <span className="text-[10px] text-muted-foreground/40">—</span>;
  return (
    <div className="flex items-end gap-0.5 h-6 shrink-0">
      {weeks.map((w) => {
        const height = maxMinutes > 0 ? Math.max(2, Math.round((w.totalMinutes / maxMinutes) * 24)) : 2;
        return (
          <SimpleTooltip
            key={w.weekStart}
            label={`Semaine du ${format(new Date(w.weekStart), "d MMM", { locale: fr })} · ${formatHours(w.totalMinutes)}`}
          >
            <div className="w-1.5 rounded-t bg-primary/60 hover:bg-primary transition-colors" style={{ height }} />
          </SimpleTooltip>
        );
      })}
    </div>
  );
}

function GroupRow({ badge, name, stats, maxWeekMinutes, weeks }: {
  badge: React.ReactNode;
  name: React.ReactNode;
  stats: RangeStats;
  maxWeekMinutes: number;
  weeks: number;
}) {
  const perWeek = weeks > 0 ? stats.totalMinutes / weeks : 0;
  const daysPerWeek = weeks > 0 ? stats.activeDays / weeks : 0;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      {badge}
      <span className="flex-1 min-w-0 truncate text-sm text-foreground">{name}</span>
      <Sparkline weeks={stats.weeks} maxMinutes={maxWeekMinutes} />
      <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground tabular-nums">
        <span className="w-14 text-right">{formatHours(stats.totalMinutes)} total</span>
        <span className="w-16 text-right">{formatHours(perWeek)}/sem</span>
        <span className="w-16 text-right">{daysPerWeek.toFixed(1)} j/sem</span>
        <span className="w-16 text-right">{stats.eventCount} évt.</span>
      </div>
    </div>
  );
}

export function StatsPage() {
  const [tab, setTab] = useState<TabId>("sources");
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_PRESETS)[number]["days"]>(28);
  const [rangeLoading, setRangeLoading] = useState(false);

  const to = endOfDay(new Date());
  const from = startOfDay(subDays(to, rangeDays - 1));
  const weeks = Math.ceil(rangeDays / 7);

  const { loadRange } = useSourceSync();
  const { hasLoadedOnce, events } = useEventsStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { bySource, byType, byRule } = useEventStatsByGroup(from, to);

  // Widens the shared range cache to cover the chosen period — same cache-aware
  // loadRange the search modal's date filter uses — so switching to "3 mois" reflects
  // real data instead of silently showing zeros for a period the app hasn't loaded yet.
  useEffect(() => {
    // Deferred a microtask out, same as EventSearch.tsx's date-filter effect — the
    // linter flags setState called synchronously during the effect body.
    void Promise.resolve().then(() => {
      setRangeLoading(true);
      void loadRange(from, to).finally(() => setRangeLoading(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, loadRange]);

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
        {rangeLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
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
            <div className="flex rounded-xl border border-border overflow-hidden bg-background w-fit">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setRangeDays(p.days)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-colors",
                    rangeDays === p.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Du {format(from, "d MMMM", { locale: fr })} au {format(to, "d MMMM", { locale: fr })} — heures totales, moyenne par semaine, jours actifs par semaine.
            {!hasLoadedOnce && " Chargement des événements…"}
          </p>

          <div className="space-y-1.5">
            {sortedRows.length === 0 && <p className="text-xs text-muted-foreground">Rien à afficher.</p>}
            {sortedRows.map((r) => (
              <GroupRow key={r.key} badge={r.badge} name={r.name} stats={r.stats} maxWeekMinutes={maxWeekMinutes} weeks={weeks} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
