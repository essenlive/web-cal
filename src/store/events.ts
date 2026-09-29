import { create } from "zustand";
import type { CalendarEvent } from "../types";

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
