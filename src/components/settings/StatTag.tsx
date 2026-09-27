"use client";

/**
 * StatTag — compact "Xh/sem" pill for a DrawerItemRow/RuleEditRow, summarizing a
 * group's (source/type/rule) activity over the fixed STATS_WINDOW_DAYS window.
 * Hovering shows the full breakdown (total hours, event count, active days/week)
 * — see useEventStatsByGroup for how the underlying GroupStats are computed.
 */

import { SimpleTooltip } from "../ui/tooltip";
import { formatHours, STATS_WINDOW_DAYS, type GroupStats } from "../../lib/eventStats";

export function StatTag({ stats }: { stats: GroupStats }) {
  const weeks = STATS_WINDOW_DAYS / 7;
  const perWeekMinutes = stats.totalMinutes / weeks;
  const daysPerWeek = stats.activeDays / weeks;

  if (stats.eventCount === 0) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/40">
        —
      </span>
    );
  }

  const detail = [
    `${formatHours(stats.totalMinutes)} sur les ${STATS_WINDOW_DAYS} derniers jours`,
    `${stats.eventCount} événement${stats.eventCount > 1 ? "s" : ""}`,
    `${daysPerWeek.toFixed(1)} j/sem actifs`,
  ].join(" · ");

  return (
    <SimpleTooltip label={detail}>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {formatHours(perWeekMinutes)}/sem
      </span>
    </SimpleTooltip>
  );
}
