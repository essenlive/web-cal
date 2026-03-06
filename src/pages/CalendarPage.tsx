import { useState } from "react";
import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { MonthView } from "../components/calendar/MonthView";
import { WeekView } from "../components/calendar/WeekView";
import { DayView } from "../components/calendar/DayView";
import { AgendaView } from "../components/calendar/AgendaView";
import { EventModal } from "../components/events/EventModal";
import { useUIStore } from "../store";

export function CalendarPage() {
  const { view } = useUIStore();
  const [newEventOpen, setNewEventOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onNewEvent={() => setNewEventOpen(true)} />
        <main className="flex-1 overflow-hidden flex flex-col">
          {view === "month" && <MonthView />}
          {view === "week" && <WeekView />}
          {view === "day" && <DayView />}
          {view === "agenda" && <AgendaView />}
        </main>
      </div>
      <EventModal open={newEventOpen} onClose={() => setNewEventOpen(false)} />
    </div>
  );
}
