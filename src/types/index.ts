export type DisplayStyle = "pill" | "card" | "block" | "outline";

export interface EventType {
  id: string;
  label: string;
  color: string;
  icon: string;
  style: DisplayStyle;
}

export interface CalendarMeta {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  calendarId: string;
  eventTypeId: string;
  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;
  location?: string;
  notes?: string;
}

export type CalendarView = "month" | "week" | "day" | "agenda";
