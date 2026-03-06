import { addDays, addHours, startOfWeek, setHours, setMinutes, subDays } from "date-fns";
import type { CalendarEvent, CalendarMeta } from "../types";

export const SEED_CALENDARS: CalendarMeta[] = [
  { id: "perso", name: "Perso", color: "#6366f1", visible: true },
  { id: "woma", name: "WoMa", color: "#10b981", visible: true },
  { id: "clients", name: "Clients", color: "#f59e0b", visible: true },
];

export function generateSeedEvents(): CalendarEvent[] {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const events: CalendarEvent[] = [];
  let id = 1;

  const ev = (
    title: string, calendarId: string, eventTypeId: string,
    start: Date, end: Date, allDay = false,
    location?: string, notes?: string
  ): CalendarEvent => ({
    id: String(id++), title, calendarId, eventTypeId,
    start: start.toISOString(), end: end.toISOString(),
    allDay, location, notes,
  });

  // This week
  events.push(
    ev("Standup WoMa", "woma", "meeting",
      setMinutes(setHours(monday, 9), 30),
      setMinutes(setHours(monday, 10), 0)),
    ev("Atelier FabLab", "woma", "workshop",
      setMinutes(setHours(monday, 14), 0),
      setMinutes(setHours(monday, 17), 0),
      false, "FabLab M19"),
    ev("Rendu projet Éco-mobilier", "clients", "deadline",
      setMinutes(setHours(addDays(monday, 1), 18), 0),
      setMinutes(setHours(addDays(monday, 1), 18), 30)),
    ev("Bloc focus · La Boussole", "perso", "focus-time",
      setMinutes(setHours(addDays(monday, 1), 9), 0),
      setMinutes(setHours(addDays(monday, 1), 12), 0)),
    ev("Call client CHALLENGE", "clients", "meeting",
      setMinutes(setHours(addDays(monday, 2), 10), 30),
      setMinutes(setHours(addDays(monday, 2), 11), 30),
      false, "Google Meet"),
    ev("Admin comptabilité", "perso", "admin",
      setMinutes(setHours(addDays(monday, 2), 16), 0),
      setMinutes(setHours(addDays(monday, 2), 17), 0)),
    ev("Réunion CA WoMa", "woma", "meeting",
      setMinutes(setHours(addDays(monday, 3), 19), 0),
      setMinutes(setHours(addDays(monday, 3), 21), 0),
      false, "Le 15 bis"),
    ev("Apéro makers", "perso", "social",
      setMinutes(setHours(addDays(monday, 4), 19), 0),
      setMinutes(setHours(addDays(monday, 4), 22), 0),
      false, "Le 15 bis"),
    ev("Sprint review La Boussole", "clients", "meeting",
      setMinutes(setHours(addDays(monday, 4), 14), 0),
      setMinutes(setHours(addDays(monday, 4), 15), 30)),
    ev("Journée portes ouvertes WoMa", "woma", "workshop",
      setMinutes(setHours(addDays(monday, 5), 10), 0),
      setMinutes(setHours(addDays(monday, 5), 17), 0),
      false, "FabLab M19 + Le 15 bis"),
  );

  // Previous week
  const prevMonday = subDays(monday, 7);
  events.push(
    ev("Atelier d.school · Design Sprint", "perso", "workshop",
      setMinutes(setHours(prevMonday, 9), 0),
      setMinutes(setHours(prevMonday, 17), 0),
      false, "d.school Paris"),
    ev("Livraison prototype mobilier", "clients", "deadline",
      setMinutes(setHours(addDays(prevMonday, 2), 12), 0),
      setMinutes(setHours(addDays(prevMonday, 2), 13), 0)),
    ev("Focus · Architecture homelab", "perso", "focus-time",
      setMinutes(setHours(addDays(prevMonday, 3), 20), 0),
      setMinutes(setHours(addDays(prevMonday, 3), 23), 0)),
    ev("Cinéma avec Hugo", "perso", "social",
      setMinutes(setHours(addDays(prevMonday, 5), 20), 30),
      setMinutes(setHours(addDays(prevMonday, 5), 23), 0),
      false, "MK2 Quai de Loire"),
  );

  // Next week
  const nextMonday = addDays(monday, 7);
  events.push(
    ev("Kick-off Erasmus+ CHALLENGE", "woma", "meeting",
      setMinutes(setHours(nextMonday, 10), 0),
      setMinutes(setHours(nextMonday, 12), 0),
      false, "Visio"),
    ev("Rendu maquette RVM v2", "clients", "deadline",
      setMinutes(setHours(addDays(nextMonday, 1), 17), 0),
      setMinutes(setHours(addDays(nextMonday, 1), 17), 30)),
    ev("Bloc focus · Supabase schema", "perso", "focus-time",
      setMinutes(setHours(addDays(nextMonday, 2), 9), 0),
      setMinutes(setHours(addDays(nextMonday, 2), 12), 0)),
    ev("Entretien partenaire WoMa", "woma", "meeting",
      setMinutes(setHours(addDays(nextMonday, 2), 14), 0),
      setMinutes(setHours(addDays(nextMonday, 2), 15), 0)),
    ev("Réunion équipe NASCIS", "clients", "meeting",
      setMinutes(setHours(addDays(nextMonday, 3), 11), 0),
      setMinutes(setHours(addDays(nextMonday, 3), 12), 0)),
    ev("Conf · Paris Web", "perso", "workshop",
      addDays(nextMonday, 4),
      addDays(nextMonday, 6),
      true),
    ev("Dîner d'équipe", "perso", "social",
      setMinutes(setHours(addDays(nextMonday, 4), 20), 0),
      setMinutes(setHours(addDays(nextMonday, 4), 23), 0),
      false, "Restaurant Le Comptoir"),
    ev("Admin · Facturation Q1", "perso", "admin",
      setMinutes(setHours(addDays(nextMonday, 0), 16), 0),
      setMinutes(setHours(addDays(nextMonday, 0), 17), 30)),
  );

  // Two weeks out
  const twoWeeks = addDays(monday, 14);
  events.push(
    ev("Workshop UX · WoMa", "woma", "workshop",
      setMinutes(setHours(addDays(twoWeeks, 1), 14), 0),
      setMinutes(setHours(addDays(twoWeeks, 1), 18), 0),
      false, "Le 15 bis"),
    ev("Démo La Boussole", "clients", "meeting",
      setMinutes(setHours(addDays(twoWeeks, 3), 10), 0),
      setMinutes(setHours(addDays(twoWeeks, 3), 11), 30)),
    ev("Vacances", "perso", "social",
      addDays(twoWeeks, 5),
      addDays(twoWeeks, 12),
      true),
  );

  return events;
}
