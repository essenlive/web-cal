import { useState, useMemo, useCallback } from "react";
import { startOfWeek, addDays } from "date-fns";
import { useUIStore } from "../../store";
import { MonthView } from "./MonthView";
import { TimeGridView } from "./TimeGridView";
import { AgendaView } from "./AgendaView";
import { EventModal } from "../events/EventModal";
import type { CalendarEvent } from "../../types";

export function CalendarGrid() {
  const { view, currentDate, weekStartsOnMonday } = useUIStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  const openEdit = useCallback((e: CalendarEvent) => {
    setSelectedEvent(e);
    setDefaultStart(undefined);
    setModalOpen(true);
  }, []);

  const openCreate = useCallback((start: Date) => {
    setSelectedEvent(null);
    setDefaultStart(start);
    setModalOpen(true);
  }, []);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: weekStartsOnMonday ? 1 : 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, weekStartsOnMonday]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {view === "month" && (
        <MonthView onEventClick={openEdit} onSlotClick={openCreate} />
      )}
      {view === "week" && (
        <TimeGridView days={weekDays} onEventClick={openEdit} onSlotClick={openCreate} />
      )}
      {view === "day" && (
        <TimeGridView days={[currentDate]} onEventClick={openEdit} onSlotClick={openCreate} />
      )}
      {view === "agenda" && <AgendaView />}

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
        defaultStart={defaultStart}
      />
    </div>
  );
}
