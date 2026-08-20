import { useState, useMemo, useCallback } from "react";
import { startOfWeek, addDays } from "date-fns";
import { useUIStore, useEventsStore } from "../../store";
import { MonthView } from "./MonthView";
import { TimeGridView } from "./TimeGridView";
import { AgendaView } from "./AgendaView";
import { CalendarSkeleton } from "./CalendarSkeleton";
import { EventDetail } from "../events/EventDetail";
import type { CalendarEvent } from "../../types";

export function CalendarGrid() {
  const { view, currentDate, weekStartsOnMonday } = useUIStore();
  const { hasLoadedOnce } = useEventsStore();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const openDetail = useCallback((e: CalendarEvent) => {
    setSelectedEvent(e);
  }, []);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: weekStartsOnMonday ? 1 : 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, weekStartsOnMonday]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {!hasLoadedOnce ? (
        <CalendarSkeleton />
      ) : (
        <>
          {view === "month" && <MonthView onEventClick={openDetail} />}
          {view === "week" && <TimeGridView days={weekDays} onEventClick={openDetail} />}
          {view === "day" && <TimeGridView days={[currentDate]} onEventClick={openDetail} />}
          {view === "agenda" && <AgendaView />}
        </>
      )}

      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
