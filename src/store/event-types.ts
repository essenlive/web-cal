import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventType } from "../types";
import { storage } from "./storage";

// ── Event Types Store ─────────────────────────────────────────────────────────

export const DEFAULT_EVENT_TYPES: EventType[] = [
  { id: "meeting",    label: "Classique",  color: "#3b82f6", icon: "Users",       allDayStyle: "background", timedStyle: "block", isDefault: true },
  { id: "deadline",   label: "Deadline",   color: "#ef4444", icon: "AlertCircle", allDayStyle: "background", timedStyle: "block" },
  { id: "workshop",   label: "Workshop",   color: "#8b5cf6", icon: "Layers",      allDayStyle: "background", timedStyle: "block" },
  { id: "focus-time", label: "Focus time", color: "#10b981", icon: "Brain",       allDayStyle: "avatar-tr",  timedStyle: "block" },
  { id: "admin",      label: "Admin",      color: "#f59e0b", icon: "FileText",    allDayStyle: "avatar-bl",  timedStyle: "block" },
  { id: "social",     label: "Social",     color: "#ec4899", icon: "Heart",       allDayStyle: "avatar-br",  timedStyle: "block" },
];

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
        // Invariant: exactly one default type (the catch-all rule resolves to it).
        if (state && state.types.length && !state.types.some((t) => t.isDefault)) {
          state.types = state.types.map((t, i) => ({ ...t, isDefault: i === 0 }));
        }
      },
    }
  )
);
