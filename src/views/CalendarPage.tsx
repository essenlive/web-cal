import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { useUIStore } from "../store";

export function CalendarPage() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

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
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <CalendarGrid />
        </main>
      </div>
    </div>
  );
}
