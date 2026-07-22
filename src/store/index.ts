import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { CalendarEvent, CalendarView, Connection, DisplayStyle, EventType, Rule, RuleMatchType } from "../types";

// Next.js server-renders "use client" components once for the initial HTML,
// where `localStorage` doesn't exist — fall back to a no-op store there.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const storage = createJSONStorage(() => (typeof window !== "undefined" ? localStorage : noopStorage));

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

/** @deprecated Use useConnectionStore instead. */
export const useBackendStore = create<BackendStore>()(
  persist(
    (set) => ({
      config: DEFAULT_BACKEND,
      updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      resetConfig: () => set({ config: DEFAULT_BACKEND }),
    }),
    { name: "webcal:backend", storage }
  )
);

// ── Connection Store ──────────────────────────────────────────────────────────

interface ConnectionStore {
  connections: Connection[];
  addConnection: (conn: Omit<Connection, "id">) => void;
  removeConnection: (id: string) => void;
  updateConnection: (conn: Connection) => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      connections: [],
      addConnection: (conn) =>
        set((s) => ({
          connections: [...s.connections, { ...conn, id: crypto.randomUUID() } as Connection],
        })),
      removeConnection: (id) => {
        set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }));
        useRuleStore.getState().removeRulesForConnection(id);
      },
      updateConnection: (conn) =>
        set((s) => ({ connections: s.connections.map((c) => (c.id === conn.id ? conn : c)) })),
    }),
    {
      name: "webcal:connections",
      storage,
      onRehydrateStorage: () => (state) => {
        if (!state || typeof window === "undefined") return;
        // Migrate legacy webcal:backend config to the new connection model.
        // Runs once on first load after the upgrade; removes the old key.
        try {
          const raw = localStorage.getItem("webcal:backend");
          if (!raw) return;
          const parsed = JSON.parse(raw) as { state?: { config?: BackendConfig } };
          const config = parsed?.state?.config;
          if (!config) return;

          const migrated: Connection[] = [];

          if (config.type === "webcal" && config.webcalSources.length > 0) {
            for (const src of config.webcalSources) {
              migrated.push({
                type: "webcal",
                id: src.id,
                name: src.name,
                url: src.url,
                color: src.color,
                proxyUrl: config.caldavProxyUrl || undefined,
              });
            }
          } else if (config.type === "caldav" && config.caldavUrl && config.caldavUsername) {
            migrated.push({
              type: "caldav",
              id: crypto.randomUUID(),
              name: "CalDAV Calendar",
              url: config.caldavUrl,
              username: config.caldavUsername,
              password: config.caldavPassword,
              color: "#6366f1",
              proxyUrl: config.caldavProxyUrl || undefined,
            });
          }

          if (migrated.length > 0) {
            state.connections = [...state.connections, ...migrated];
            localStorage.removeItem("webcal:backend");
          }
        } catch {
          // Migration failure is non-fatal; continue with empty connections.
        }
      },
    }
  )
);

// ── Event Types Store ─────────────────────────────────────────────────────────

const DEFAULT_EVENT_TYPES: EventType[] = [
  { id: "meeting",    label: "Meeting",    color: "#3b82f6", icon: "Users",       allDayStyle: "day",       timedStyle: "block" },
  { id: "deadline",   label: "Deadline",   color: "#ef4444", icon: "AlertCircle", allDayStyle: "day",       timedStyle: "block" },
  { id: "workshop",   label: "Workshop",   color: "#8b5cf6", icon: "Layers",      allDayStyle: "day",       timedStyle: "block" },
  { id: "focus-time", label: "Focus time", color: "#10b981", icon: "Brain",       allDayStyle: "avatar-tl", timedStyle: "block" },
  { id: "admin",      label: "Admin",      color: "#f59e0b", icon: "FileText",    allDayStyle: "avatar-bl", timedStyle: "block" },
  { id: "social",     label: "Social",     color: "#ec4899", icon: "Heart",       allDayStyle: "avatar-br", timedStyle: "block" },
];

