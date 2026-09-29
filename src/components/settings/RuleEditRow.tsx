"use client";

/**
 * RuleEditRow — inline-editable row for a "source"/"name" rule: a value
 * editor (connection dropdown or text pill — no match-type indicator, since
 * the row's section already implies whether it's a text or source rule), an
 * arrow, and a display-type dropdown (badge plus the start of the type's
 * name), all committing immediately via updateRule. Shared by the main rules
 * drawer (RulesPage.tsx, everything editable) and the "rules for this item"
 * sections embedded in EventTypeForm (`lockDisplayType` — the target type is
 * implied by which form you're in) and ConnectionForm (`lockValue` — the
 * source is implied to be "this connection").
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Copy, GripVertical } from "lucide-react";
import { cn } from "../../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, SimpleTooltip } from "../ui/tooltip";
import { ItemBadge } from "../sidebar/ItemRow";
import type { DragProps } from "../../hooks/useDragReorder";
import { DeleteButton, IconButton } from "./DrawerItemRow";
import { useRuleStore, useEventTypeStore, useConnectionStore } from "../../store";
import { getIconEl } from "../../lib/icons";
import { isValidPattern } from "../../lib/rules";
import type { Connection, EventType, Rule } from "../../types";

/** The two match types creatable/editable inline — "event" (legacy, retired) and "all" (catch-all) are not. */
export type EditableMatchType = "source" | "name";

/**
 * Ensures exactly one enabled `matchType:"source"` rule exists for `connectionId`,
 * creating one against the default display type if missing, and returns it (or
 * `undefined` for the one render before the creating effect commits). Shared by
 * ConnectionForm's source-rule section and the standalone rules drawer's
 * "Sources" list — both need "one undeletable rule per source" without duplicating
 * the find-or-create wiring.
 */
export function useSourceRule(connectionId: string): Rule | undefined {
  const { rules, addRule } = useRuleStore();
  const { getDefaultType } = useEventTypeStore();
  const rule = rules.find((r) => r.matchType === "source" && r.matchValue === connectionId);

  useEffect(() => {
    // Re-check against live store state, not the `rule` closed over above — React
    // Strict Mode (and any other double-mount) re-runs this effect with that same
    // stale closure, so relying on it lets two invocations both see "missing" and
    // both add a rule.
    const exists = useRuleStore.getState().rules.some((r) => r.matchType === "source" && r.matchValue === connectionId);
    if (!exists) addRule({ matchType: "source", matchValue: connectionId, displayTypeId: getDefaultType().id });
  }, [connectionId, addRule, getDefaultType]);

  return rule;
}

// ── Generic small dropdown, used for the source / display-type pickers ─────────

