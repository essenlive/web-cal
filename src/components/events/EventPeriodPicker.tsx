"use client";

/**
 * EventPeriodPicker — shared "choose and load a period of events" control: preset
 * buttons (7 jours/28 jours/3 mois) plus the app's own calendar-based DateRangePicker,
 * and a caption showing what's actually covered by the shared event cache right now
 * (which can lag behind the selected period while a fetch is in flight, or extend past
 * it from ordinary calendar browsing). Pairs with useEventPeriod, which owns the actual
 * loadRange call — callers show their own loading indicator over whatever depends on the
 * data (see StatsPage's overlay) rather than this control owning that.
 */

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { PERIOD_PRESETS } from "../../hooks/useEventPeriod";
import { useEventCacheSpan } from "../../hooks/useEventCacheSpan";
import { DateRangePicker } from "../ui/date-range-picker";

export function EventPeriodPicker({ from, to, presetDays, onPreset, onCustom }: {
  from: Date;
  to: Date;
  /** Which preset (if any) matches the current range, for highlighting — null once the dates were edited by hand. */
  presetDays: number | null;
  onPreset: (days: number) => void;
  onCustom: (from: Date, to: Date) => void;
}) {
  const cacheSpan = useEventCacheSpan();

  return (
    <div className="flex flex-col gap-1.5">
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
        <DateRangePicker
          from={from}
          to={to}
          onChange={(range) => {
            if (range.from && range.to) onCustom(range.from, range.to);
          }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        Cache d&rsquo;événements :{" "}
        {cacheSpan
          ? `chargé du ${format(cacheSpan.start, "d MMM yyyy", { locale: fr })} au ${format(cacheSpan.end, "d MMM yyyy", { locale: fr })}`
          : "aucune donnée chargée pour l'instant"}
      </p>
    </div>
  );
}
