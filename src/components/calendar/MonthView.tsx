import { useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { useEventsStore, useCalendarStore, useEventTypeStore, useUIStore } from "../../store";
import { EventChip } from "../events/EventChip";
import { EventModal } from "../events/EventModal";
import type { CalendarEvent } from "../../types";

const MAX_VISIBLE = 3;

export function MonthView() {
  const { currentDate, weekStartsOnMonday } = useUIStore();
  const { events } = useEventsStore();
  const { calendars } = useCalendarStore();
  const { getType } = useEventTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  const visibleCalendarIds = new Set(calendars.filter((c) => c.visible).map((c) => c.id));
  const weekStart = weekStartsOnMonday ? 1 : 0;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: weekStart });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: weekStart });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEE", { locale: fr })
  );

  const getEventsForDay = (day: Date) =>
    events.filter((e) => {
      if (!visibleCalendarIds.has(e.calendarId)) return false;
      return isSameDay(new Date(e.start), day);
    });

  const openCreate = (day: Date) => {
    setSelectedEvent(null);
    const d = new Date(day);
    d.setHours(9, 0, 0, 0);
    setDefaultStart(d);
    setModalOpen(true);
  };

  const openEdit = (e: CalendarEvent) => {
    setSelectedEvent(e);
    setDefaultStart(undefined);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {dayHeaders.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground capitalize">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - MAX_VISIBLE;
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => openCreate(day)}
              className={cn(
                "border-b border-r border-border p-1.5 cursor-pointer group transition-colors hover:bg-muted/40 min-h-[90px]",
                !inMonth && "opacity-40"
              )}
            >
              <div className="flex justify-end mb-1">
                <span
                  className={cn(
                    "inline-flex items-center justify-center size-6 rounded-full text-xs font-medium",
                    today ? "bg-primary text-primary-foreground" : "text-foreground group-hover:bg-muted"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-0.5">
                {visible.map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    eventType={getType(e.eventTypeId)}
                    compact
                    onClick={(ev?: React.MouseEvent) => { ev?.stopPropagation(); openEdit(e); }}
                  />
                ))}
                {overflow > 0 && (
                  <div className="text-xs text-muted-foreground pl-1">+{overflow} autre{overflow > 1 ? "s" : ""}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
        defaultStart={defaultStart}
      />
    </div>
  );
}
