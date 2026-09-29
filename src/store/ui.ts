import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalendarView } from "../types";
import { storage } from "./storage";

// ── UI Store ──────────────────────────────────────────────────────────────────

/** Which settings drawer panel is currently open, if any. See specs/007-settings-side-drawer. */
export type DrawerPanel = "connection" | "eventType" | "rules" | "preset" | "theme" | "preferences" | "shortcuts" | "help";

export interface ActiveDrawer {
  panel: DrawerPanel;
  /** id of the Connection/EventType being edited; absent means "create new". */
  editId?: string;
  /** True when the drawer's "+" was used — skip the list and open straight into the new-item form. */
  create?: boolean;
}

interface UIStore {
  view: CalendarView;
  currentDate: Date;
  sidebarOpen: boolean;
  weekStartsOnMonday: boolean;
  use24h: boolean;
  dateFormatEU: boolean;
  /** IANA timezone (e.g. "Europe/Paris") events are displayed in. "system" follows the browser's local timezone. */
  timezone: string;
  activeDrawer: ActiveDrawer | null;
  /** Sidebar section id → collapsed state. Missing id = expanded. */
  collapsedSections: Record<string, boolean>;
  /** Months kept in the event cache on each side of the viewed date — see windowAround in DataProviderContext. Per device, not synced. */
  cacheMonths: { back: number; forward: number };
  setView: (v: CalendarView) => void;
  setCurrentDate: (d: Date) => void;
  toggleSidebar: () => void;
  toggleWeekStart: () => void;
  setUse24h: (v: boolean) => void;
  setDateFormatEU: (v: boolean) => void;
  setTimezone: (v: string) => void;
  openDrawer: (panel: DrawerPanel, editId?: string) => void;
  openNewItemDrawer: (panel: DrawerPanel) => void;
  closeDrawer: () => void;
  toggleSection: (id: string) => void;
  setCacheMonths: (v: { back: number; forward: number }) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      view: "month",
      currentDate: new Date(),
      // Closed by default on mobile (below Tailwind's `sm` breakpoint, which is where
      // the sidebar itself switches from an overlay to inline layout — see Sidebar.tsx),
      // open by default everywhere else. This runs once at store creation, so it reflects
      // the viewport at load time, not live viewport changes.
      sidebarOpen: typeof window === "undefined" || window.innerWidth >= 640,
      weekStartsOnMonday: true,
      use24h: true,
      dateFormatEU: true,
      timezone: "system",
      activeDrawer: null,
      collapsedSections: {},
      cacheMonths: { back: 2, forward: 3 },
      setView: (view) => set({ view }),
      setCurrentDate: (currentDate) => set({ currentDate }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleWeekStart: () => set((s) => ({ weekStartsOnMonday: !s.weekStartsOnMonday })),
      setUse24h: (use24h) => set({ use24h }),
      setDateFormatEU: (dateFormatEU) => set({ dateFormatEU }),
      setTimezone: (timezone) => set({ timezone }),
      openDrawer: (panel, editId) => set({ activeDrawer: { panel, editId } }),
      openNewItemDrawer: (panel) => set({ activeDrawer: { panel, create: true } }),
      closeDrawer: () => set({ activeDrawer: null }),
      toggleSection: (id) => set((s) => ({ collapsedSections: { ...s.collapsedSections, [id]: !s.collapsedSections[id] } })),
      setCacheMonths: (cacheMonths) => set({ cacheMonths }),
    }),
    {
      name: "overcal:ui",
      storage,
      partialize: (s) => ({
        view: s.view,
        weekStartsOnMonday: s.weekStartsOnMonday,
        use24h: s.use24h,
        dateFormatEU: s.dateFormatEU,
        timezone: s.timezone,
        collapsedSections: s.collapsedSections,
        cacheMonths: s.cacheMonths,
      }),
    }
  )
);