/** Migrate persisted EventType from any old format to current shape. */
function migrateType(t: any): EventType {
  const styleMap: Record<string, DisplayStyle> = {
    pill: "avatar-tl", card: "block", block: "block", outline: "avatar-tl",
    "avatar-tl": "avatar-tl", "avatar-bl": "avatar-bl", "avatar-br": "avatar-br", day: "day",
  };

  if (typeof t.allDayStyle === "string") {
    // Already has allDayStyle — ensure timedStyle is present (added in v2)
    return { ...t, timedStyle: t.timedStyle ?? "block" } as EventType;
  }

  // Legacy format: extract best candidate from old per-view styles or legacy `style` field
  const old = t.styles?.month?.allDay ?? t.styles?.month?.timed ?? t.style ?? "day";
  return {
    id: t.id, label: t.label, color: t.color, icon: t.icon,
    allDayStyle: styleMap[old] ?? "day",
    timedStyle: "block",
  };
}

interface EventTypeStore {
  types: EventType[];
  addType: (t: Omit<EventType, "id">) => void;
  updateType: (t: EventType) => void;
  /** No-op if `id` is the catch-all rule's current target — reassign it first (FR-021). */
  removeType: (id: string) => void;
  getType: (id: string) => EventType | undefined;
  /** True if deleting `id` is blocked because the catch-all rule currently targets it. */
  isCatchAllTarget: (id: string) => boolean;
}

export const useEventTypeStore = create<EventTypeStore>()(
  persist(
    (set, get) => ({
      types: DEFAULT_EVENT_TYPES,
      addType: (t) => set((s) => ({ types: [...s.types, { ...t, id: crypto.randomUUID() }] })),
      updateType: (t) => set((s) => ({ types: s.types.map((x) => (x.id === t.id ? t : x)) })),
      removeType: (id) => {
        if (get().isCatchAllTarget(id)) return;
        set((s) => ({ types: s.types.filter((x) => x.id !== id) }));
      },
      getType: (id) => get().types.find((t) => t.id === id),
      isCatchAllTarget: (id) => useRuleStore.getState().rules.some((r) => r.matchType === "all" && r.displayTypeId === id),
    }),
    {
      name: "proton-cal:event-types",
      storage,
      onRehydrateStorage: () => (state) => {
        if (state) state.types = state.types.map(migrateType);
      },
    }
  )
);

// ── Rule Store ─────────────────────────────────────────────────────────────────

/** Lower = matched/prioritized first. "all" (catch-all) always sorts last. Used only to place new rules at their default position. */
function tierOf(matchType: RuleMatchType): number {
  if (matchType === "event") return 0;
  if (matchType === "name") return 1;
  if (matchType === "source") return 2;
  return 3; // "all" — catch-all
}

/** Read a still-persisted store's raw state without importing it (avoids a cross-store cycle). */
function readPersistedDefaultTypeId(): string {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("proton-cal:ui") : null;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.state?.defaultEventTypeId ?? DEFAULT_EVENT_TYPES[0].id;
  } catch {
    return DEFAULT_EVENT_TYPES[0].id;
  }
}

/** Ensures exactly one matchType:"all" (catch-all) rule exists, appending one if missing. */
function seedCatchAllRule(rules: Rule[]): Rule[] {
  if (rules.some((r) => r.matchType === "all")) return rules;
  const catchAll: Rule = {
    id: crypto.randomUUID(),
    matchType: "all",
    matchValue: "",
    displayTypeId: readPersistedDefaultTypeId(),
    enabled: true,
    createdAt: 0,
  };
  return [...rules, catchAll];
}

