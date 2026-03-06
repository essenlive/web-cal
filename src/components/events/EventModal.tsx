import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { useEventTypeStore, useCalendarStore, useEventsStore } from "../../store";
import { useDataProvider } from "../../context/DataProviderContext";
import type { CalendarEvent } from "../../types";

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultStart?: Date;
}

function getIcon(name: string, size = 14) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} /> : null;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function EventModal({ open, onClose, event, defaultStart }: EventModalProps) {
  const { types } = useEventTypeStore();
  const { calendars } = useCalendarStore();
  const { upsertEvent, removeEvent } = useEventsStore();
  const provider = useDataProvider();

  const [title, setTitle] = useState("");
  const [eventTypeId, setEventTypeId] = useState(types[0]?.id ?? "");
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? "");
  const [start, setStart] = useState(fmt(defaultStart ?? new Date()));
  const [end, setEnd] = useState(fmt(defaultStart ? new Date(defaultStart.getTime() + 3600000) : new Date()));
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setEventTypeId(event.eventTypeId);
      setCalendarId(event.calendarId);
      setStart(event.start.slice(0, 16));
      setEnd(event.end.slice(0, 16));
      setAllDay(event.allDay);
      setLocation(event.location ?? "");
      setNotes(event.notes ?? "");
    } else {
      setTitle("");
      setEventTypeId(types[0]?.id ?? "");
      setCalendarId(calendars[0]?.id ?? "");
      const s = defaultStart ?? new Date();
      setStart(fmt(s));
      setEnd(fmt(new Date(s.getTime() + 3600000)));
      setAllDay(false);
      setLocation("");
      setNotes("");
    }
  }, [event, defaultStart, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    const data = {
      title, eventTypeId, calendarId,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay, location: location || undefined, notes: notes || undefined,
    };
    if (event) {
      const updated = await provider.updateEvent({ ...event, ...data });
      upsertEvent(updated);
    } else {
      const created = await provider.createEvent(data);
      upsertEvent(created);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!event) return;
    await provider.deleteEvent(event.id);
    removeEvent(event.id);
    onClose();
  };

  const selectedType = types.find((t) => t.id === eventTypeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-foreground">
            {event ? "Modifier l'événement" : "Nouvel événement"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
            <Icons.X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'événement"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />

          {/* Event type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEventTypeId(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all",
                    eventTypeId === t.id ? "border-transparent" : "border-border bg-background"
                  )}
                  style={eventTypeId === t.id ? { backgroundColor: t.color + "20", borderColor: t.color, color: t.color } : {}}
                >
                  {getIcon(t.icon, 12)}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Calendrier</label>
            <div className="flex gap-1.5">
              {calendars.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCalendarId(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all",
                    calendarId === c.id ? "border-transparent text-white" : "border-border bg-background text-foreground"
                  )}
                  style={calendarId === c.id ? { backgroundColor: c.color } : {}}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="mr-1.5" />
              Journée entière
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Début</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fin</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Location */}
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Lieu (optionnel)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optionnel)"
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {event ? (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Icons.Trash2 size={13} />
                Supprimer
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {event ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
