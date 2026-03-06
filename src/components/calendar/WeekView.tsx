import { useState } from "react";
import {
  startOfWeek, endOfWeek, eachDayOfInterval, format, isToday, isSameDay,
  parseISO, differenceInMinutes, setHours, setMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { useEventsStore, useCalendarStore, useEventTypeStore, useUIStore } from "../../store";
import { EventChip } from "../events/EventChip";
import { EventModal } from "../events/EventModal";
import type { CalendarEvent } from "../../types";

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 60; // px

export function WeekView() {
  const { currentDate, weekStartsOnMonday } = useUIStore();
  const { events } = useEventsStore();
  const { calendars } = useCalendarStore();
  const { getType } = useEventTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  const weekStart = weekStartsOnMonday ? 1 : 0;
  const days = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: weekStart }),
    end: endOfWeek(currentDate, { weekStartsOn: weekStart }),
  });

  const visibleCalendarIds = new Set(calendars.filter((c) => c.visible).map((c) => c.id));

  const getEventsForDay = (day: Date) =>
    events.filter((e) => {
      if (!visibleCalendarIds.has(e.calendarId)) return false;
      if (e.allDay) return false;
      const s = parseISO(e.start);
      return isSameDay(s, day) && s.getHours() >= HOUR_START;
    });

  const getTopOffset = (start: string) => {
    const s = parseISO(start);
    const minutesFromStart = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
    return (minutesFromStart / 60) * HOUR_HEIGHT;
  };

  const getHeight = (start: string, end: string) => {
    const mins = differenceInMinutes(parseISO(end), parseISO(start));
    return Math.max((mins / 60) * HOUR_HEIGHT, 20);
  };

  const openCreate = (day: Date, hour: number) => {
    setSelectedEvent(null);
    setDefaultStart(setMinutes(setHours(day, hour), 0));
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b border-border">
        <div className="w-12 shrink-0" />
        {days.map((day) => (
          <div key={day.toISOString()} className="flex-1 py-2 text-center border-l border-border first:border-l-0">
            <div className="text-xs font-medium text-muted-foreground capitalize">
              {format(day, "EEE", { locale: fr })}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Hour labels */}
        <div className="w-12 shrink-0 relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={i}
              className="absolute right-2 text-xs text-muted-foreground"
              style={{ top: i * HOUR_HEIGHT - 7 }}
            >
              {i + HOUR_START}h
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 relative border-l border-border"
              style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
            >
              {/* Hour slots (click targets) */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  onClick={() => openCreate(day, HOUR_START + i)}
                  className="absolute left-0 right-0 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              ))}

              {/* Events */}
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className="absolute left-0.5 right-0.5 z-10"
                  style={{ top: getTopOffset(e.start), height: getHeight(e.start, e.end) }}
                >
                  <EventChip
                    event={e}
                    eventType={getType(e.eventTypeId)}
                    onClick={(ev?: React.MouseEvent) => { ev?.stopPropagation(); setSelectedEvent(e); setModalOpen(true); }}
                  />
                </div>
              ))}
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
