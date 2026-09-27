"use client";

/**
 * EventPeriodPicker — shared "choose and load a period of events" control: preset
 * buttons (7 jours/28 jours/3 mois) plus two custom date inputs, with a loading
 * spinner while the chosen range is being fetched into the shared event cache. Pairs
 * with useEventPeriod, which owns the actual loadRange call. Currently used by
 * StatsPage; EventSearch's own inline date filter could migrate to this later.
 */

import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { PERIOD_PRESETS } from "../../hooks/useEventPeriod";

export function EventPeriodPicker({ from, to, presetDays, loading, onPreset, onCustom }: {
  from: Date;
  to: Date;
  /** Which preset (if any) matches the current range, for highlighting — null once the dates were edited by hand. */
  presetDays: number | null;
  loading?: boolean;
  onPreset: (days: number) => void;
  onCustom: (from: Date, to: Date) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-border overflow-hidden bg-background w-fit">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => onPreset(p.days)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              presetDays === p.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="date"
          value={format(from, "yyyy-MM-dd")}
          onChange={(e) => e.target.value && onCustom(parseISO(e.target.value), to)}
          max={format(to, "yyyy-MM-dd")}
          className="rounded-md border border-border bg-background px-1.5 py-1.5 text-foreground"
          aria-label="Depuis le"
        />
        <span>–</span>
        <input
          type="date"
          value={format(to, "yyyy-MM-dd")}
          onChange={(e) => e.target.value && onCustom(from, parseISO(e.target.value))}
          min={format(from, "yyyy-MM-dd")}
          className="rounded-md border border-border bg-background px-1.5 py-1.5 text-foreground"
          aria-label="Jusqu'au"
        />
      </div>
      {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
    </div>
  );
}
