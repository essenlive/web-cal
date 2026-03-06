import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Edit2, Check } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "../lib/utils";
import { useEventTypeStore, useUIStore } from "../store";
import { EventChip } from "../components/events/EventChip";
import type { EventType, DisplayStyle } from "../types";

const STYLE_OPTIONS: { id: DisplayStyle; label: string }[] = [
  { id: "pill", label: "Pill" },
  { id: "card", label: "Card" },
  { id: "block", label: "Block" },
  { id: "outline", label: "Outline" },
];

const PRESET_COLORS = [
  "#3b82f6","#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f59e0b","#10b981","#14b8a6","#06b6d4","#64748b",
];

const ICON_OPTIONS = [
  "Users","AlertCircle","Layers","Brain","FileText","Heart","Calendar",
  "Clock","Star","Zap","Coffee","BookOpen","Video","Phone","Mail",
  "Home","Globe","Code","Briefcase","Target",
];

function getIcon(name: string, size = 16) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} /> : null;
}

const PREVIEW_EVENT = { id: "preview", title: "Prévisualisation", calendarId: "x", eventTypeId: "preview", start: "", end: "", allDay: false };

function EventTypeRow({ type, onEdit, onDelete }: { type: EventType; onEdit: (t: EventType) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: type.color + "20", color: type.color }}>
        {getIcon(type.icon)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{type.label}</div>
        <div className="text-xs text-muted-foreground capitalize">{type.style}</div>
      </div>
      <div className="shrink-0">
        <EventChip event={PREVIEW_EVENT} eventType={type} />
      </div>
      <div className="flex gap-1">
        <button onClick={() => onEdit(type)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(type.id)} className="p-1.5 rounded-lg hover:bg-muted text-destructive">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function EventTypeForm({ type, onSave, onCancel }: { type?: EventType; onSave: (t: Omit<EventType, "id"> & { id?: string }) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(type?.label ?? "");
  const [color, setColor] = useState(type?.color ?? PRESET_COLORS[0]);
  const [icon, setIcon] = useState(type?.icon ?? "Calendar");
  const [style, setStyle] = useState<DisplayStyle>(type?.style ?? "pill");

  const preview: EventType = { id: "preview", label: label || "Aperçu", color, icon, style };

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nom du type"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Couleur</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="size-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: color === c ? "#000" : "transparent" }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-6 rounded cursor-pointer border border-border" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Icône</label>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={cn("p-1.5 rounded-lg border transition-all", icon === i ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground")}
            >
              {getIcon(i, 14)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Style</label>
        <div className="flex gap-2">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", style === s.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Aperçu</label>
        <div className="inline-block">
          <EventChip event={PREVIEW_EVENT} eventType={preview} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Annuler</button>
        <button
          onClick={() => onSave({ id: type?.id, label, color, icon, style })}
          disabled={!label.trim()}
          className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
        >
          <Check size={14} className="inline mr-1.5" />
          {type ? "Enregistrer" : "Créer"}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { types, addType, updateType, removeType } = useEventTypeStore();
  const { weekStartsOnMonday, toggleSidebar } = useUIStore();
  const [editingType, setEditingType] = useState<EventType | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"types" | "prefs">("types");

  const handleSave = (t: Omit<EventType, "id"> & { id?: string }) => {
    if (t.id) updateType(t as EventType);
    else addType(t);
    setEditingType(null);
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-card">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold text-foreground">Paramètres</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-muted p-1 mb-6 w-fit">
          {[{ id: "types", label: "Types d'événements" }, { id: "prefs", label: "Préférences" }].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "types" && (
          <div className="space-y-3">
            {types.map((t) =>
              editingType?.id === t.id ? (
                <EventTypeForm key={t.id} type={t} onSave={handleSave} onCancel={() => setEditingType(null)} />
              ) : (
                <EventTypeRow key={t.id} type={t} onEdit={setEditingType} onDelete={removeType} />
              )
            )}

            {creating && (
              <EventTypeForm onSave={handleSave} onCancel={() => setCreating(false)} />
            )}

            {!creating && !editingType && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 w-full rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Plus size={16} />
                Ajouter un type
              </button>
            )}
          </div>
        )}

        {tab === "prefs" && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Semaine commence le lundi</div>
                <div className="text-xs text-muted-foreground">Afficher lundi en premier dans la vue calendrier</div>
              </div>
              <button
                onClick={() => useUIStore.getState().weekStartsOnMonday !== undefined && (useUIStore.setState as any)((s: any) => ({ ...s, weekStartsOnMonday: !s.weekStartsOnMonday }))}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", weekStartsOnMonday ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("size-4 rounded-full bg-white shadow transition-transform", weekStartsOnMonday ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
