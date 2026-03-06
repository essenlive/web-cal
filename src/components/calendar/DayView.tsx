import { useState } from "react";
import {
  format, isSameDay, parseISO, differenceInMinutes, setHours, setMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { useEventsStore, useCalendarStore, useEventTypeStore, useUIStore } from "../../store";
import { EventModal } from "../events/EventModal";
import { EventChip } from "../events/EventChip";
import type { CalendarEvent } from "../../types";

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 64;

export function DayView() {
  const { currentDate } = useUIStore();
  const { events } = useEventsStore();
  const { calendars } = useCalendarStore();
  const { getType } = useEventTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  const visibleCalendarIds = new Set(calendars.filter((c) => c.visible).map((c) => c.id));

  const dayEvents = events.filter((e) => {
    if (!visibleCalendarIds.has(e.calendarId)) return false;
    if (e.allDay) return false;
    return isSameDay(parseISO(e.start), currentDate);
  });

  const getTop = (start: string) => {
    const s = parseISO(start);
    return ((s.getHours() - HOUR_START) * 60 + s.getMinutes()) / 60 * HOUR_HEIGHT;
  };

  const getHeight = (start: string, end: string) =>
    Math.max(differenceInMinutes(parseISO(end), parseISO(start)) / 60 * HOUR_HEIGHT, 24);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-medium text-muted-foreground capitalize">
          {format(currentDate, "EEEE", { locale: fr })}
        </div>
        <div className={cn("text-2xl font-semibold", isSameDay(currentDate, new Date()) ? "text-primary" : "text-foreground")}>
          {format(currentDate, "d MMMM yyyy", { locale: fr })}
        </div>
      </div>

      <div className="flex flex-1 overflow-y-auto">
        <div className="w-14 shrink-0 relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div key={i} className="absolute right-2 text-xs text-muted-foreground" style={{ top: i * HOUR_HEIGHT - 7 }}>
              {HOUR_START + i}h
            </div>
          ))}
        </div>

        <div className="flex-1 relative border-l border-border" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={i}
              onClick={() => { setSelectedEvent(null); setDefaultStart(setMinutes(setHours(currentDate, HOUR_START + i), 0)); setModalOpen(true); }}
              className="absolute left-0 right-0 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
              style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            />
          ))}

          {dayEvents.map((e) => (
            <div
              key={e.id}
              className="absolute left-1 right-1 z-10"
              style={{ top: getTop(e.start), height: getHeight(e.start, e.end) }}
            >
              <EventChip
                event={e}
                eventType={getType(e.eventTypeId)}
                onClick={() => { setSelectedEvent(e); setDefaultStart(undefined); setModalOpen(true); }}
              />
            </div>
          ))}
        </div>
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
