import type { CalendarEvent } from "../types";

export interface DataProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
  createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateEvent(event: CalendarEvent): Promise<CalendarEvent>;
  deleteEvent(id: string, calendarId?: string): Promise<void>;
}