interface RuleStore {
  /** Array order IS priority — index 0 matches first. The catch-all (matchType:"all") rule is always last. */
  rules: Rule[];
  addRule: (r: Omit<Rule, "id" | "createdAt" | "enabled"> & { enabled?: boolean }) => void;
  updateRule: (r: Rule) => void;
  /** No-op for the catch-all rule — it cannot be deleted. */
  removeRule: (id: string) => void;
  /** No-op for the catch-all rule; otherwise clamps so it can never be reordered above the catch-all. */
  reorderRule: (id: string, toIndex: number) => void;
  /** No-op for the catch-all rule — it is always enabled. */
  toggleRule: (id: string) => void;
  removeRulesForConnection: (connectionId: string) => void;
}

export const useRuleStore = create<RuleStore>()(
  persist(
    (set) => ({
      rules: seedCatchAllRule([]),
      addRule: (r) =>
        set((s) => {
          const rule: Rule = { ...r, id: crypto.randomUUID(), createdAt: Date.now(), enabled: r.enabled ?? true };
          const tier = tierOf(rule.matchType);
          // Insert at the top of its tier's block (default: newest-first within a tier,
          // event-id rules above name-pattern rules above source rules above the catch-all).
          const insertAt = s.rules.findIndex((x) => tierOf(x.matchType) >= tier);
          const rules = insertAt === -1 ? [...s.rules, rule] : [...s.rules.slice(0, insertAt), rule, ...s.rules.slice(insertAt)];
          return { rules };
        }),
      updateRule: (r) =>
        set((s) => ({
          rules: s.rules.map((x) => {
            if (x.id !== r.id) return x;
            // Catch-all: only its displayTypeId can change (FR-020).
            if (x.matchType === "all") return { ...x, displayTypeId: r.displayTypeId };
            return r;
          }),
        })),
      removeRule: (id) =>
        set((s) => {
          const rule = s.rules.find((x) => x.id === id);
          if (!rule || rule.matchType === "all") return s;
          return { rules: s.rules.filter((x) => x.id !== id) };
        }),
      reorderRule: (id, toIndex) =>
        set((s) => {
          const idx = s.rules.findIndex((x) => x.id === id);
          if (idx === -1 || s.rules[idx].matchType === "all") return s;
          const rules = [...s.rules];
          const [item] = rules.splice(idx, 1);
          const catchAllIdx = rules.findIndex((x) => x.matchType === "all");
          const maxIndex = catchAllIdx === -1 ? rules.length : catchAllIdx;
          rules.splice(Math.min(toIndex, maxIndex), 0, item);
          return { rules };
        }),
      toggleRule: (id) =>
        set((s) => ({
          rules: s.rules.map((x) => (x.id === id && x.matchType !== "all" ? { ...x, enabled: !x.enabled } : x)),
        })),
      removeRulesForConnection: (connectionId) =>
        set((s) => ({
          rules: s.rules.filter((x) => !(x.matchType === "source" && x.matchValue === connectionId)),
        })),
    }),
    {
      name: "webcal:rules",
      storage,
      onRehydrateStorage: () => (state) => {
        if (state) state.rules = seedCatchAllRule(state.rules);
      },
    }
  )
);

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
  use24h: boolean;
  dateFormatEU: boolean;
  setView: (v: CalendarView) => void;
  setCurrentDate: (d: Date) => void;
  toggleDark: () => void;
  toggleSidebar: () => void;
  toggleWeekStart: () => void;
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
      use24h: true,
      dateFormatEU: true,
      setView: (view) => set({ view }),
      setCurrentDate: (currentDate) => set({ currentDate }),
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleWeekStart: () => set((s) => ({ weekStartsOnMonday: !s.weekStartsOnMonday })),
      setUse24h: (use24h) => set({ use24h }),
      setDateFormatEU: (dateFormatEU) => set({ dateFormatEU }),
    }),
    {
      name: "proton-cal:ui",
      storage,
      partialize: (s) => ({
        view: s.view,
        darkMode: s.darkMode,
        weekStartsOnMonday: s.weekStartsOnMonday,
        use24h: s.use24h,
        dateFormatEU: s.dateFormatEU,
      }),
    }
  )
);
