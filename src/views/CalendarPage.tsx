import { useEffect } from "react";
import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { useUIStore, usePresetStore, useConnectionStore, useEventTypeStore } from "../store";
import { stepDate } from "../lib/utils";
import { presetMatchesState } from "../lib/presets";
import type { CalendarView } from "../types";

const VIEW_KEYS: Record<string, CalendarView> = { m: "month", w: "week", d: "day", a: "agenda" };

export function CalendarPage() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;

      const { view, currentDate, setCurrentDate, setView } = useUIStore.getState();
      const key = e.key.toLowerCase();
      // Digit-row shortcuts key off e.code (physical key), not e.key: on AZERTY
      // and other non-QWERTY layouts, the digit characters themselves need Shift.
      const digitMatch = e.code.match(/^Digit(\d)$/);

      if (key in VIEW_KEYS) {
        setView(VIEW_KEYS[key]);
      } else if (digitMatch) {
        const n = Number(digitMatch[1]);
        const presetStore = usePresetStore.getState();
        if (n === 0) {
          presetStore.clearPreset();
        } else {
          const preset = presetStore.presets[n - 1];
          if (!preset) return;
          const { connections } = useConnectionStore.getState();
          const { types } = useEventTypeStore.getState();
          const active = presetMatchesState(preset, connections, types);
          if (active) presetStore.clearPreset();
          else presetStore.applyPreset(preset.id);
        }
      } else if (e.key === "ArrowLeft") {
        setCurrentDate(stepDate(view, currentDate, -1));
      } else if (e.key === "ArrowRight") {
        setCurrentDate(stepDate(view, currentDate, 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