export function RuleDropdown<T extends string>({ value, options, onChange, renderTrigger, renderOption, className, label }: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  renderTrigger: (v: T) => ReactNode;
  renderOption: (v: T) => ReactNode;
  className?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className={cn("flex shrink-0 items-center gap-0.5 rounded-full p-0.5 hover:bg-background/60 min-w-0", className)}
            >
              <ChevronDown size={10} className="shrink-0 text-muted-foreground" />
              {renderTrigger(value)}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 max-h-64 overflow-y-auto p-1" align="start">
        <div className="flex flex-col gap-0.5">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted transition-colors",
                opt === value && "bg-muted"
              )}
            >
              {renderOption(opt)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Badge + the start of the type's name (truncated) — used wherever a rule's target type is shown. */
function DisplayTypeChip({ type }: { type: EventType | undefined }) {
  return type ? (
    <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-background px-2 py-1 text-xs text-foreground">
      <ItemBadge color={type.color}>{getIconEl(type.icon, 10, "#fff")}</ItemBadge>
      <span className="max-w-[72px] truncate">{type.label}</span>
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full bg-background px-2 py-1 text-xs text-destructive">
      <ItemBadge color="#ef4444"><AlertTriangle size={10} color="#fff" /></ItemBadge>
      Type manquant
    </span>
  );
}

export function RuleEditRow({ rule, onDuplicate, onDelete, dragProps, lockValue, lockDisplayType, lockedType }: {
  rule: Rule;
  onDuplicate?: () => void;
  /** Omit to make the row undeletable (e.g. the one fixed rule for a source). */
  onDelete?: () => void;
  dragProps?: DragProps;
  /** The match value (source / text pattern) is implied by context (e.g. "this source") — render it read-only instead of a dropdown/input. */
  lockValue?: boolean;
  /** The display type is implied by context (e.g. "this type's edit form") — render it as a plain badge instead of a dropdown. */
  lockDisplayType?: boolean;
  /**
   * Preview to use for the lockDisplayType badge instead of looking `rule.displayTypeId`
   * up in the store — needed when the rule targets a type that's being created and
   * hasn't been saved yet (its id doesn't resolve via getType until then), so the
   * caller passes its own in-progress form state instead.
   */
  lockedType?: EventType;
}) {
  const { updateRule } = useRuleStore();
  const { types, getType } = useEventTypeStore();
  const { connections } = useConnectionStore();

  const matchType = rule.matchType as EditableMatchType;
  const displayType = lockedType ?? getType(rule.displayTypeId);
  const connection = matchType === "source" ? connections.find((c) => c.id === rule.matchValue) : undefined;

  function patch(p: Partial<Rule>) {
    updateRule({ ...rule, ...p });
  }

  return (
    <div
      ref={dragProps?.ref}
      className={cn(
        "flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5 transition-colors",
        dragProps?.dragging && "opacity-50",
        dragProps?.over && "ring-2 ring-primary/50"
      )}
    >
      {dragProps && (
        <SimpleTooltip label="Réordonner">
          <button
            type="button"
            onPointerDown={dragProps.onHandlePointerDown}
            aria-label="Réordonner"
            className="shrink-0 -m-1.5 touch-none select-none p-1.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        </SimpleTooltip>
      )}

      {lockValue ? (
        matchType === "source" ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-background px-2 py-1 text-xs text-foreground">
            {connection
              ? <ItemBadge color={connection.color}>{connection.name.trim().charAt(0).toUpperCase()}</ItemBadge>
              : <ItemBadge color="#94a3b8">?</ItemBadge>}
            <span className="truncate">{connection?.name ?? "—"}</span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate rounded-full bg-background px-2.5 py-1 text-xs text-foreground">{rule.matchValue}</span>
        )
      ) : matchType === "source" ? (
        <RuleDropdown
          label="Source"
          value={rule.matchValue}
          options={connections.map((c) => c.id)}
          onChange={(id) => patch({ matchValue: id })}
          className="flex-1"
          renderTrigger={() => (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-background px-2 py-1 text-xs text-foreground">
              {connection
                ? <ItemBadge color={connection.color}>{connection.name.trim().charAt(0).toUpperCase()}</ItemBadge>
                : <ItemBadge color="#94a3b8">?</ItemBadge>}
              <span className="truncate">{connection?.name ?? "—"}</span>
            </span>
          )}
          renderOption={(id) => {
            const c = connections.find((x) => x.id === id);
            if (!c) return null;
            return <><ItemBadge color={c.color}>{c.name.trim().charAt(0).toUpperCase()}</ItemBadge><span className="truncate">{c.name}</span></>;
          }}
        />
      ) : (
        <input
          value={rule.matchValue}
          onChange={(e) => patch({ matchValue: e.target.value })}
          placeholder="texte"
          className={cn(
            "min-w-0 flex-1 rounded-full bg-background px-2.5 py-1 text-xs text-foreground outline-hidden",
            rule.matchValue && !isValidPattern(rule.matchValue) && "ring-1 ring-destructive"
          )}
        />
      )}

      <ArrowRight size={12} className="shrink-0 text-muted-foreground" />

      {lockDisplayType ? (
        <DisplayTypeChip type={displayType} />
      ) : (
        <RuleDropdown
          label="Type d'affichage"
          value={rule.displayTypeId}
          options={types.map((t) => t.id)}
          onChange={(id) => patch({ displayTypeId: id })}
          renderTrigger={() => <DisplayTypeChip type={displayType} />}
          renderOption={(id) => {
            const t = types.find((x) => x.id === id);
            if (!t) return null;
            return <><ItemBadge color={t.color}>{getIconEl(t.icon, 10, "#fff")}</ItemBadge><span className="truncate">{t.label}</span></>;
          }}
        />
      )}

      {onDuplicate && <IconButton icon={<Copy size={12} />} label="Dupliquer" onClick={onDuplicate} />}
      {onDelete && <DeleteButton onDelete={onDelete} />}
    </div>
  );
}

// ── Single-select: pick one display type — the source drawer's "which type applies here" control ──

export function DisplayTypeSelect({ value, onChange, className }: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { types, getType } = useEventTypeStore();
  const selected = getType(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs",
            "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <ItemBadge color={selected.color}>{getIconEl(selected.icon, 10, "#fff")}</ItemBadge>
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onChange(t.id); setOpen(false); }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted transition-colors",
                t.id === value && "bg-muted"
              )}
            >
              <ItemBadge color={t.color}>{getIconEl(t.icon, 10, "#fff")}</ItemBadge>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Multi-select: pick which sources are assigned to a display type — the type drawer's reverse view of the same rules ──

/** One connection's row — ensures its source rule exists (via useSourceRule) before showing/toggling its checked state. */
function SourceCheckOption({ connection, typeId }: { connection: Connection; typeId: string }) {
  const rule = useSourceRule(connection.id);
  const { updateRule } = useRuleStore();
  const { getDefaultType } = useEventTypeStore();
  if (!rule) return null;

  const checked = rule.displayTypeId === typeId;

  return (
    <button
      type="button"
      onClick={() => updateRule({ ...rule, displayTypeId: checked ? getDefaultType().id : typeId })}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted transition-colors"
    >
      <Check size={12} className={cn("shrink-0", checked ? "opacity-100" : "opacity-0")} />
      <ItemBadge color={connection.color}>{connection.name.trim().charAt(0).toUpperCase()}</ItemBadge>
      <span className="truncate">{connection.name}</span>
    </button>
  );
}

export function SourcesMultiSelect({ typeId }: { typeId: string }) {
  const [open, setOpen] = useState(false);
  const { rules } = useRuleStore();
  const { connections } = useConnectionStore();

  const selectedNames = connections
    .filter((c) => rules.find((r) => r.matchType === "source" && r.matchValue === c.id)?.displayTypeId === typeId)
    .map((c) => c.name);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className={cn("truncate", selectedNames.length === 0 && "text-muted-foreground")}>
            {selectedNames.length === 0 ? "Aucune source" : selectedNames.join(", ")}
          </span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {connections.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Aucune source.</p>}
          {connections.map((c) => <SourceCheckOption key={c.id} connection={c} typeId={typeId} />)}
        </div>
      </PopoverContent>
    </Popover>
  );
}
