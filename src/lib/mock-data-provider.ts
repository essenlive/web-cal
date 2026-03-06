import { isWithinInterval, parseISO } from "date-fns";
import type { DataProvider } from "./data-provider";
import type { CalendarEvent, CalendarMeta } from "../types";
import { SEED_CALENDARS, generateSeedEvents } from "./mock-seed";

const STORAGE_KEYS = {
  events: "proton-cal:events",
  calendars: "proton-cal:calendars",
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export class MockDataProvider implements DataProvider {
  private calendars: CalendarMeta[];
  private events: CalendarEvent[];

  constructor() {
    this.calendars = load(STORAGE_KEYS.calendars, SEED_CALENDARS);
    const stored = localStorage.getItem(STORAGE_KEYS.events);
    this.events = stored ? JSON.parse(stored) : generateSeedEvents();
    if (!stored) save(STORAGE_KEYS.events, this.events);
  }

  async getCalendars(): Promise<CalendarMeta[]> {
    return structuredClone(this.calendars);
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
    save(STORAGE_KEYS.events, this.events);
    return newEvent;
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx === -1) throw new Error("Event not found");
    this.events[idx] = event;
    save(STORAGE_KEYS.events, this.events);
    return event;
  }

  async deleteEvent(id: string, _calendarId?: string): Promise<void> {
    this.events = this.events.filter((e) => e.id !== id);
    save(STORAGE_KEYS.events, this.events);
  }

  updateCalendar(id: string, patch: Partial<CalendarMeta>): CalendarMeta[] {
    this.calendars = this.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c));
    save(STORAGE_KEYS.calendars, this.calendars);
    return this.calendars;
  }
}
