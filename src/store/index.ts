import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalendarEvent, CalendarMeta, CalendarView, DisplayStyle, EventType } from "../types";

// ── Backend Store ──────────────────────────────────────────────────────────────
export type BackendType = "mock" | "webcal" | "caldav";

export interface WebCalSource {
  id: string;
  name: string;
  url: string;
  color: string;
}

export interface BackendConfig {
  type: BackendType;
  // CalDAV — any server: Proton, Nextcloud, Google Calendar, Fastmail…
  caldavUrl: string;       // e.g. https://calendar.proton.me/dav
  caldavUsername: string;
  caldavPassword: string;  // app-password / token
  caldavProxyUrl: string;  // optional CORS proxy prefix (e.g. https://corsproxy.io/?)
  // WebCal — read-only ICS URL subscriptions
  webcalSources: WebCalSource[];
}

const DEFAULT_BACKEND: BackendConfig = {
  type: "mock",
  caldavUrl: "",
  caldavUsername: "",
  caldavPassword: "",
  caldavProxyUrl: "",
  webcalSources: [],
};

interface BackendStore {
  config: BackendConfig;
  updateConfig: (patch: Partial<BackendConfig>) => void;
  resetConfig: () => void;
}

export const useBackendStore = create<BackendStore>()(
  persist(
    (set) => ({
      config: DEFAULT_BACKEND,
      updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      resetConfig: () => set({ config: DEFAULT_BACKEND }),
    }),
    { name: "webcal:backend" }
  )
);

// ── Event Types Store ─────────────────────────────────────────────────────────

const DEFAULT_EVENT_TYPES: EventType[] = [
  { id: "meeting",    label: "Meeting",    color: "#3b82f6", icon: "Users",       allDayStyle: "day"       },
  { id: "deadline",   label: "Deadline",   color: "#ef4444", icon: "AlertCircle", allDayStyle: "day"       },
  { id: "workshop",   label: "Workshop",   color: "#8b5cf6", icon: "Layers",      allDayStyle: "day"       },
  { id: "focus-time", label: "Focus time", color: "#10b981", icon: "Brain",       allDayStyle: "avatar-tl" },
  { id: "admin",      label: "Admin",      color: "#f59e0b", icon: "FileText",    allDayStyle: "avatar-bl" },
  { id: "social",     label: "Social",     color: "#ec4899", icon: "Heart",       allDayStyle: "avatar-br" },
];

/** Migrate persisted EventType from any old format to current shape. */
function migrateType(t: any): EventType {
  if (typeof t.allDayStyle === "string") return t as EventType; // already current
  const styleMap: Record<string, DisplayStyle> = {
    pill: "avatar-tl", card: "block", block: "block", outline: "avatar-tl",
    "avatar-tl": "avatar-tl", "avatar-bl": "avatar-bl", "avatar-br": "avatar-br", day: "day",
  };
  // Extract best candidate from old per-view styles or legacy `style` field
  const old = t.styles?.month?.allDay ?? t.styles?.month?.timed ?? t.style ?? "day";
  return { id: t.id, label: t.label, color: t.color, icon: t.icon, allDayStyle: styleMap[old] ?? "day" };
}

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
    {
      name: "proton-cal:event-types",
      onRehydrateStorage: () => (state) => {
        if (state) state.types = state.types.map(migrateType);
      },
    }
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
  defaultEventTypeId: string;
  use24h: boolean;
  dateFormatEU: boolean;
  setView: (v: CalendarView) => void;
  setCurrentDate: (d: Date) => void;
  toggleDark: () => void;
  toggleSidebar: () => void;
  toggleWeekStart: () => void;
  setDefaultEventTypeId: (id: string) => void;
  setUse24h: (v: boolean) => void;
  setDateFormatEU: (v: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      view: "month",
      currentDate: new Date(),
      darkMode: false,
      sidebarOpen: true,
      weekStartsOnMonday: true,
      defaultEventTypeId: "meeting",
      use24h: true,
      dateFormatEU: true,
      setView: (view) => set({ view }),
      setCurrentDate: (currentDate) => set({ currentDate }),
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleWeekStart: () => set((s) => ({ weekStartsOnMonday: !s.weekStartsOnMonday })),
      setDefaultEventTypeId: (defaultEventTypeId) => set({ defaultEventTypeId }),
      setUse24h: (use24h) => set({ use24h }),
      setDateFormatEU: (dateFormatEU) => set({ dateFormatEU }),
    }),
    {
      name: "proton-cal:ui",
      partialize: (s) => ({
        view: s.view,
        darkMode: s.darkMode,
        weekStartsOnMonday: s.weekStartsOnMonday,
        defaultEventTypeId: s.defaultEventTypeId,
        use24h: s.use24h,
        dateFormatEU: s.dateFormatEU,
      }),
    }
  )
);
