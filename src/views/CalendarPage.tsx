import { useEffect } from "react";
import { format, parse } from "date-fns";
import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { SettingsDrawer } from "../components/settings/SettingsDrawer";
import { useUIStore, usePresetStore, useConnectionStore, useEventTypeStore, useThemeStore } from "../store";
import { stepDate } from "../lib/utils";
import { presetMatchesState } from "../lib/presets";
import type { CalendarView } from "../types";

const VIEW_KEYS: Record<string, CalendarView> = { m: "month", w: "week", d: "day", a: "agenda" };
const VALID_VIEWS: CalendarView[] = Object.values(VIEW_KEYS);
const DATE_FORMAT = "yyyy-MM-dd";

export function CalendarPage() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      // [data-state="open"], not just [role="dialog"]: a just-closed drawer/dialog stays
      // mounted in the DOM for its exit animation (Radix/vaul Presence), which would
      // otherwise silently swallow shortcuts pressed right after closing it.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

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
          const { selectedThemeId } = useThemeStore.getState();
          const active = presetMatchesState(preset, connections, types, selectedThemeId);
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

  // Keeps the URL's ?view=&date=&preset= in sync with the store, in both
  // directions: hydrate store from URL once on mount, then push store
  // changes back to the URL (via replaceState, so navigation doesn't spam
  // history) for every store this page's shortcuts/UI can mutate.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const viewParam = params.get("view") as CalendarView | null;
    if (viewParam && VALID_VIEWS.includes(viewParam)) {
      useUIStore.getState().setView(viewParam);
    }

    const dateParam = params.get("date");
    if (dateParam) {
      const parsed = parse(dateParam, DATE_FORMAT, new Date());
      if (!isNaN(parsed.getTime())) useUIStore.getState().setCurrentDate(parsed);
    }

    const presetParam = params.get("preset");
    if (presetParam) {
      const preset = usePresetStore.getState().presets.find((p) => p.id === presetParam);
      if (preset) usePresetStore.getState().applyPreset(preset.id);
    }

    function syncUrl() {
      const { view, currentDate } = useUIStore.getState();
      const { presets } = usePresetStore.getState();
      const { connections } = useConnectionStore.getState();
      const { types } = useEventTypeStore.getState();
      const { selectedThemeId } = useThemeStore.getState();
      const active = presets.find((p) => presetMatchesState(p, connections, types, selectedThemeId));

      const next = new URLSearchParams();
      next.set("view", view);
      next.set("date", format(currentDate, DATE_FORMAT));
      if (active) next.set("preset", active.id);
      window.history.replaceState(null, "", `${window.location.pathname}?${next}`);
    }
    syncUrl();
    const unsubs = [useUIStore, usePresetStore, useConnectionStore, useEventTypeStore, useThemeStore].map((s) =>
      s.subscribe(syncUrl)
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop — closes sidebar on tap. Starts below the header (top-14) so the
            header, including its sidebar-toggle button, stays visible and reachable while
            the sidebar is open instead of being covered by it. */}
        {sidebarOpen && (
          <div
            className="fixed top-14 inset-x-0 bottom-0 z-30 bg-black/40 sm:hidden"
            onClick={toggleSidebar}
          />
        )}
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <CalendarGrid />
        </main>
      </div>
      <SettingsDrawer />
    </div>
  );
}
