"use client";

import { useState } from "react";
import { Trash2, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { ActionButton } from "../components/ui/action-button";
import { Switch } from "../components/ui/switch";
import { PanelHeader } from "../components/settings/PanelHeader";
import { useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../store";
import { useDragReorder } from "../hooks/useDragReorder";
import { getIconEl } from "../components/settings/EventTypeModal";
import { RuleModal } from "../components/settings/RuleModal";
import { describeMatch } from "../lib/rules";
import type { EventType, Rule } from "../types";

const MATCH_TYPE_LABELS: Record<Rule["matchType"], string> = {
  event: "Événement",
  name: "Titre",
  source: "Source",
  all: "Défaut",
};

function RuleRow({
  rule, description, displayType, broken, isFirst, isLast,
  onToggle, onEdit, onRemove, onMoveUp, onMoveDown, dragProps,
}: {
  rule: Rule;
  description: string;
  displayType: EventType | undefined;
  broken: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragProps?: { draggable: boolean; onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void };
}) {
  const isCatchAll = rule.matchType === "all";

  return (
    <div
      {...(isCatchAll ? undefined : dragProps)}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-card",
        !rule.enabled && "opacity-50",
      )}
    >
      <div className="flex flex-col shrink-0">
        <button
          onClick={onMoveUp}
          aria-label="Monter la règle"
          disabled={isCatchAll || isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={onMoveDown}
          aria-label="Descendre la règle"
          disabled={isCatchAll || isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
        >
          <ChevronDown size={12} />
        </button>
      </div>

      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-12">
        {MATCH_TYPE_LABELS[rule.matchType]}
      </span>

      <span className="flex-1 min-w-0 truncate text-xs text-foreground">{description}</span>

      {broken ? (
        <span className="flex items-center gap-1 text-[10px] text-destructive shrink-0" title="Le type d'affichage n'existe plus">
          <AlertTriangle size={12} />
          Cassé
        </span>
      ) : (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
          style={{ backgroundColor: (displayType?.color ?? "#6366f1") + "20", color: displayType?.color ?? "#6366f1" }}
        >
          {displayType && getIconEl(displayType.icon, 10)}
          {displayType?.label ?? "—"}
        </span>
      )}

      <Switch checked={rule.enabled} onCheckedChange={onToggle} disabled={isCatchAll} />

      <button onClick={onEdit} className="text-xs font-medium text-primary hover:underline shrink-0">
        Modifier
      </button>

      {!isCatchAll && (
        <ActionButton
          variant="ghost"
          onAction={onRemove}
          confirmChildren={<><Trash2 size={13} />Confirmer la suppression</>}
          className="gap-1.5 h-auto px-2 py-1 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={13} />
          Supprimer
        </ActionButton>
      )}
    </div>
  );
}

/** Rules manager — rendered as drawer content from the sidebar, beneath the display types list. */
export function RulesPanel({ initialEditRuleId }: { initialEditRuleId?: string } = {}) {
  const { rules, toggleRule, removeRule, reorderRule } = useRuleStore();
  const { getType, getDefaultType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const initialRule = initialEditRuleId ? rules.find((r) => r.id === initialEditRuleId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialRule);
  const [editingRule, setEditingRule] = useState<Rule | null>(initialRule);
  const { getDragProps } = useDragReorder(rules, (r) => r.id, reorderRule);

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

  function move(id: string, delta: number) {
    const idx = rules.findIndex((r) => r.id === id);
    const toIndex = idx + delta;
    if (toIndex < 0 || toIndex >= rules.length) return;
    reorderRule(id, toIndex);
  }

  if (formOpen) {
    return (
      <RuleModal
        key={editingRule?.id ?? "new-rule"}
        rule={editingRule ?? undefined}
        onClose={() => { setFormOpen(false); setEditingRule(null); }}
        showBackButton
      />
    );
  }

  return (
    <>
      <PanelHeader
        title="Règles d'affichage"
        action={{ label: "Nouvelle règle", onClick: () => { setEditingRule(null); setFormOpen(true); } }}
      />

      <div className="space-y-1.5 px-4 pb-4">
        {rules.map((rule, index) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            description={describeMatch(rule, getEventTitle, getConnectionName)}
            displayType={rule.matchType === "all" ? getDefaultType() : getType(rule.displayTypeId)}
            broken={rule.matchType !== "all" && !getType(rule.displayTypeId)}
            isFirst={index === 0}
            isLast={index === rules.length - 1}
            onToggle={() => toggleRule(rule.id)}
            onEdit={() => { setEditingRule(rule); setFormOpen(true); }}
            onRemove={() => removeRule(rule.id)}
            onMoveUp={() => move(rule.id, -1)}
            onMoveDown={() => move(rule.id, 1)}
            dragProps={getDragProps(index)}
          />
        ))}
      </div>
    </>
  );
}
