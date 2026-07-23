import { addDays, startOfWeek, setHours, setMinutes, subDays } from "date-fns";
import type { CalendarEvent } from "../types";

export function generateSeedEvents(): CalendarEvent[] {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const events: CalendarEvent[] = [];
  let id = 1;

  const ev = (
    title: string, eventTypeId: string,
    start: Date, end: Date, allDay = false,
    location?: string, notes?: string
  ): CalendarEvent => ({
    id: String(id++), title, calendarId: "default", eventTypeId,
    start: start.toISOString(), end: end.toISOString(),
    allDay, location, notes,
  });

  // This week
  events.push(
    ev("Standup", "meeting",
      setMinutes(setHours(monday, 9), 30),
      setMinutes(setHours(monday, 10), 0)),
    ev("Atelier FabLab", "workshop",
      setMinutes(setHours(monday, 14), 0),
      setMinutes(setHours(monday, 17), 0),
      false, "FabLab M19"),
    ev("Rendu projet", "deadline",
      setMinutes(setHours(addDays(monday, 1), 18), 0),
      setMinutes(setHours(addDays(monday, 1), 18), 30)),
    ev("Bloc focus", "focus-time",
      setMinutes(setHours(addDays(monday, 1), 9), 0),
      setMinutes(setHours(addDays(monday, 1), 12), 0)),
    ev("Call client", "meeting",
      setMinutes(setHours(addDays(monday, 2), 10), 30),
      setMinutes(setHours(addDays(monday, 2), 11), 30),
      false, "Google Meet"),
    ev("Admin comptabilité", "admin",
      setMinutes(setHours(addDays(monday, 2), 16), 0),
      setMinutes(setHours(addDays(monday, 2), 17), 0)),
    ev("Réunion CA", "meeting",
      setMinutes(setHours(addDays(monday, 3), 19), 0),
      setMinutes(setHours(addDays(monday, 3), 21), 0),
      false, "Le 15 bis"),
    ev("Apéro", "social",
      setMinutes(setHours(addDays(monday, 4), 19), 0),
      setMinutes(setHours(addDays(monday, 4), 22), 0),
      false, "Le 15 bis"),
    ev("Sprint review", "meeting",
      setMinutes(setHours(addDays(monday, 4), 14), 0),
      setMinutes(setHours(addDays(monday, 4), 15), 30)),
    ev("Journée portes ouvertes", "workshop",
      setMinutes(setHours(addDays(monday, 5), 10), 0),
      setMinutes(setHours(addDays(monday, 5), 17), 0),
      false, "FabLab M19"),
    // All-day events, chosen to exercise every display style at a glance:
    // a multi-day "day" banner, and three avatar corners (tl/bl/br) stacked
    // on the same day plus one shown in isolation the day after.
    ev("Livraison module A", "deadline", monday, addDays(monday, 3), true),
    ev("Focus · Rédaction rapport", "focus-time", addDays(monday, 4), addDays(monday, 6), true),
    ev("Admin · RTT", "admin", addDays(monday, 4), addDays(monday, 5), true),
    ev("Vacances (pont)", "social", addDays(monday, 4), addDays(monday, 5), true),
  );

  // Previous week
  const prevMonday = subDays(monday, 7);
  events.push(
    ev("Atelier Design Sprint", "workshop",
      setMinutes(setHours(prevMonday, 9), 0),
      setMinutes(setHours(prevMonday, 17), 0),
      false, "d.school Paris"),
    ev("Livraison prototype", "deadline",
      setMinutes(setHours(addDays(prevMonday, 2), 12), 0),
      setMinutes(setHours(addDays(prevMonday, 2), 13), 0)),
    ev("Focus · Architecture", "focus-time",
      setMinutes(setHours(addDays(prevMonday, 3), 20), 0),
      setMinutes(setHours(addDays(prevMonday, 3), 23), 0)),
    ev("Cinéma", "social",
      setMinutes(setHours(addDays(prevMonday, 5), 20), 30),
      setMinutes(setHours(addDays(prevMonday, 5), 23), 0),
      false, "MK2 Quai de Loire"),
  );

  // Next week
  const nextMonday = addDays(monday, 7);
  events.push(
    ev("Kick-off projet", "meeting",
      setMinutes(setHours(nextMonday, 10), 0),
      setMinutes(setHours(nextMonday, 12), 0),
      false, "Visio"),
    ev("Rendu maquette", "deadline",
      setMinutes(setHours(addDays(nextMonday, 1), 17), 0),
      setMinutes(setHours(addDays(nextMonday, 1), 17), 30)),
    ev("Bloc focus · Dev", "focus-time",
      setMinutes(setHours(addDays(nextMonday, 2), 9), 0),
      setMinutes(setHours(addDays(nextMonday, 2), 12), 0)),
    ev("Entretien partenaire", "meeting",
      setMinutes(setHours(addDays(nextMonday, 2), 14), 0),
      setMinutes(setHours(addDays(nextMonday, 2), 15), 0)),
    ev("Réunion équipe", "meeting",
      setMinutes(setHours(addDays(nextMonday, 3), 11), 0),
      setMinutes(setHours(addDays(nextMonday, 3), 12), 0)),
    ev("Conf · Paris Web", "workshop",
      addDays(nextMonday, 4),
      addDays(nextMonday, 6),
      true),
    ev("Dîner d'équipe", "social",
      setMinutes(setHours(addDays(nextMonday, 4), 20), 0),
      setMinutes(setHours(addDays(nextMonday, 4), 23), 0),
      false, "Restaurant Le Comptoir"),
    ev("Admin · Facturation", "admin",
      setMinutes(setHours(addDays(nextMonday, 0), 16), 0),
      setMinutes(setHours(addDays(nextMonday, 0), 17), 30)),
  );

  // Two weeks out
  const twoWeeks = addDays(monday, 14);
  events.push(
    ev("Workshop UX", "workshop",
      setMinutes(setHours(addDays(twoWeeks, 1), 14), 0),
      setMinutes(setHours(addDays(twoWeeks, 1), 18), 0),
      false, "Le 15 bis"),
    ev("Démo client", "meeting",
      setMinutes(setHours(addDays(twoWeeks, 3), 10), 0),
      setMinutes(setHours(addDays(twoWeeks, 3), 11), 30)),
    ev("Vacances", "social",
      addDays(twoWeeks, 5),
      addDays(twoWeeks, 12),
      true),
  );

  return events;
}
