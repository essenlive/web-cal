import { useState } from "react";
import { format, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { useEventsStore, useEventTypeStore, useUIStore, useConnectionStore } from "../../store";
import { EventChip, resolveStyle, resolveEventType } from "../events/EventChip";
import { EventModal } from "../events/EventModal";
import type { CalendarEvent } from "../../types";


function dayLabel(day: Date): string {
  if (isToday(day)) return "Aujourd'hui";
  if (isTomorrow(day)) return "Demain";
  return format(day, "EEEE d MMMM", { locale: fr });
}

export function AgendaView() {
  const { events } = useEventsStore();
  const { getType } = useEventTypeStore();
  const { currentDate, use24h, dateFormatEU, defaultEventTypeId } = useUIStore();
  const { connections } = useConnectionStore();
  const getConnection = (calendarId: string) => connections.find((c) => c.id === calendarId);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Expand all-day events across every day they span; group by day
  const grouped: Record<string, CalendarEvent[]> = {};
  const cutoff = startOfDay(currentDate);

  for (const e of events) {
    if (e.allDay) {
      const eStart = startOfDay(parseISO(e.start));
      const eEnd   = startOfDay(parseISO(e.end));
      let d = eStart < cutoff ? cutoff : eStart;
      while (d < eEnd) {
        const key = format(d, "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        // Only push once per day (avoid duplicate if event already in list)
        if (!grouped[key].find((x) => x.id === e.id)) grouped[key].push(e);
        d = new Date(d.getTime() + 86400000);
        if (d.getTime() - cutoff.getTime() > 60 * 86400000) break; // cap at 60 days
      }
    } else {
      const s = parseISO(e.start);
      if (s < cutoff) continue;
      const key = format(s, "yyyy-MM-dd");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    }
  }

  // Sort within each day, then cap total days shown
  const sortedKeys = Object.keys(grouped).sort().slice(0, 60);
  for (const key of sortedKeys) {
    grouped[key].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return parseISO(a.start).getTime() - parseISO(b.start).getTime();
    });
  }

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
                isToday(day) ? "text-primary" : "text-foreground"
              )}>
                {dayLabel(day)}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(day, dateFormatEU ? "dd/MM/yyyy" : "MM/dd/yyyy")}
              </span>
            </div>
            <div className="space-y-2">
              {dayEvents.map((e) => {
                const type = resolveEventType(e, getType, getConnection, defaultEventTypeId);
                const agendaStyle = resolveStyle(type, "agenda", e.allDay);
                // For 'day' style in agenda: color the left border of the row
                const isDayStyle  = agendaStyle === "day";
                const rowColor    = isDayStyle ? type?.color : undefined;
                return (
                  <div
                    key={e.id}
                    onClick={() => { setSelectedEvent(e); setModalOpen(true); }}
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
                    {/* Event chip — avatar badge or block chip; null for day style */}
                    {!isDayStyle && (
                      <div className="mt-0.5 shrink-0">
                        <EventChip event={e} eventType={type} view="agenda" />
                      </div>
                    )}
                    {isDayStyle && (
                      <div className="mt-0.5 size-3 rounded-full shrink-0 self-center" style={{ backgroundColor: rowColor }} />
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

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}
