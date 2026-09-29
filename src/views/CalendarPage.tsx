import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Header } from "../components/sidebar/Header";
import { Sidebar } from "../components/sidebar/Sidebar";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { SettingsDrawer } from "../components/settings/SettingsDrawer";
import { useUIStore, usePresetStore, useConnectionStore, useEventTypeStore, useThemeStore, useOnboardingStore } from "../store";
import { useOnboardingSteps } from "../components/settings/GettingStarted";
import { coreDone, isFreshInstance } from "../lib/onboarding";
import { stepDate } from "../lib/utils";
import { presetMatchesState } from "../lib/presets";
import { formatUrlDate, fromSearch, historyAction, toSearch, type UrlState } from "../lib/url-state";
import type { CalendarView } from "../types";

const VIEW_KEYS: Record<string, CalendarView> = { m: "month", w: "week", d: "day", a: "agenda" };

/** Session flag: the Help drawer auto-opens at most once per tab session. */
const HELP_AUTO_OPENED = "overcal:help-auto-opened";

/**
 * "Bien démarrer" wiring (see GettingStarted.tsx): on a fresh instance (only the demo source)
 * whose checklist wasn't dismissed, open the Help drawer once per session; and toast when the
 * three core steps become done — only on that transition, never on load if already done.
 */
function useOnboarding() {
  const steps = useOnboardingSteps();
  const ready = coreDone(steps);
  const wasReady = useRef(ready);

  useEffect(() => {
    if (ready && !wasReady.current) toast.success("C'est prêt ! Tes sources, types et règles sont en place.");
    wasReady.current = ready;
  }, [ready]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(HELP_AUTO_OPENED)) return;
      if (useOnboardingStore.getState().dismissed || !isFreshInstance(useConnectionStore.getState().connections)) return;
      sessionStorage.setItem(HELP_AUTO_OPENED, "1");
    } catch {
      return; // no sessionStorage (private mode…): don't risk opening on every load
    }
    useUIStore.getState().openDrawer("help");
  }, []);
}

export function CalendarPage() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  useOnboarding();

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

  // URL ⇄ app state, in both directions (lib/url-state.ts): hydrate the store from the URL on
  // mount, then record every store change in browser history — a new entry for navigation
  // (view, period, a preset becoming active, opening a drawer), a replace for tweaks — and
  // restore the popped state on Back/Forward.
  useEffect(() => {
    const path = window.location.pathname;
    /** history.state marker on entries pushed for an open drawer — closing it then steps back. */
    const DRAWER_ENTRY = { webcalDrawer: true };
    let restoring = false;

    function current(): UrlState {
      const { view, currentDate, activeDrawer } = useUIStore.getState();
      const { presets } = usePresetStore.getState();
      const { connections } = useConnectionStore.getState();
      const { types } = useEventTypeStore.getState();
      const { selectedThemeId } = useThemeStore.getState();
      const active = presets.find((p) => presetMatchesState(p, connections, types, selectedThemeId));
      return { view, date: formatUrlDate(currentDate), presetId: active?.id, drawer: activeDrawer ?? undefined };
    }

    /** Applies whatever `search` validly encodes. A missing preset can't be "un-applied" (the URL
     *  doesn't hold the visibility it replaced), so only a present one is restored. */
    function apply(search: string, closeMissingDrawer: boolean) {
      const url = fromSearch(search);
      const ui = useUIStore.getState();
      if (url.view && url.view !== ui.view) ui.setView(url.view);
      if (url.dateValue && url.date !== formatUrlDate(ui.currentDate)) ui.setCurrentDate(url.dateValue);
      if (url.presetId && url.presetId !== current().presetId) {
        const preset = usePresetStore.getState().presets.find((p) => p.id === url.presetId);
        if (preset) usePresetStore.getState().applyPreset(preset.id);
      }
      if (url.drawer) useUIStore.setState({ activeDrawer: url.drawer });
      else if (closeMissingDrawer && ui.activeDrawer) ui.closeDrawer();
    }

    apply(window.location.search, false);
    let last = current();
    window.history.replaceState(null, "", path + toSearch(last));

    function sync() {
      const next = current();
      if (!restoring) {
        const url = path + toSearch(next);
        switch (historyAction(last, next, window.history.state?.webcalDrawer === true)) {
          case "push": window.history.pushState(next.drawer ? DRAWER_ENTRY : null, "", url); break;
          case "replace": window.history.replaceState(next.drawer ? window.history.state : null, "", url); break;
          case "back": window.history.back(); break; // its popstate restores the entry below
        }
      }
      last = next;
    }

    function onPopState() {
      restoring = true;
      try { apply(window.location.search, true); } finally { restoring = false; }
      last = current();
      // Canonicalize: the popped URL may lack what couldn't be restored (e.g. a preset).
      window.history.replaceState(window.history.state, "", path + toSearch(last));
    }

    const unsubs = [useUIStore, usePresetStore, useConnectionStore, useEventTypeStore, useThemeStore].map((st) => st.subscribe(sync));
    window.addEventListener("popstate", onPopState);
    return () => {
      unsubs.forEach((unsub) => unsub());
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background bg-pattern">
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
