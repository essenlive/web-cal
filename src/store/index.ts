import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { CalendarEvent, CalendarView, Connection, DisplayStyle, EventType, Preset, Rule, RuleMatchType, Theme } from "../types";
import { BUILTIN_THEMES, orderThemes } from "../lib/theme";
import { capturePresetState } from "../lib/presets";

// Next.js server-renders "use client" components once for the initial HTML,
// where `localStorage` doesn't exist — fall back to a no-op store there.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const storage = createJSONStorage(() => (typeof window !== "undefined" ? localStorage : noopStorage));

// One-time rename: "proton-cal:"/"webcal:" → "overcal:" (app rebrand). Copies each old
// key's raw value to its new name if the new key isn't already populated; old keys are
// left in place (harmless, and other one-time migrations below still read a couple of
// them by their old name).
if (typeof window !== "undefined") {
  const RENAMED_KEYS: Record<string, string> = {
    "webcal:connections": "overcal:connections",
    "proton-cal:event-types": "overcal:event-types",
    "webcal:rules": "overcal:rules",
    "webcal:presets": "overcal:presets",
    "proton-cal:ui": "overcal:ui",
    "proton-cal:themes": "overcal:themes",
    "webcal:event-cache": "overcal:event-cache",
  };
  for (const [oldKey, newKey] of Object.entries(RENAMED_KEYS)) {
    if (localStorage.getItem(newKey) !== null) continue;
    const old = localStorage.getItem(oldKey);
    if (old !== null) localStorage.setItem(newKey, old);
  }
}

// ── Legacy backend config shape ───────────────────────────────────────────────
// Kept only so useConnectionStore's one-time migration (below) can parse a
// pre-existing "webcal:backend" localStorage blob; there is no live store for
// it anymore. WebCalSource stays exported — WebCalProvider still uses it.
export type BackendType = "mock" | "webcal" | "caldav";

export interface WebCalSource {
  id: string;
  name: string;
  url: string;
  color: string;
}

interface BackendConfig {
  type: BackendType;
  caldavUrl: string;
  caldavUsername: string;
  caldavPassword: string;
  caldavProxyUrl: string;
  webcalSources: WebCalSource[];
}

// ── Connection Store ──────────────────────────────────────────────────────────

/**
 * First-run-only seed: gives a fresh install a visible, deletable source
 * instead of silently faking data behind an empty sources list (see
 * MultiSourceProvider's "demo" case and generateSeedEvents in mock-seed.ts).
 * Only used as useConnectionStore's initial state — same pattern as
 * useRuleStore's seedDemoRules, never re-applied once connections are persisted.
 */
const DEMO_CONNECTION: Connection = { type: "demo", id: "demo", name: "Démo", color: "#6366f1" };

interface ConnectionStore {
  connections: Connection[];
  /** Honors a caller-supplied `id` (e.g. a form that reserved one upfront to link draft rules to it) — mints one otherwise. */
  addConnection: (conn: Omit<Connection, "id"> & { id?: string }) => void;
  removeConnection: (id: string) => void;
  updateConnection: (conn: Connection) => void;
  /** Array order is display order. Moves `id` to `toIndex`. */
  reorderConnection: (id: string, toIndex: number) => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      connections: [DEMO_CONNECTION],
      addConnection: (conn) =>
        set((s) => ({
          connections: [...s.connections, { ...conn, id: conn.id ?? crypto.randomUUID() } as Connection],
        })),
      removeConnection: (id) => {
        set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }));
        useRuleStore.getState().removeRulesForConnection(id);
      },
      updateConnection: (conn) =>
        set((s) => ({ connections: s.connections.map((c) => (c.id === conn.id ? conn : c)) })),
      reorderConnection: (id, toIndex) =>
        set((s) => {
          const idx = s.connections.findIndex((c) => c.id === id);
          if (idx === -1) return s;
          const connections = [...s.connections];
          const [item] = connections.splice(idx, 1);
          connections.splice(Math.max(0, Math.min(toIndex, connections.length)), 0, item);
          return { connections };
        }),
    }),
    {
      name: "overcal:connections",
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
  { id: "meeting",    label: "Classique",  color: "#3b82f6", icon: "Users",       allDayStyle: "background", timedStyle: "block", isDefault: true },
  { id: "deadline",   label: "Deadline",   color: "#ef4444", icon: "AlertCircle", allDayStyle: "background", timedStyle: "block" },
  { id: "workshop",   label: "Workshop",   color: "#8b5cf6", icon: "Layers",      allDayStyle: "background", timedStyle: "block" },
  { id: "focus-time", label: "Focus time", color: "#10b981", icon: "Brain",       allDayStyle: "avatar-tr",  timedStyle: "block" },
  { id: "admin",      label: "Admin",      color: "#f59e0b", icon: "FileText",    allDayStyle: "avatar-bl",  timedStyle: "block" },
  { id: "social",     label: "Social",     color: "#ec4899", icon: "Heart",       allDayStyle: "avatar-br",  timedStyle: "block" },
];

