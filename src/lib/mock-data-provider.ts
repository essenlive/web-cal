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
}

// kept for backwards compat in case old localStorage key exists
void load;
