/**
 * EventTypeModal — popup create/edit form for a single event type.
 * Used from the sidebar's compact event-type preview.
 */

import { useState } from "react";
import * as Icons from "lucide-react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { Input } from "../ui/input";
import { PanelHeader } from "./PanelHeader";
import { useRuleStore, useEventsStore, useConnectionStore } from "../../store";
import { describeMatch } from "../../lib/rules";
import type { DisplayStyle, EventType } from "../../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { id: DisplayStyle; label: string; title: string }[] = [
  { id: "avatar-tl", label: "↖ Badge", title: "Icône ronde haut-gauche"   },
  { id: "avatar-bl", label: "↙ Badge", title: "Icône ronde bas-gauche"    },
  { id: "avatar-br", label: "↘ Badge", title: "Icône ronde bas-droite"    },
  { id: "block",     label: "Bloc",    title: "Chip texte pleine largeur" },
  { id: "day",       label: "Fond",    title: "Colore le fond de la case" },
];

export const PRESET_COLORS = [
  "#3b82f6","#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f59e0b","#10b981","#14b8a6","#06b6d4","#64748b",
];

const ICON_OPTIONS = [
  "Users","AlertCircle","Layers","Brain","FileText","Heart","Calendar",
  "Clock","Star","Zap","Coffee","BookOpen","Video","Phone","Mail",
  "Home","Globe","Code","Briefcase","Target",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getIconEl(name: string, size = 16, color?: string) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

const avatarDot = (color: string, icon: string) => (
  <div className="size-5 rounded-full flex items-center justify-center shadow-xs" style={{ backgroundColor: color }}>
    {getIconEl(icon, 9, "#fff")}
  </div>
);

export function StylePreview({ style, color, icon }: { style: DisplayStyle; color: string; icon: string }) {
  if (style === "day") {
    return (
      <div
        className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0"
        style={{ backgroundColor: color + "28", border: `2px solid ${color}` }}
      >
        <span className="absolute top-1 right-1.5 text-[10px] font-semibold" style={{ color }}>15</span>
        <span className="absolute bottom-1 left-1 right-1 text-[10px] font-medium truncate" style={{ color, opacity: 0.65 }}>Titre</span>
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
          <div className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white truncate" style={{ backgroundColor: color }}>
            Titre
          </div>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EventTypeModalProps {
  type?: EventType;
  existingLabels?: string[];
  onSave: (t: Omit<EventType, "id"> & { id?: string }) => void;
  /** When set, editing this type shows a delete button. Omitted for new types. */
  onDelete?: () => void;
  /** Disables delete (e.g. this type is the default-rule target) with an explanatory title. */
  deleteDisabledReason?: string;
  /** Called to dismiss this panel (Cancel, or after a successful save). */
  onClose: () => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function EventTypeModal({ type, existingLabels = [], onSave, onDelete, deleteDisabledReason, onClose }: EventTypeModalProps) {
  const [label,       setLabel]       = useState(type?.label       ?? "");
  const [color,       setColor]       = useState(type?.color       ?? PRESET_COLORS[0]);
  const [icon,        setIcon]        = useState(type?.icon        ?? "Calendar");
  const [allDayStyle, setAllDayStyle] = useState<DisplayStyle>(type?.allDayStyle ?? "block");
  const [timedStyle,  setTimedStyle]  = useState<DisplayStyle>(type?.timedStyle  ?? "block");
  const [isDefault,   setIsDefault]   = useState(type?.isDefault ?? false);

  const { rules } = useRuleStore();
  const { events } = useEventsStore();
  const { connections } = useConnectionStore();
  const linkedRules = type
    ? rules.filter((r) => (r.matchType === "all" ? isDefault : r.displayTypeId === type.id))
    : [];

  const trimmed = label.trim();
  const isDuplicate = existingLabels
    .filter((l) => !type || l !== type.label)
    .some((l) => l.toLowerCase() === trimmed.toLowerCase());

  function handleSave() {
    onSave({ id: type?.id, label: trimmed, color, icon, allDayStyle, timedStyle, isDefault });
    onClose();
  }

  return (
    <>
      <PanelHeader title={type ? "Modifier le type" : "Nouveau type"} onBack={onClose} />

      <div className="space-y-4 px-4 pb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nom du type"
              className={cn("rounded-xl px-3 py-2 h-auto text-sm", isDuplicate && "border-destructive")}
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

          {type && (
            <div>
              <label className={cn("flex items-center gap-2 text-xs select-none", isDefault ? "text-muted-foreground" : "text-foreground cursor-pointer")}>
                <input
                  type="checkbox"
                  checked={isDefault}
                  disabled={isDefault}
                  onChange={() => setIsDefault(true)}
                  className="size-3.5 rounded border-border accent-primary disabled:cursor-not-allowed"
                />
                Type par défaut (utilisé quand aucune règle ne s'applique)
              </label>
            </div>
          )}

          {type && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Règles liées</label>
              {linkedRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune règle n'utilise ce type.</p>
              ) : (
                <ul className="space-y-1">
                  {linkedRules.map((r) => (
                    <li key={r.id} className="text-xs text-foreground truncate">
                      {r.matchType === "all"
                        ? "Règle par défaut (aucune correspondance)"
                        : describeMatch(
                            r,
                            (id) => events.find((e) => e.id === id)?.title,
                            (id) => connections.find((c) => c.id === id)?.name,
                          )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {onDelete ? (
              <ActionButton
                variant="ghost"
                onAction={onDelete}
                disabled={!!deleteDisabledReason}
                title={deleteDisabledReason}
                confirmChildren={<><Trash2 size={13} />Confirmer la suppression</>}
                className="gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={13} />
                Supprimer
              </ActionButton>
            ) : <span />}

            <div className="flex gap-2">
              <Button variant="ghost" className="text-muted-foreground" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} disabled={!trimmed || isDuplicate} className="gap-1.5">
                <Check size={14} />
                {type ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </div>
        </div>
    </>
  );
}
