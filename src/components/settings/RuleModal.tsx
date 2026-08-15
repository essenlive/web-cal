import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Combobox } from "../ui/combobox";
import { useRuleStore, useEventTypeStore, useConnectionStore } from "../../store";
import { isValidPattern } from "../../lib/rules";
import { getIconEl } from "../../lib/icons";
import type { RuleMatchType } from "../../types";

/** The only two match types a rule can be created as — "event" (matching one specific event) is retired, "all" is the single undeletable catch-all. */
export type CreatableMatchType = Exclude<RuleMatchType, "all" | "event">;

const MATCH_TYPE_LABELS: Record<CreatableMatchType, string> = {
  name: "Le titre correspond à",
  source: "Cette source",
};

export interface RuleModalProps {
  /** Pre-fill for the new rule (e.g. from the event detail dialog's "by title" quick action). */
  initialMatchType?: CreatableMatchType;
  initialMatchValue?: string;
  /** Called to dismiss this form (Cancel, or after a successful save). */
  onClose: () => void;
}

/** Quick "create a rule" form — the only remaining caller is EventDetail's "Create a rule from this event" action. The main rules drawer (RulesPage.tsx) edits rules inline and no longer uses this. */
export function RuleModal({ initialMatchType, initialMatchValue, onClose }: RuleModalProps) {
  const { rules, addRule } = useRuleStore();
  const { types } = useEventTypeStore();
  const { connections } = useConnectionStore();

  const [matchType, setMatchType] = useState<CreatableMatchType>(initialMatchType ?? "name");
  const [matchValue, setMatchValue] = useState(initialMatchValue ?? "");
  const [displayTypeId, setDisplayTypeId] = useState(types[0]?.id ?? "");
  const [error, setError] = useState("");

  function handleSave() {
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
      (r) => r.matchType === matchType && r.matchValue === matchValue && r.displayTypeId === displayTypeId,
    );
    if (isDuplicate) {
      setError("Une règle identique existe déjà.");
      return;
    }

    addRule({ matchType, matchValue, displayTypeId });
    onClose();
  }

  return (
    <>
      {/* Plain markup, not Dialog Header+Title — this form is embedded inside a Dialog
          (event detail) and can't depend on that overlay primitive's compound components. */}
      <div className="flex items-center gap-1 p-4 pr-10">
        <h2 className="font-semibold text-foreground truncate">Nouvelle règle</h2>
      </div>

      <div className="space-y-4 px-4 pb-4">
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
              {matchType === "name" ? "Motif du titre (texte ou regex)" : "Source"}
            </Label>
            {matchType === "name" ? (
              <Input
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                placeholder="ex. Dentiste"
                className="rounded-lg px-2.5 py-2 h-auto text-sm"
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

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground">
              Annuler
            </Button>
            <Button type="button" onClick={handleSave}>
              Créer la règle
            </Button>
          </div>
        </div>
    </>
  );
}
