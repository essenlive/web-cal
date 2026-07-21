import { isWithinInterval, parseISO } from "date-fns";
import type { DataProvider } from "./data-provider";
import type { CalendarEvent } from "../types";
import { generateSeedEvents } from "./mock-seed";

const STORAGE_KEY = "proton-cal:events";

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export class MockDataProvider implements DataProvider {
  private events: CalendarEvent[];

  constructor() {
    const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    this.events = stored ? JSON.parse(stored) : generateSeedEvents();
    if (!stored) save(STORAGE_KEY, this.events);
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    return this.events.filter((e) => {
      const s = parseISO(e.start);
      return isWithinInterval(s, { start, end }) || s < end && parseISO(e.end) > start;
    });
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = { ...event, id: crypto.randomUUID() };
    this.events.push(newEvent);
    save(STORAGE_KEY, this.events);
    return newEvent;
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx === -1) throw new Error("Event not found");
    this.events[idx] = event;
    save(STORAGE_KEY, this.events);
    return event;
  }

  async deleteEvent(id: string): Promise<void> {
    this.events = this.events.filter((e) => e.id !== id);
    save(STORAGE_KEY, this.events);
  }
}

// kept for backwards compat in case old localStorage key exists
void load;
