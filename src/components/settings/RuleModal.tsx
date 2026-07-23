import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Combobox } from "../ui/combobox";
import { useRuleStore, useEventTypeStore, useEventsStore, useConnectionStore } from "../../store";
import { isValidPattern } from "../../lib/rules";
import { getIconEl } from "./EventTypeModal";
import type { Rule, RuleMatchType } from "../../types";

type CreatableMatchType = Exclude<RuleMatchType, "all">;

const MATCH_TYPE_LABELS: Record<CreatableMatchType, string> = {
  event: "Cet événement",
  name: "Le titre correspond à",
  source: "Cette source",
};

export interface RuleModalProps {
  /** Editing an existing rule instead of creating a new one. */
  rule?: Rule;
  /** Pre-fill for a new rule created from an entry point (event/connection modal). Ignored when `rule` is set. */
  initialMatchType?: CreatableMatchType;
  initialMatchValue?: string;
  /** Called to dismiss this form (Cancel, or after a successful save). Meaning depends on the caller — e.g. "back to the rules list" or "back to the connection form". */
  onClose: () => void;
  /** Renders a back-chevron next to the title, wired to `onClose` — set when the caller is a list view (e.g. RulesPanel) rather than a nested "nothing to go back to" flow. */
  showBackButton?: boolean;
}

export function RuleModal({ rule, initialMatchType, initialMatchValue, onClose, showBackButton }: RuleModalProps) {
  const { rules, addRule, updateRule } = useRuleStore();
  const { types, getDefaultType } = useEventTypeStore();
  const { events } = useEventsStore();
  const { connections } = useConnectionStore();
  const editing = !!rule;
  const isCatchAll = rule?.matchType === "all";

  const [matchType, setMatchType] = useState<CreatableMatchType>(
    (rule?.matchType !== "all" ? rule?.matchType : undefined) ?? initialMatchType ?? "name",
  );
  const [matchValue, setMatchValue] = useState(rule?.matchValue ?? initialMatchValue ?? "");
  const [displayTypeId, setDisplayTypeId] = useState(rule?.displayTypeId ?? types[0]?.id ?? "");
  const [error, setError] = useState("");

  function handleSave() {
    if (isCatchAll) {
      onClose();
      return;
    }

    if (!matchValue.trim()) {
      setError(matchType === "name" ? "Un motif est requis." : "Choisissez une option.");
      return;
    }
    if (matchType === "name" && !isValidPattern(matchValue)) {
      setError("Expression régulière invalide.");
      return;
    }
    if (!displayTypeId) {
      setError("Choisissez un type d'affichage.");
      return;
    }
    const isDuplicate = rules.some(
      (r) => r.id !== rule?.id && r.matchType === matchType && r.matchValue === matchValue && r.displayTypeId === displayTypeId,
    );
    if (isDuplicate) {
      setError("Une règle identique existe déjà.");
      return;
    }

    if (editing) {
      updateRule({ ...rule, matchType, matchValue, displayTypeId });
    } else {
      addRule({ matchType, matchValue, displayTypeId });
    }
    onClose();
  }

  return (
    <>
      {/* Plain markup, not Drawer/Dialog Header+Title — this form is embedded inside
          both a Drawer (Rules panel, connection editor) and a Dialog (event detail),
          and can't depend on either overlay primitive's compound components. */}
      <div className="flex items-center gap-1 p-4 pr-10">
        {showBackButton && (
          <button
            onClick={onClose}
            aria-label="Retour"
            className="shrink-0 -ml-1.5 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h2 className="font-semibold text-foreground truncate">
          {isCatchAll ? "Modifier la règle par défaut" : editing ? "Modifier la règle" : "Nouvelle règle"}
        </h2>
      </div>

      <div className="space-y-4 px-4 pb-4">
          {!isCatchAll && (
            <>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Correspondance par</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(MATCH_TYPE_LABELS) as CreatableMatchType[]).map((mt) => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => { setMatchType(mt); setMatchValue(""); }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                        matchType === mt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {MATCH_TYPE_LABELS[mt]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {matchType === "name" ? "Motif du titre (texte ou regex)" : matchType === "event" ? "Événement" : "Source"}
                </Label>
                {matchType === "name" ? (
                  <Input
                    value={matchValue}
                    onChange={(e) => setMatchValue(e.target.value)}
                    placeholder="ex. Dentiste"
                    className="rounded-lg px-2.5 py-2 h-auto text-sm"
                  />
                ) : matchType === "event" ? (
                  <Combobox
                    options={events.map((e) => ({ value: e.id, label: e.title }))}
                    value={matchValue || undefined}
                    onChange={setMatchValue}
                    placeholder="Rechercher un événement…"
                    emptyText="Aucun événement trouvé."
                  />
                ) : (
                  <Combobox
                    options={connections.map((c) => ({ value: c.id, label: c.name }))}
                    value={matchValue || undefined}
                    onChange={setMatchValue}
                    placeholder="Rechercher une source…"
                    emptyText="Aucune source trouvée."
                  />
                )}
              </div>
            </>
          )}

          {isCatchAll ? (
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type d'affichage</Label>
              <p className="text-xs text-muted-foreground">
                Se résout toujours vers le type par défaut — actuellement{" "}
                <span className="font-medium text-foreground inline-flex items-center gap-1">
                  {getIconEl(getDefaultType().icon, 12)}
                  {getDefaultType().label}
                </span>
                . Modifiez le type par défaut depuis son écran d'édition.
              </p>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type d'affichage</Label>
              <div className="flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDisplayTypeId(t.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-all",
                      displayTypeId === t.id ? "border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    style={displayTypeId === t.id ? { backgroundColor: t.color + "20", borderColor: t.color, color: t.color } : {}}
                  >
                    {getIconEl(t.icon, 12)}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">
              Annuler
            </Button>
            <Button type="button" onClick={handleSave}>
              {editing ? "Enregistrer" : "Créer la règle"}
            </Button>
          </div>
        </div>
    </>
  );
}
