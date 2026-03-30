import { useState } from "react";
import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { EventModal } from "../components/events/EventModal";
import { useUIStore } from "../store";

export function CalendarPage() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [newEventOpen, setNewEventOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop — closes sidebar on tap */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 sm:hidden"
            onClick={toggleSidebar}
          />
        )}
        <Sidebar onNewEvent={() => setNewEventOpen(true)} />
        <main className="flex-1 overflow-hidden flex flex-col">
          <CalendarGrid />
        </main>
      </div>
      <EventModal open={newEventOpen} onClose={() => setNewEventOpen(false)} />
    </div>
  );
}
