import { useState } from "react";
import { format, isToday, isTomorrow, parseISO, startOfDay, isFuture, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { useEventsStore, useCalendarStore, useEventTypeStore, useUIStore } from "../../store";
import { EventModal } from "../events/EventModal";
import type { CalendarEvent } from "../../types";

function getIcon(name: string, size = 14) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} /> : null;
}

function dayLabel(day: Date): string {
  if (isToday(day)) return "Aujourd'hui";
  if (isTomorrow(day)) return "Demain";
  return format(day, "EEEE d MMMM", { locale: fr });
}

export function AgendaView() {
  const { events } = useEventsStore();
  const { calendars } = useCalendarStore();
  const { getType } = useEventTypeStore();
  const { currentDate } = useUIStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const visibleCalendarIds = new Set(calendars.filter((c) => c.visible).map((c) => c.id));

  const upcoming = events
    .filter((e) => {
      if (!visibleCalendarIds.has(e.calendarId)) return false;
      const s = parseISO(e.start);
      return s >= startOfDay(currentDate);
    })
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
    .slice(0, 60);

  // Group by day
  const grouped = upcoming.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = format(parseISO(e.start), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const calendar = (id: string) => calendars.find((c) => c.id === id);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      {Object.keys(grouped).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Icons.CalendarX size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Aucun événement à venir</p>
        </div>
      )}

      {Object.entries(grouped).map(([dateKey, dayEvents]) => {
        const day = new Date(dateKey + "T12:00:00");
        return (
          <div key={dateKey}>
            <div className={cn(
              "text-sm font-semibold mb-2 capitalize",
              isToday(day) ? "text-primary" : "text-foreground"
            )}>
              {dayLabel(day)}
            </div>
            <div className="space-y-2">
              {dayEvents.map((e) => {
                const type = getType(e.eventTypeId);
                const cal = calendar(e.calendarId);
                return (
                  <div
                    key={e.id}
                    onClick={() => { setSelectedEvent(e); setModalOpen(true); }}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    {/* Type icon */}
                    <div
                      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: (type?.color ?? "#6366f1") + "20", color: type?.color ?? "#6366f1" }}
                    >
                      {getIcon(type?.icon ?? "Calendar", 16)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{e.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {e.allDay ? "Journée" : `${format(parseISO(e.start), "HH:mm")} – ${format(parseISO(e.end), "HH:mm")}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {type && (
                          <span className="text-xs font-medium" style={{ color: type.color }}>
                            {type.label}
                          </span>
                        )}
                        {cal && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: cal.color }} />
                            {cal.name}
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
