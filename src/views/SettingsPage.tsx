import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Edit2, Check } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "../lib/utils";
import { useEventTypeStore, useUIStore, useConnectionStore, useEventsStore } from "../store";
import { BackendSettings } from "../components/settings/BackendSettings";
import type { DisplayStyle, EventType } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { id: DisplayStyle; label: string; title: string }[] = [
  { id: "avatar-tl", label: "↖ Badge", title: "Icône ronde haut-gauche"   },
  { id: "avatar-bl", label: "↙ Badge", title: "Icône ronde bas-gauche"    },
  { id: "avatar-br", label: "↘ Badge", title: "Icône ronde bas-droite"    },
  { id: "block",     label: "Bloc",    title: "Chip texte pleine largeur" },
  { id: "day",       label: "Fond",    title: "Colore le fond de la case" },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIconEl(name: string, size = 16, color?: string) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

// ── StylePreview — calendar cell preview (all-day style only) ─────────────────

const avatarDot = (color: string, icon: string) => (
  <div className="size-5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: color }}>
    {getIconEl(icon, 9, "#fff")}
  </div>
);

function StylePreview({ style, color, icon }: { style: DisplayStyle; color: string; icon: string }) {
  if (style === "day") {
    return (
      <div
        className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0"
        style={{ backgroundColor: color + "28", border: `2px solid ${color}` }}
      >
        <span className="absolute top-1 right-1.5 text-[10px] font-semibold" style={{ color }}>15</span>
        <span className="absolute bottom-1 left-1 right-1 text-[9px] font-medium truncate" style={{ color, opacity: 0.65 }}>Titre</span>
      </div>
    );
  }

  return (
    <div className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-muted">
      <span className="absolute top-1 right-1.5 text-[10px] font-semibold text-foreground/70">15</span>
      {style === "avatar-tl" && <div className="absolute top-0.5 left-0.5">{avatarDot(color, icon)}</div>}
      {style === "avatar-bl" && <div className="absolute bottom-0.5 left-0.5">{avatarDot(color, icon)}</div>}
      {style === "avatar-br" && <div className="absolute bottom-0.5 right-0.5">{avatarDot(color, icon)}</div>}
      {style === "block" && (
        <div className="absolute bottom-1 left-1 right-1">
          <div className="rounded px-1.5 py-0.5 text-[9px] font-medium text-white truncate" style={{ backgroundColor: color }}>
            Titre
          </div>
        </div>
      )}
    </div>
  );
}

// ── EventTypeRow ──────────────────────────────────────────────────────────────

function EventTypeRow({ type, onEdit, onDelete }: {
  type: EventType; onEdit: (t: EventType) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: type.color + "20", color: type.color }}>
        {getIconEl(type.icon)}
      </div>
      <span className="flex-1 text-sm font-medium text-foreground truncate">{type.label}</span>
      <StylePreview style={type.allDayStyle} color={type.color} icon={type.icon} />
      <div className="flex gap-1 shrink-0">
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

// ── EventTypeForm ─────────────────────────────────────────────────────────────

function EventTypeForm({ type, existingLabels = [], onSave, onCancel }: {
  type?: EventType;
  existingLabels?: string[];
  onSave: (t: Omit<EventType, "id"> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [label,       setLabel]       = useState(type?.label       ?? "");
  const [color,       setColor]       = useState(type?.color       ?? PRESET_COLORS[0]);
  const [icon,        setIcon]        = useState(type?.icon        ?? "Calendar");
  const [allDayStyle, setAllDayStyle] = useState<DisplayStyle>(type?.allDayStyle ?? "block");
  const [timedStyle,  setTimedStyle]  = useState<DisplayStyle>(type?.timedStyle  ?? "block");

  const trimmed = label.trim();
  const isDuplicate = existingLabels
    .filter((l) => !type || l !== type.label)
    .some((l) => l.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nom du type"
          className={cn(
            "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2",
            isDuplicate ? "border-destructive focus:ring-destructive/30" : "border-border focus:ring-primary/30"
          )}
        />
        {isDuplicate && (
          <p className="text-xs text-destructive mt-1">Ce nom est déjà utilisé.</p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Couleur</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="size-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: color === c ? "var(--foreground)" : "transparent" }}
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
              {getIconEl(i, 14)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Style — journée entière</label>
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setAllDayStyle(s.id)}
                  title={s.title}
                  className={cn(
                    "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                    allDayStyle === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <StylePreview style={allDayStyle} color={color} icon={icon} />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Style — événements horaires</label>
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setTimedStyle(s.id)}
                  title={s.title}
                  className={cn(
                    "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                    timedStyle === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <StylePreview style={timedStyle} color={color} icon={icon} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Annuler</button>
        <button
          onClick={() => onSave({ id: type?.id, label, color, icon, allDayStyle, timedStyle })}
          disabled={!trimmed || isDuplicate}
          className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
        >
          <Check size={14} className="inline mr-1.5" />
          {type ? "Enregistrer" : "Créer"}
        </button>
      </div>
    </div>
  );
}

// ── SettingsPage ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { types, addType, updateType, removeType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events }      = useEventsStore();
  const {
    weekStartsOnMonday, toggleWeekStart,
    defaultEventTypeId, setDefaultEventTypeId,
    use24h, setUse24h,
    dateFormatEU, setDateFormatEU,
  } = useUIStore();
  const [editingType,    setEditingType]    = useState<EventType | null>(null);
  const [creating,       setCreating]       = useState(false);
  const [tab,            setTab]            = useState<"types" | "prefs" | "connection">("types");
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);

  const existingLabels = types.map((t) => t.label);

  const handleSave = (t: Omit<EventType, "id"> & { id?: string }) => {
    if (t.id) updateType(t as EventType);
    else addType(t);
    setEditingType(null);
    setCreating(false);
  };

  const handleDeleteRequest = (id: string) => {
    const usedByConnections = connections.filter((c) => c.displayTypeId === id).length;
    const usedByEvents      = events.filter((e) => e.eventTypeId === id).length;
    if (usedByConnections > 0 || usedByEvents > 0) {
      setDeletingTypeId(id);
    } else {
      removeType(id);
    }
  };

  const confirmDelete = () => {
    if (deletingTypeId) removeType(deletingTypeId);
    setDeletingTypeId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-card">
        <Link href="/" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold text-foreground">Paramètres</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-1 rounded-xl bg-muted p-1 mb-6 w-fit">
          {[
            { id: "types",      label: "Types d'événements" },
            { id: "prefs",      label: "Préférences"        },
            { id: "connection", label: "Data Sources"       },
          ].map((t) => (
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
            {deletingTypeId && (() => {
              const usedByConnections = connections.filter((c) => c.displayTypeId === deletingTypeId).length;
              const usedByEvents      = events.filter((e) => e.eventTypeId === deletingTypeId).length;
              return (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-destructive">Supprimer ce type ?</p>
                  <p className="text-xs text-muted-foreground">
                    Ce type est utilisé par{" "}
                    {usedByConnections > 0 && `${usedByConnections} calendrier${usedByConnections > 1 ? "s" : ""}`}
                    {usedByConnections > 0 && usedByEvents > 0 && " et "}
                    {usedByEvents > 0 && `${usedByEvents} événement${usedByEvents > 1 ? "s" : ""}`}.
                    {" "}Ils reviendront au style par défaut.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeletingTypeId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="px-3 py-1.5 rounded-lg text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer quand même
                    </button>
                  </div>
                </div>
              );
            })()}
            {types.map((t) =>
              editingType?.id === t.id
                ? <EventTypeForm key={t.id} type={t} existingLabels={existingLabels} onSave={handleSave} onCancel={() => setEditingType(null)} />
                : <EventTypeRow  key={t.id} type={t} onEdit={setEditingType} onDelete={handleDeleteRequest} />
            )}
            {creating && <EventTypeForm existingLabels={existingLabels} onSave={handleSave} onCancel={() => setCreating(false)} />}
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

        {tab === "connection" && <BackendSettings />}

        {tab === "prefs" && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-5">

            {/* Week start */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Semaine commence le lundi</div>
                <div className="text-xs text-muted-foreground">Afficher lundi en premier dans la vue calendrier</div>
              </div>
              <button
                onClick={toggleWeekStart}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", weekStartsOnMonday ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("size-4 rounded-full bg-white shadow transition-transform", weekStartsOnMonday ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="border-t border-border" />

            {/* 24h clock */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Format 24h</div>
                <div className="text-xs text-muted-foreground">Afficher les heures au format 24h (ex : 14:30)</div>
              </div>
              <button
                onClick={() => setUse24h(!use24h)}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", use24h ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("size-4 rounded-full bg-white shadow transition-transform", use24h ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="border-t border-border" />

            {/* Date format */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Format de date européen</div>
                <div className="text-xs text-muted-foreground">{dateFormatEU ? "JJ/MM/AAAA — ex : 15/03/2025" : "MM/JJ/AAAA — ex : 03/15/2025"}</div>
              </div>
              <button
                onClick={() => setDateFormatEU(!dateFormatEU)}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", dateFormatEU ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("size-4 rounded-full bg-white shadow transition-transform", dateFormatEU ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="border-t border-border" />

            {/* Default event type */}
            <div>
              <div className="text-sm font-medium text-foreground mb-0.5">Type par défaut</div>
              <div className="text-xs text-muted-foreground mb-3">Pré-sélectionné lors de la création d'un événement</div>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDefaultEventTypeId(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all",
                      defaultEventTypeId === t.id
                        ? "border-transparent"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                    style={defaultEventTypeId === t.id ? { backgroundColor: t.color + "20", borderColor: t.color, color: t.color } : {}}
                  >
                    {getIconEl(t.icon, 12)}
                    {t.label}
                  </button>
                ))}
                <button
                  onClick={() => setDefaultEventTypeId("custom")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all",
                    defaultEventTypeId === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {getIconEl("Palette", 12)}
                  Personnalisé
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
