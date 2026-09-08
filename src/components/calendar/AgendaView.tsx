import { useMemo, useState } from "react";
import { format, isSameDay, parseISO, startOfDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import { zonedNow } from "../../lib/timezone";
import { getBadgeContent, resolveStyle } from "../events/EventChip";
import { EventDetail } from "../events/EventDetail";
import type { CalendarEvent } from "../../types";


function dayLabel(day: Date, now: Date): string {
  if (isSameDay(day, now)) return "Aujourd'hui";
  if (isSameDay(day, addDays(now, 1))) return "Demain";
  return format(day, "EEEE d MMMM", { locale: fr });
}

export function AgendaView() {
  const { visibleEvents: events, resolved } = useResolvedEvents();
  const { currentDate, use24h, dateFormatEU, timezone } = useUIStore();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const now = zonedNow(timezone);

  // Expand all-day events across every day they span; group by day. Memoized per
  // (events, currentDate) instead of recomputed from scratch on every render — see
  // specs/008-events-perf-caching/research.md Decision G (same rationale as
  // MonthView's day-bucketing, applied here since this grouping wasn't memoized at all).
  const { grouped, sortedKeys } = useMemo(() => {
    const groupedMap: Record<string, CalendarEvent[]> = {};
    const cutoff = startOfDay(currentDate);

    for (const e of events) {
      if (e.allDay) {
        const eStart = startOfDay(parseISO(e.start));
        const eEnd   = startOfDay(parseISO(e.end));
        let d = eStart < cutoff ? cutoff : eStart;
        while (d < eEnd) {
          const key = format(d, "yyyy-MM-dd");
          if (!groupedMap[key]) groupedMap[key] = [];
          // Only push once per day (avoid duplicate if event already in list)
          if (!groupedMap[key].find((x) => x.id === e.id)) groupedMap[key].push(e);
          d = new Date(d.getTime() + 86400000);
          if (d.getTime() - cutoff.getTime() > 60 * 86400000) break; // cap at 60 days
        }
      } else {
        const s = parseISO(e.start);
        if (s < cutoff) continue;
        const key = format(s, "yyyy-MM-dd");
        if (!groupedMap[key]) groupedMap[key] = [];
        groupedMap[key].push(e);
      }
    }

    // Sort within each day, then cap total days shown
    const keys = Object.keys(groupedMap).sort().slice(0, 60);
    for (const key of keys) {
      groupedMap[key].sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return parseISO(a.start).getTime() - parseISO(b.start).getTime();
      });
    }

    return { grouped: groupedMap, sortedKeys: keys };
  }, [events, currentDate]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      {Object.keys(grouped).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Icons.CalendarX size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Aucun événement à venir</p>
        </div>
      )}

      {sortedKeys.map((dateKey) => {
        const dayEvents = grouped[dateKey];
        const day = new Date(dateKey + "T12:00:00");
        return (
          <div key={dateKey}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={cn(
                "text-sm font-semibold capitalize",
                isSameDay(day, now) ? "text-primary" : "text-foreground"
              )}>
                {dayLabel(day, now)}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(day, dateFormatEU ? "dd/MM/yyyy" : "MM/dd/yyyy")}
              </span>
            </div>
            <div className="space-y-2">
              {dayEvents.map((e) => {
                const type = resolved.get(e.id)?.type;
                const agendaStyle = resolveStyle(type, "agenda", e.allDay);
                // For 'background' style in agenda: color the left border of the row
                const isDayStyle  = agendaStyle === "background";
                const rowColor    = isDayStyle ? type?.color : undefined;
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer transition-colors group",
                      isDayStyle ? "hover:brightness-95" : "border-border hover:bg-muted/40"
                    )}
                    style={rowColor ? {
                      backgroundColor: rowColor + "12",
                      borderColor: rowColor + "60",
                      borderLeftColor: rowColor,
                      borderLeftWidth: 3,
                    } : undefined}
                  >
                    {/* Type indicator — colored dot for day style (matches month's background tint),
                        otherwise a small badge circle (matches month's avatar-* styling) */}
                    {isDayStyle ? (
                      <div className="mt-0.5 size-3 rounded-full shrink-0 self-center" style={{ backgroundColor: rowColor }} />
                    ) : (
                      <div
                        className="mt-0.5 flex items-center justify-center size-6 rounded-full shrink-0"
                        style={{ backgroundColor: type?.color ?? "#6366f1" }}
                      >
                        {getBadgeContent(type, e.title, 12)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{e.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {e.allDay ? "Journée" : `${format(parseISO(e.start), use24h ? "HH:mm" : "h:mm a")} – ${format(parseISO(e.end), use24h ? "HH:mm" : "h:mm a")}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {type && (
                          <span className="text-xs font-medium" style={{ color: type.color }}>
                            {type.label}
                          </span>
                        )}
                        {e.location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Icons.MapPin size={10} />
                            {e.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
