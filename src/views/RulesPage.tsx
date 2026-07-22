"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { DrawerHeader, DrawerTitle } from "../components/ui/drawer";
import { useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../store";
import { getIconEl } from "../components/settings/EventTypeModal";
import { RuleModal } from "../components/settings/RuleModal";
import { describeMatch } from "../lib/rules";
import type { EventType, Rule } from "../types";

const MATCH_TYPE_LABELS: Record<Rule["matchType"], string> = {
  event: "Event",
  name: "Title",
  source: "Source",
  all: "Default",
};

function RuleRow({
  rule, description, displayType, broken, isFirst, isLast,
  onToggle, onEdit, onRemove, onMoveUp, onMoveDown, onDragStart, onDragOver, onDrop,
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
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isCatchAll = rule.matchType === "all";

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-destructive/5">
        <span className="flex-1 text-xs text-muted-foreground truncate">Delete this rule?</span>
        <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:text-foreground shrink-0">Cancel</button>
        <button onClick={onRemove} className="text-xs font-medium text-destructive shrink-0">Delete</button>
      </div>
    );
  }

  return (
    <div
      draggable={!isCatchAll}
      onDragStart={isCatchAll ? undefined : onDragStart}
      onDragOver={isCatchAll ? undefined : onDragOver}
      onDrop={isCatchAll ? undefined : onDrop}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-card",
        !rule.enabled && "opacity-50",
      )}
    >
      <div className="flex flex-col shrink-0">
        <button
          onClick={onMoveUp}
          aria-label="Move rule up"
          disabled={isCatchAll || isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={onMoveDown}
          aria-label="Move rule down"
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
        <span className="flex items-center gap-1 text-[11px] text-destructive shrink-0" title="Display type no longer exists">
          <AlertTriangle size={12} />
          Broken
        </span>
      ) : (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
          style={{ backgroundColor: (displayType?.color ?? "#6366f1") + "20", color: displayType?.color ?? "#6366f1" }}
        >
          {displayType && getIconEl(displayType.icon, 10)}
          {displayType?.label ?? "—"}
        </span>
      )}

      <Switch checked={rule.enabled} onCheckedChange={onToggle} disabled={isCatchAll} />

      <button onClick={onEdit} className="text-xs font-medium text-primary hover:underline shrink-0">
        Edit
      </button>

      {!isCatchAll && (
        <button onClick={() => setConfirming(true)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Delete rule">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/** Rules manager — rendered as drawer content from the sidebar, beneath the display types list. */
export function RulesPanel() {
  const { rules, toggleRule, removeRule, reorderRule } = useRuleStore();
  const { getType, getDefaultType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
      />
    );
  }

  return (
    <>
      <DrawerHeader className="flex-row items-center justify-between space-y-0">
        <DrawerTitle>Display Rules</DrawerTitle>
        <Button onClick={() => { setEditingRule(null); setFormOpen(true); }} className="gap-1.5 rounded-lg text-sm">
          <Plus size={14} />
          New Rule
        </Button>
      </DrawerHeader>

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
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== index) reorderRule(rules[dragIndex].id, index);
              setDragIndex(null);
            }}
          />
        ))}
      </div>
    </>
  );
}
