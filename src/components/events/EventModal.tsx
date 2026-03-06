import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { useEventTypeStore, useEventsStore, useUIStore } from "../../store";
import { useDataProvider } from "../../context/DataProviderContext";
import type { CalendarEvent, DisplayStyle } from "../../types";

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

const fmtDT   = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

const PRESET_COLORS = [
  "#3b82f6","#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f59e0b","#10b981","#14b8a6","#06b6d4","#64748b",
];

const ICON_OPTIONS = [
  "Users","AlertCircle","Layers","Brain","FileText","Heart","Calendar",
  "Clock","Star","Zap","Coffee","BookOpen","Video","Phone","Mail",
  "Home","Globe","Code","Briefcase","Target",
];

const STYLE_OPTIONS: { id: DisplayStyle; label: string }[] = [
  { id: "avatar-tl", label: "↖ Badge" },
  { id: "avatar-bl", label: "↙ Badge" },
  { id: "avatar-br", label: "↘ Badge" },
  { id: "block",     label: "Bloc"    },
  { id: "day",       label: "Fond"    },
];

export function EventModal({ open, onClose, event, defaultStart }: EventModalProps) {
  const { types }   = useEventTypeStore();
  const { upsertEvent, removeEvent } = useEventsStore();
  const { defaultEventTypeId, dateFormatEU } = useUIStore();
  const provider = useDataProvider();

  const resolvedDefault = defaultEventTypeId || types[0]?.id || "";

  const [title,            setTitle]            = useState("");
  const [eventTypeId,      setEventTypeId]      = useState(resolvedDefault);
  const [start,            setStart]            = useState(fmtDT(defaultStart ?? new Date()));
  const [end,              setEnd]              = useState(fmtDT(defaultStart ? new Date(defaultStart.getTime() + 3600000) : new Date()));
  const [allDay,           setAllDay]           = useState(false);
  const [location,         setLocation]         = useState("");
  const [notes,            setNotes]            = useState("");
  // Custom type fields
  const [customColor,      setCustomColor]      = useState("#6366f1");
  const [customIcon,       setCustomIcon]       = useState("Calendar");
  const [customAllDayStyle, setCustomAllDayStyle] = useState<DisplayStyle>("block");

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setEventTypeId(event.eventTypeId);
      setAllDay(event.allDay);
      setStart(event.allDay ? event.start.slice(0, 10) : event.start.slice(0, 16));
      setEnd(event.allDay   ? event.end.slice(0, 10)   : event.end.slice(0, 16));
      setLocation(event.location ?? "");
      setNotes(event.notes ?? "");
      setCustomColor(event.customColor ?? "#6366f1");
      setCustomIcon(event.customIcon ?? "Calendar");
      setCustomAllDayStyle(event.customAllDayStyle ?? "block");
    } else {
      setTitle("");
      setEventTypeId(resolvedDefault);
      const s = defaultStart ?? new Date();
      setAllDay(false);
      setStart(fmtDT(s));
      setEnd(fmtDT(new Date(s.getTime() + 3600000)));
      setLocation("");
      setNotes("");
      setCustomColor("#6366f1");
      setCustomIcon("Calendar");
      setCustomAllDayStyle("block");
    }
  }, [event, defaultStart, open]);

  if (!open) return null;

  const calendarId = event?.calendarId ?? "default";
  const isCustom = eventTypeId === "custom";

  const handleSave = async () => {
    if (!title.trim()) return;
    const data: Omit<CalendarEvent, "id"> = {
      title,
      eventTypeId,
      calendarId,
      allDay,
      start: allDay ? start : new Date(start).toISOString(),
      end:   allDay ? end   : new Date(end).toISOString(),
      location: location || undefined,
      notes:    notes    || undefined,
      ...(isCustom && {
        customColor,
        customIcon,
        customAllDayStyle,
      }),
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
    await provider.deleteEvent(event.id, event.calendarId);
    removeEvent(event.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto"
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
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
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
              {/* Custom type */}
              <button
                onClick={() => setEventTypeId("custom")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all",
                  isCustom ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
                )}
              >
                {getIcon("Palette", 12)}
                Personnalisé
              </button>
            </div>
          </div>

          {/* Custom type pickers */}
          {isCustom && (
            <div className="rounded-xl border border-border bg-background p-3 space-y-3">
              {/* Color */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Couleur</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCustomColor(c)}
                      className="size-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: customColor === c ? "var(--foreground)" : "transparent" }}
                    />
                  ))}
                  <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="size-5 rounded cursor-pointer border border-border" />
                </div>
              </div>
              {/* Icon */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Icône</label>
                <div className="flex flex-wrap gap-1">
                  {ICON_OPTIONS.map((i) => (
                    <button
                      key={i}
                      onClick={() => setCustomIcon(i)}
                      className={cn("p-1 rounded-lg border transition-all", customIcon === i ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground")}
                    >
                      {getIcon(i, 13)}
                    </button>
                  ))}
                </div>
              </div>
              {/* All-day style — only shown when allDay is checked */}
              {allDay && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Style journée</label>
                  <div className="flex flex-wrap gap-1">
                    {STYLE_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setCustomAllDayStyle(s.id)}
                        className={cn(
                          "px-2 py-1 rounded-md border text-xs font-medium transition-all",
                          customAllDayStyle === s.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All-day toggle */}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                const v = e.target.checked;
                setAllDay(v);
                if (v) {
                  setStart(start.slice(0, 10));
                  setEnd(end.slice(0, 10));
                } else {
                  const s = defaultStart ?? new Date();
                  setStart(fmtDT(s));
                  setEnd(fmtDT(new Date(s.getTime() + 3600000)));
                }
              }}
              className="rounded"
            />
            <span className="text-xs font-medium text-muted-foreground">Journée entière</span>
          </label>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Début</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? start.slice(0, 10) : start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              {start.length >= 10 && (
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  {format(new Date(start.slice(0, 10) + "T12:00:00"), dateFormatEU ? "dd/MM/yyyy" : "MM/dd/yyyy")}
                  {!allDay && start.length >= 16 && ` · ${start.slice(11, 16)}`}
                </span>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fin</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? end.slice(0, 10) : end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              {end.length >= 10 && (
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  {format(new Date(end.slice(0, 10) + "T12:00:00"), dateFormatEU ? "dd/MM/yyyy" : "MM/dd/yyyy")}
                  {!allDay && end.length >= 16 && ` · ${end.slice(11, 16)}`}
                </span>
              )}
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
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
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

void parseISO;
void fmtDate;
