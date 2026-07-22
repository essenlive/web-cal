import { useState } from "react";
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
  event: "This event",
  name: "Title matches",
  source: "This source",
};

export interface RuleModalProps {
  /** Editing an existing rule instead of creating a new one. */
  rule?: Rule;
  /** Pre-fill for a new rule created from an entry point (event/connection modal). Ignored when `rule` is set. */
  initialMatchType?: CreatableMatchType;
  initialMatchValue?: string;
  /** Called to dismiss this form (Cancel, or after a successful save). Meaning depends on the caller — e.g. "back to the rules list" or "back to the connection form". */
  onClose: () => void;
}

export function RuleModal({ rule, initialMatchType, initialMatchValue, onClose }: RuleModalProps) {
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
      setError(matchType === "name" ? "A pattern is required." : "Choose an option.");
      return;
    }
    if (matchType === "name" && !isValidPattern(matchValue)) {
      setError("Invalid regular expression.");
      return;
    }
    if (!displayTypeId) {
      setError("Choose a display type.");
      return;
    }
    const isDuplicate = rules.some(
      (r) => r.id !== rule?.id && r.matchType === matchType && r.matchValue === matchValue && r.displayTypeId === displayTypeId,
    );
    if (isDuplicate) {
      setError("An identical rule already exists.");
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
      <div className="flex flex-col gap-0.5 p-4 pr-10">
        <h2 className="font-semibold text-foreground">
          {isCatchAll ? "Edit Default Rule" : editing ? "Edit Rule" : "New Rule"}
        </h2>
      </div>

      <div className="space-y-4 px-4 pb-4">
          {!isCatchAll && (
            <>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Match by</Label>
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
                  {matchType === "name" ? "Title pattern (text or regex)" : matchType === "event" ? "Event" : "Source"}
                </Label>
                {matchType === "name" ? (
                  <Input
                    value={matchValue}
                    onChange={(e) => setMatchValue(e.target.value)}
                    placeholder="e.g. Dentist"
                    className="rounded-lg px-2.5 py-2 h-auto text-sm"
                  />
                ) : matchType === "event" ? (
                  <Combobox
                    options={events.map((e) => ({ value: e.id, label: e.title }))}
                    value={matchValue || undefined}
                    onChange={setMatchValue}
                    placeholder="Search events…"
                    emptyText="No events found."
                  />
                ) : (
                  <Combobox
                    options={connections.map((c) => ({ value: c.id, label: c.name }))}
                    value={matchValue || undefined}
                    onChange={setMatchValue}
                    placeholder="Search sources…"
                    emptyText="No sources found."
                  />
                )}
              </div>
            </>
          )}

          {isCatchAll ? (
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display type</Label>
              <p className="text-xs text-muted-foreground">
                Always resolves to the default type — currently{" "}
                <span className="font-medium text-foreground inline-flex items-center gap-1">
                  {getIconEl(getDefaultType().icon, 12)}
                  {getDefaultType().label}
                </span>
                . Change the default type from its edit screen.
              </p>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display type</Label>
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
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              {editing ? "Save" : "Create Rule"}
            </Button>
          </div>
        </div>
    </>
  );
}