/** Loose shape covering every field migrateType() reads, across all persisted EventType versions. */
interface LegacyEventType extends Record<string, unknown> {
  id?: string; label?: string; color?: string; icon?: string;
  allDayStyle?: string; timedStyle?: string; style?: string;
  styles?: { month?: { allDay?: string; timed?: string } };
}

/** Migrate persisted EventType from any old format to current shape. */
function migrateType(t: LegacyEventType): EventType {
  const styleMap: Record<string, DisplayStyle> = {
    pill: "avatar-tr", card: "block", block: "block", outline: "avatar-tr",
    "avatar-tl": "avatar-tr", "avatar-tr": "avatar-tr", "avatar-bl": "avatar-bl", "avatar-br": "avatar-br",
    day: "background", background: "background",
    text: "text", "border-top": "border-top", "border-bottom": "border-bottom",
  };

  if (typeof t.allDayStyle === "string") {
    // Already has allDayStyle — ensure timedStyle is present (added in v2), and remap any
    // pre-rework style values (avatar-tl → avatar-tr, day → background).
    return {
      ...t,
      allDayStyle: styleMap[t.allDayStyle] ?? "background",
      timedStyle: styleMap[t.timedStyle ?? "block"] ?? "block",
    } as EventType;
  }

  // Legacy format: extract best candidate from old per-view styles or legacy `style` field
  const old = t.styles?.month?.allDay ?? t.styles?.month?.timed ?? t.style ?? "day";
  return {
    id: t.id, label: t.label, color: t.color, icon: t.icon,
    allDayStyle: styleMap[old] ?? "background",
    timedStyle: "block",
  } as EventType;
}

interface EventTypeStore {
  types: EventType[];
  /** Honors a caller-supplied `id` (e.g. a form that reserved one upfront to link draft rules to it) — mints one otherwise. */
  addType: (t: Omit<EventType, "id"> & { id?: string }) => void;
  updateType: (t: EventType) => void;
  /** No-op if `id` is the default type — make another type default first. */
  removeType: (id: string) => void;
  getType: (id: string) => EventType | undefined;
  /** The one type with isDefault:true. Always resolvable — a default type always exists. */
  getDefaultType: () => EventType;
  /** Makes `id` the default type, clearing the flag from every other type. */
  setDefaultType: (id: string) => void;
  /** Array order is display order. Moves `id` to `toIndex`. */
  reorderType: (id: string, toIndex: number) => void;
}

