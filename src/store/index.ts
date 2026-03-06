import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalendarEvent, CalendarMeta, CalendarView, EventType } from "../types";

// ── Event Types Store ─────────────────────────────────────────────────────────
const DEFAULT_EVENT_TYPES: EventType[] = [
  { id: "meeting",    label: "Meeting",    color: "#3b82f6", icon: "Users",        style: "card"    },
  { id: "deadline",   label: "Deadline",   color: "#ef4444", icon: "AlertCircle",  style: "outline" },
  { id: "workshop",   label: "Workshop",   color: "#8b5cf6", icon: "Layers",       style: "block"   },
  { id: "focus-time", label: "Focus time", color: "#10b981", icon: "Brain",        style: "pill"    },
  { id: "admin",      label: "Admin",      color: "#f59e0b", icon: "FileText",     style: "pill"    },
  { id: "social",     label: "Social",     color: "#ec4899", icon: "Heart",        style: "card"    },
];

interface EventTypeStore {
  types: EventType[];
  addType: (t: Omit<EventType, "id">) => void;
  updateType: (t: EventType) => void;
  removeType: (id: string) => void;
  getType: (id: string) => EventType | undefined;
}

export const useEventTypeStore = create<EventTypeStore>()(
  persist(
    (set, get) => ({
      types: DEFAULT_EVENT_TYPES,
      addType: (t) => set((s) => ({ types: [...s.types, { ...t, id: crypto.randomUUID() }] })),
      updateType: (t) => set((s) => ({ types: s.types.map((x) => (x.id === t.id ? t : x)) })),
      removeType: (id) => set((s) => ({ types: s.types.filter((x) => x.id !== id) })),
      getType: (id) => get().types.find((t) => t.id === id),
    }),
    { name: "proton-cal:event-types" }
  )
);

// ── Calendar Store ─────────────────────────────────────────────────────────────
interface CalendarStore {
  calendars: CalendarMeta[];
  setCalendars: (c: CalendarMeta[]) => void;
  toggleCalendar: (id: string) => void;
}

export const useCalendarStore = create<CalendarStore>()((set) => ({
  calendars: [],
  setCalendars: (calendars) => set({ calendars }),
  toggleCalendar: (id) =>
    set((s) => ({
      calendars: s.calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    })),
}));

// ── Events Store ──────────────────────────────────────────────────────────────
interface EventsStore {
  events: CalendarEvent[];
  setEvents: (e: CalendarEvent[]) => void;
  upsertEvent: (e: CalendarEvent) => void;
  removeEvent: (id: string) => void;
}

export const useEventsStore = create<EventsStore>()((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
  upsertEvent: (e) =>
    set((s) => {
      const exists = s.events.find((x) => x.id === e.id);
      return { events: exists ? s.events.map((x) => (x.id === e.id ? e : x)) : [...s.events, e] };
    }),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
}));

// ── UI Store ──────────────────────────────────────────────────────────────────
interface UIStore {
  view: CalendarView;
  currentDate: Date;
  darkMode: boolean;
  sidebarOpen: boolean;
  weekStartsOnMonday: boolean;
  setView: (v: CalendarView) => void;
  setCurrentDate: (d: Date) => void;
  toggleDark: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      view: "month",
      currentDate: new Date(),
      darkMode: false,
      sidebarOpen: true,
      weekStartsOnMonday: true,
      setView: (view) => set({ view }),
      setCurrentDate: (currentDate) => set({ currentDate }),
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: "proton-cal:ui",
      partialize: (s) => ({ view: s.view, darkMode: s.darkMode, weekStartsOnMonday: s.weekStartsOnMonday }),
    }
  )
);
