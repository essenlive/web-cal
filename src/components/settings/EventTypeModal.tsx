/**
 * EventTypeModal — popup create/edit form for a single event type.
 * Used from the sidebar's compact event-type preview.
 */

import { useState } from "react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { ColorPicker } from "./ColorPicker";
import { PanelHeader, PanelFooter, InlineLink } from "./PanelHeader";
import { RuleEditRow, SourcesMultiSelect } from "./RuleEditRow";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { ItemBadge } from "../sidebar/ItemRow";
import { useUIStore, useRuleStore, useEventTypeStore, useEventsStore, useConnectionStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { describeMatch } from "../../lib/rules";
import { getIconEl } from "../../lib/icons";
import type { DisplayStyle, EventType, Rule } from "../../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { id: DisplayStyle; label: string; title: string }[] = [
  { id: "text",          label: "Texte",   title: "Nom affiché à côté du numéro"       },
  { id: "avatar-tr",     label: "↗ Badge", title: "Icône ronde haut-droite"            },
  { id: "avatar-bl",     label: "↙ Badge", title: "Icône ronde bas-gauche"             },
  { id: "avatar-br",     label: "↘ Badge", title: "Icône ronde bas-droite"             },
  { id: "block",         label: "Bloc",    title: "Chip texte pleine largeur"          },
  { id: "background",    label: "Fond",    title: "Colore le fond de la case"          },
  { id: "border-top",    label: "Bord ↑",  title: "Ligne colorée en haut de la case"   },
  { id: "border-bottom", label: "Bord ↓",  title: "Ligne colorée en bas de la case"    },
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

const avatarDot = (color: string, icon: string, letter?: string) => (
  <div className="size-5 rounded-full flex items-center justify-center shadow-xs" style={{ backgroundColor: color }}>
    {letter
      ? <span style={{ color: "#fff", fontSize: 9, lineHeight: 1, fontWeight: 600 }}>{letter.charAt(0).toUpperCase()}</span>
      : getIconEl(icon, 9, "#fff")}
  </div>
);

/**
 * Drag-reorder for a subset of `allRules` filtered down to just this type's
 * rules — dropping at local index N moves the dragged rule to sit where the
 * rule currently at that local slot sits in the *full* array, so relative
 * order among same-type rules stays intuitive while still repositioning
 * correctly against every other type's rules in the real priority list.
 */
export function useFilteredRuleDragReorder(allRules: Rule[], filtered: Rule[], reorder: (id: string, toIndex: number) => void) {
  return useDragReorder(filtered, (r) => r.id, (id, toLocalIndex) => {
    const globalIndex = allRules.findIndex((r) => r.id === filtered[toLocalIndex].id);
    reorder(id, globalIndex);
  });
}

export function StylePreview({
  style, color, icon, badgeLetter, label = "Titre",
}: {
  style: DisplayStyle; color: string; icon: string; badgeLetter?: boolean; label?: string;
}) {
  const letter = badgeLetter ? label : undefined;

  if (style === "background") {
    return (
      <div
        className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0"
        style={{ backgroundColor: color + "28", border: `2px solid ${color}` }}
      >
        <span className="absolute top-1 left-1.5 text-[10px] font-semibold" style={{ color }}>15</span>
        <span className="absolute top-1 left-6 right-1 text-[10px] font-medium truncate" style={{ color, opacity: 0.75 }}>{label}</span>
      </div>
    );
  }

  if (style === "text") {
    return (
      <div className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-muted">
        <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-foreground/70">15</span>
        <span className="absolute top-1 left-6 right-1 text-[10px] font-medium truncate" style={{ color }}>{label}</span>
      </div>
    );
  }

  if (style === "border-top" || style === "border-bottom") {
    return (
      <div className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-muted">
        <div
          className="absolute inset-x-0 h-0.75"
          style={{ backgroundColor: color, ...(style === "border-top" ? { top: 0 } : { bottom: 0 }) }}
        />
        <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-foreground/70">15</span>
      </div>
    );
  }

  return (
    <div className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-muted">
      <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-foreground/70">15</span>
      {style === "avatar-tr" && <div className="absolute top-0.5 right-0.5">{avatarDot(color, icon, letter)}</div>}
      {style === "avatar-bl" && <div className="absolute bottom-0.5 left-0.5">{avatarDot(color, icon, letter)}</div>}
      {style === "avatar-br" && <div className="absolute bottom-0.5 right-0.5">{avatarDot(color, icon, letter)}</div>}
      {style === "block" && (
        <div className="absolute bottom-1 left-1 right-1">
          <div className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white truncate" style={{ backgroundColor: color }}>
            {label}
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
  const [badgeLetter, setBadgeLetter] = useState(type?.badgeLetter ?? false);
  const [allDayStyle, setAllDayStyle] = useState<DisplayStyle>(type?.allDayStyle ?? "block");
  const [timedStyle,  setTimedStyle]  = useState<DisplayStyle>(type?.timedStyle  ?? "block");
  const [isDefault,   setIsDefault]   = useState(type?.isDefault ?? false);
  // Reserved upfront (even for a not-yet-saved type) so the Règles section below
  // can link rules to it immediately instead of waiting for a first save.
  const [typeId] = useState(() => type?.id ?? crypto.randomUUID());

  const { openDrawer } = useUIStore();
  const { rules, addRule, removeRule, updateRule, reorderRule } = useRuleStore();
  const { getDefaultType, types } = useEventTypeStore();
  const { events } = useEventsStore();
  const { connections } = useConnectionStore();
  const linkedRules = rules.filter((r) => r.displayTypeId === typeId && r.matchType !== "all");
  const textRules = linkedRules.filter((r) => r.matchType === "name");
  const legacyRules = linkedRules.filter((r) => r.matchType === "event");
  const { getDragProps } = useFilteredRuleDragReorder(rules, textRules, reorderRule);
  const defaultType = getDefaultType();

  const trimmed = label.trim();
  const isDuplicate = existingLabels
    .filter((l) => !type || l !== type.label)
    .some((l) => l.toLowerCase() === trimmed.toLowerCase());

  function handleSave() {
    onSave({ id: typeId, label: trimmed, color, icon, badgeLetter, allDayStyle, timedStyle, isDefault });
    handleClose();
  }

  // If the type was never actually saved (Cancel/back out of a fresh "Nouveau
  // type"), undo anything linked against the reserved id — text/event rules
  // were created fresh for this draft, so delete them outright; a source's
  // rule always has to point *somewhere*, so reassigning it here instead
  // reverts it to the default type rather than leaving it dangling.
  function handleClose() {
    if (!types.some((t) => t.id === typeId)) {
      linkedRules.forEach((r) => {
        if (r.matchType === "source") updateRule({ ...r, displayTypeId: defaultType.id });
        else removeRule(r.id);
      });
    }
    onClose();
  }

  return (
    <>
      <PanelHeader
        title={type ? "Modifier le type" : "Nouveau type"}
        onBack={handleClose}
        description="Choisissez un nom, une couleur, une icône et un style d'affichage pour les événements journée entière et horaires."
      />

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

          <ColorPicker value={color} onChange={setColor} colors={PRESET_COLORS} />

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
            <label className="flex items-center gap-2 text-xs text-foreground mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={badgeLetter}
                onChange={(e) => setBadgeLetter(e.target.checked)}
                className="size-3.5 rounded border-border accent-primary"
              />
              Utiliser la première lettre du titre plutôt que l&apos;icône dans les badges
            </label>
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
                <StylePreview style={allDayStyle} color={color} icon={icon} badgeLetter={badgeLetter} label={trimmed || "Titre"} />
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
                <StylePreview style={timedStyle} color={color} icon={icon} badgeLetter={badgeLetter} label={trimmed || "Titre"} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-1 block">Règles</label>
            <p className="text-xs text-muted-foreground mb-2">
              Les règles s&apos;appliquent par ordre de priorités de haut en bas. Si aucune règle ne s&apos;applique,
              le style par défaut est actuellement —{" "}
              <InlineLink onClick={() => openDrawer("eventType", defaultType.id)}>{defaultType.label}</InlineLink>.
            </p>

            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Textes</h4>
                <div className="space-y-1.5">
                  {textRules.map((r, index) => (
                    <RuleEditRow key={r.id} rule={r} onDelete={() => removeRule(r.id)} dragProps={getDragProps(index)} lockDisplayType />
                  ))}
                  <AddItemButton
                    label="Nouvelle règle"
                    onClick={() => addRule({ matchType: "name", matchValue: "", displayTypeId: typeId })}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Sources</h4>
                <SourcesMultiSelect typeId={typeId} />
              </div>

              {legacyRules.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Autres</h4>
                  <div className="space-y-1.5">
                    {legacyRules.map((r) => (
                      <DrawerItemRow
                        key={r.id}
                        badge={<ItemBadge color={color}>{getIconEl(icon, 10, "#fff")}</ItemBadge>}
                        name={describeMatch(r, (id) => events.find((e) => e.id === id)?.title, (id) => connections.find((c) => c.id === id)?.name)}
                        tag={
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Événement
                          </span>
                        }
                        onDelete={() => removeRule(r.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
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

          <PanelFooter
            onDelete={onDelete}
            deleteDisabledReason={deleteDisabledReason}
            onCancel={handleClose}
            onSave={handleSave}
            saveDisabled={!trimmed || isDuplicate}
            saveLabel={type ? "Enregistrer" : "Créer"}
          />
        </div>
    </>
  );
}