export const useEventTypeStore = create<EventTypeStore>()(
  persist(
    (set, get) => ({
      types: DEFAULT_EVENT_TYPES,
      addType: (t) => set((s) => ({ types: [...s.types, { ...t, id: t.id ?? crypto.randomUUID() }] })),
      updateType: (t) => set((s) => ({ types: s.types.map((x) => (x.id === t.id ? t : x)) })),
      removeType: (id) => {
        if (get().getType(id)?.isDefault) return;
        set((s) => ({ types: s.types.filter((x) => x.id !== id) }));
      },
      getType: (id) => get().types.find((t) => t.id === id),
      getDefaultType: () => get().types.find((t) => t.isDefault) ?? get().types[0],
      setDefaultType: (id) => set((s) => ({ types: s.types.map((t) => ({ ...t, isDefault: t.id === id })) })),
      reorderType: (id, toIndex) =>
        set((s) => {
          const idx = s.types.findIndex((t) => t.id === id);
          if (idx === -1) return s;
          const types = [...s.types];
          const [item] = types.splice(idx, 1);
          types.splice(Math.max(0, Math.min(toIndex, types.length)), 0, item);
          return { types };
        }),
    }),
    {
      name: "overcal:event-types",
      storage,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Cast: rehydrated state is typed EventType[], but at runtime it may be JSON from
        // any older persisted shape — that's exactly what migrateType() normalizes.
        state.types = (state.types as unknown as LegacyEventType[]).map(migrateType);
        if (!state.types.some((t) => t.isDefault)) {
          const id = legacyDefaultTypeId(state.types);
          state.types = state.types.map((t) => ({ ...t, isDefault: t.id === id }));
        }
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

/**
 * Migrating pre-isDefault data: prefer whatever the catch-all rule already pointed to
 * (read raw from its still-persisted store to avoid a cross-store cycle), else the first type.
 */
function legacyDefaultTypeId(types: EventType[]): string {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("overcal:rules") : null;
    const persistedRules: Rule[] | undefined = (raw ? JSON.parse(raw) : null)?.state?.rules;
    const catchAll = persistedRules?.find((r) => r.matchType === "all");
    if (catchAll && types.some((t) => t.id === catchAll.displayTypeId)) return catchAll.displayTypeId;
  } catch {
    // fall through to first type
  }
  return types[0]?.id;
}

/** Drops duplicate matchType:"source" rules for the same connection, keeping the earliest (highest-priority) one — cleans up state left over from a since-fixed race in useSourceRule. */
function dedupeSourceRules(rules: Rule[]): Rule[] {
  const seen = new Set<string>();
  return rules.filter((r) => {
    if (r.matchType !== "source") return true;
    if (seen.has(r.matchValue)) return false;
    seen.add(r.matchValue);
    return true;
  });
}

/** Ensures exactly one matchType:"all" (catch-all) rule exists, appending one if missing. */
function seedCatchAllRule(rules: Rule[]): Rule[] {
  if (rules.some((r) => r.matchType === "all")) return rules;
  const catchAll: Rule = {
    id: crypto.randomUUID(),
    matchType: "all",
    matchValue: "",
    displayTypeId: DEFAULT_EVENT_TYPES.find((t) => t.isDefault)?.id ?? DEFAULT_EVENT_TYPES[0].id,
    enabled: true,
    createdAt: 0,
  };
  return [...rules, catchAll];
}

/**
 * First-run-only rule set: a handful of illustrative name-pattern rules matching the
 * demo events in mock-seed.ts, so a fresh install (no connections, no rules yet) shows
 * the rules engine actually differentiating event types instead of one flat color.
 * Only used as useRuleStore's initial state — never re-applied to an already-persisted
 * store (see onRehydrateStorage below, which only tops up the catch-all).
 */
function seedDemoRules(): Rule[] {
  const demo: Omit<Rule, "id" | "enabled">[] = [
    { matchType: "name", matchValue: "Rendu|Livraison", displayTypeId: "deadline", createdAt: 1 },
    { matchType: "name", matchValue: "Atelier|Workshop|Conf", displayTypeId: "workshop", createdAt: 2 },
    { matchType: "name", matchValue: "Focus", displayTypeId: "focus-time", createdAt: 3 },
    { matchType: "name", matchValue: "Admin", displayTypeId: "admin", createdAt: 4 },
    { matchType: "name", matchValue: "Apéro|Cinéma|Dîner|Vacances", displayTypeId: "social", createdAt: 5 },
  ];
  return seedCatchAllRule(demo.map((r) => ({ ...r, id: `seed-${r.displayTypeId}`, enabled: true })));
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
      rules: seedDemoRules(),
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
      // The catch-all rule's displayTypeId is vestigial — it always resolves to the
      // default EventType (see resolveEventType), which is set via setDefaultType instead.
      updateRule: (r) =>
        set((s) => ({
          rules: s.rules.map((x) => (x.id === r.id && x.matchType !== "all" ? r : x)),
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
      name: "overcal:rules",
      storage,
      onRehydrateStorage: () => (state) => {
        if (state) state.rules = seedCatchAllRule(dedupeSourceRules(state.rules));
      },
    }
  )
);

// ── Preset Store ───────────────────────────────────────────────────────────────

/** Appends " (copie)", then " (copie 2)", " (copie 3)"… until the result doesn't collide (case-insensitively) with any name in `existing` — keeps Preset.name's documented uniqueness invariant on duplicate. */
function uniqueCopyName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  let candidate = `${base} (copie)`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (copie ${n})`;
    n += 1;
  }
  return candidate;
}

interface PresetStore {
  presets: Preset[];
  addPreset: (name: string, color: string, description?: string) => void;
  updatePreset: (preset: Preset) => void;
  /** Copies an existing preset's captured connections/eventTypes as-is (not the live app state). */
  duplicatePreset: (id: string) => void;
  removePreset: (id: string) => void;
  applyPreset: (id: string) => void;
  /** Unhides every connection and event type — the "no preset" state (shortcut: 0). */
  clearPreset: () => void;
  /** Array order drives both the sidebar list and the 1-9 keyboard shortcuts. Moves `id` to `toIndex`. */
  reorderPreset: (id: string, toIndex: number) => void;
}

export const usePresetStore = create<PresetStore>()(
  persist(
    (set, get) => ({
      presets: [],
      addPreset: (name, color, description) =>
        set((s) => ({
          presets: [
            ...s.presets,
            {
              id: crypto.randomUUID(),
              name,
              color,
              description,
              ...capturePresetState(
                useConnectionStore.getState().connections,
                useEventTypeStore.getState().types,
                useThemeStore.getState().selectedThemeId
              ),
            },
          ],
        })),
      updatePreset: (preset) =>
        set((s) => ({ presets: s.presets.map((p) => (p.id === preset.id ? preset : p)) })),
      duplicatePreset: (id) =>
        set((s) => {
          const preset = s.presets.find((p) => p.id === id);
          if (!preset) return s;
          const name = uniqueCopyName(preset.name, s.presets.map((p) => p.name));
          return { presets: [...s.presets, { ...preset, id: crypto.randomUUID(), name }] };
        }),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      reorderPreset: (id, toIndex) =>
        set((s) => {
          const idx = s.presets.findIndex((p) => p.id === id);
          if (idx === -1) return s;
          const presets = [...s.presets];
          const [item] = presets.splice(idx, 1);
          presets.splice(Math.max(0, Math.min(toIndex, presets.length)), 0, item);
          return { presets };
        }),
      applyPreset: (id) => {
        const preset = get().presets.find((p) => p.id === id);
        if (!preset) return;
        const { connections, updateConnection } = useConnectionStore.getState();
        for (const c of connections) {
          if (c.id in preset.connections) updateConnection({ ...c, hidden: preset.connections[c.id] });
        }
        const { types, updateType } = useEventTypeStore.getState();
        for (const t of types) {
          if (t.id in preset.eventTypes) updateType({ ...t, hidden: preset.eventTypes[t.id] });
        }
        if (preset.themeId) useThemeStore.getState().selectTheme(preset.themeId);
      },
      clearPreset: () => {
        const { connections, updateConnection } = useConnectionStore.getState();
        for (const c of connections) if (c.hidden) updateConnection({ ...c, hidden: false });
        const { types, updateType } = useEventTypeStore.getState();
        for (const t of types) if (t.hidden) updateType({ ...t, hidden: false });
      },
    }),
    { name: "overcal:presets", storage }
  )
);

// ── Events Store ──────────────────────────────────────────────────────────────
interface EventsStore {
  events: CalendarEvent[];
  /** False until setEvents runs once this session — drives the first-load skeleton
   *  (see specs/008-events-perf-caching, CalendarSkeleton). Never persisted. */
  hasLoadedOnce: boolean;
  setEvents: (e: CalendarEvent[]) => void;
  upsertEvent: (e: CalendarEvent) => void;
  removeEvent: (id: string) => void;
}

export const useEventsStore = create<EventsStore>()((set) => ({
  events: [],
  hasLoadedOnce: false,
  setEvents: (events) => set({ events, hasLoadedOnce: true }),
  upsertEvent: (e) =>
    set((s) => {
      const exists = s.events.find((x) => x.id === e.id);
      return { events: exists ? s.events.map((x) => (x.id === e.id ? e : x)) : [...s.events, e] };
    }),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
}));

// ── UI Store ──────────────────────────────────────────────────────────────────

/** Which settings drawer panel is currently open, if any. See specs/007-settings-side-drawer. */
export type DrawerPanel = "connection" | "eventType" | "rules" | "preset" | "theme" | "preferences" | "shortcuts";

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
  activeDrawer: ActiveDrawer | null;
  /** Sidebar section id → collapsed state. Missing id = expanded. */
  collapsedSections: Record<string, boolean>;
  setView: (v: CalendarView) => void;
  setCurrentDate: (d: Date) => void;
  toggleSidebar: () => void;
  toggleWeekStart: () => void;
  setUse24h: (v: boolean) => void;
  setDateFormatEU: (v: boolean) => void;
  openDrawer: (panel: DrawerPanel, editId?: string) => void;
  openNewItemDrawer: (panel: DrawerPanel) => void;
  closeDrawer: () => void;
  toggleSection: (id: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      view: "month",
      currentDate: new Date(),
      sidebarOpen: true,
      weekStartsOnMonday: true,
      use24h: true,
      dateFormatEU: true,
      activeDrawer: null,
      collapsedSections: {},
      setView: (view) => set({ view }),
      setCurrentDate: (currentDate) => set({ currentDate }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleWeekStart: () => set((s) => ({ weekStartsOnMonday: !s.weekStartsOnMonday })),
      setUse24h: (use24h) => set({ use24h }),
      setDateFormatEU: (dateFormatEU) => set({ dateFormatEU }),
      openDrawer: (panel, editId) => set({ activeDrawer: { panel, editId } }),
      openNewItemDrawer: (panel) => set({ activeDrawer: { panel, create: true } }),
      closeDrawer: () => set({ activeDrawer: null }),
      toggleSection: (id) => set((s) => ({ collapsedSections: { ...s.collapsedSections, [id]: !s.collapsedSections[id] } })),
    }),
    {
      name: "overcal:ui",
      storage,
      partialize: (s) => ({
        view: s.view,
        weekStartsOnMonday: s.weekStartsOnMonday,
        use24h: s.use24h,
        dateFormatEU: s.dateFormatEU,
        collapsedSections: s.collapsedSections,
      }),
    }
  )
);

// ── Theme Store ────────────────────────────────────────────────────────────────
//
// customThemes is seeded with the two defaults (src/lib/theme.ts BUILTIN_THEMES)
// and holds every theme from then on — all equally editable/renamable/deletable,
// except the store refuses to remove the last remaining theme. See
// specs/005-global-theming/data-model.md.

interface ThemeStore {
  customThemes: Theme[];
  selectedThemeId: string;
  /** Display order for all themes, by id — see lib/theme.ts orderThemes. */
  themeOrder: string[];
  /** Internal one-time migration guards — not meant to be read by UI code. */
  migratedLegacyDarkMode: boolean;
  migratedBuiltinThemes: boolean;
  addTheme: (t: Omit<Theme, "id">) => void;
  updateTheme: (t: Theme) => void;
  /** No-ops when `id` is the only remaining theme — at least one theme must always exist. */
  removeTheme: (id: string) => void;
  selectTheme: (id: string) => void;
  /** Moves `id` to `toIndex` in the display order. */
  reorderTheme: (id: string, toIndex: number) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      customThemes: [...BUILTIN_THEMES],
      selectedThemeId: BUILTIN_THEMES[0].id, // "light"
      themeOrder: BUILTIN_THEMES.map((t) => t.id),
      migratedLegacyDarkMode: false,
      migratedBuiltinThemes: false,
      addTheme: (t) =>
        set((s) => {
          const id = crypto.randomUUID();
          return { customThemes: [...s.customThemes, { ...t, id }], themeOrder: [...s.themeOrder, id] };
        }),
      updateTheme: (t) =>
        set((s) => ({ customThemes: s.customThemes.map((x) => (x.id === t.id ? t : x)) })),
      removeTheme: (id) =>
        set((s) => {
          if (s.customThemes.length <= 1) return s;
          const customThemes = s.customThemes.filter((x) => x.id !== id);
          return {
            customThemes,
            themeOrder: s.themeOrder.filter((x) => x !== id),
            selectedThemeId: s.selectedThemeId === id ? customThemes[0].id : s.selectedThemeId,
          };
        }),
      selectTheme: (id) => set({ selectedThemeId: id }),
      reorderTheme: (id, toIndex) =>
        set((s) => {
          const ids = orderThemes(s.customThemes, s.themeOrder).map((t) => t.id);
          const idx = ids.indexOf(id);
          if (idx === -1) return s;
          ids.splice(idx, 1);
          ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, id);
          return { themeOrder: ids };
        }),
    }),
    {
      name: "overcal:themes",
      storage,
      partialize: (s) => ({
        customThemes: s.customThemes,
        selectedThemeId: s.selectedThemeId,
        themeOrder: s.themeOrder,
        migratedLegacyDarkMode: s.migratedLegacyDarkMode,
        migratedBuiltinThemes: s.migratedBuiltinThemes,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state || typeof window === "undefined") return;
        if (!state.migratedLegacyDarkMode) {
          // One-time migration: honor the legacy darkMode toggle's preference
          // (overcal:ui) for users upgrading from before this feature existed.
          // Read-only — overcal:ui / useUIStore.darkMode are left untouched.
          try {
            const raw = localStorage.getItem("overcal:ui");
            if (raw) {
              const parsed = JSON.parse(raw) as { state?: { darkMode?: boolean } };
              if (parsed?.state?.darkMode === true) {
                state.selectedThemeId = "dark";
              }
            }
          } catch {
            // Migration failure is non-fatal; keep the default "light" selection.
          }
          state.migratedLegacyDarkMode = true;
        }
        if (!state.migratedBuiltinThemes) {
          // One-time migration: older versions kept "light"/"dark" out of
          // customThemes entirely — add whichever of them are still missing
          // so upgrading users don't lose the defaults from their theme list.
          const missing = BUILTIN_THEMES.filter((b) => !state.customThemes.some((t) => t.id === b.id));
          if (missing.length > 0) {
            state.customThemes = [...missing, ...state.customThemes];
            state.themeOrder = [...missing.map((t) => t.id), ...state.themeOrder];
          }
          state.migratedBuiltinThemes = true;
        }
      },
    }
  )
);
