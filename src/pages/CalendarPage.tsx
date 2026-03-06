import { useState } from "react";
import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { RBCCalendar } from "../components/calendar/RBCCalendar";
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
          {view !== "agenda" ? <RBCCalendar /> : <AgendaView />}
        </main>
      </div>
      <EventModal open={newEventOpen} onClose={() => setNewEventOpen(false)} />
    </div>
  );
}
