"use client";

/**
 * RuleEditRow — inline-editable row for a "source"/"name" rule: match-type
 * dropdown, value editor (connection dropdown or text pill), an arrow, and a
 * display-type dropdown, all committing immediately via updateRule. Shared by
 * the main rules drawer (RulesPage.tsx, everything editable) and the
 * "rules for this item" sections embedded in EventTypeModal (`lockDisplayType`
 * — the target type is implied by which form you're in) and AddConnectionModal
 * (`lockMatch` — the match is implied to be "this source").
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CaseSensitive, ChevronDown, GripVertical, Link2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, SimpleTooltip } from "../ui/tooltip";
import { ItemBadge } from "../sidebar/ItemRow";
import type { DragProps } from "../sidebar/Sidebar";
import { DeleteButton } from "./DrawerItemRow";
import { useRuleStore, useEventTypeStore, useConnectionStore } from "../../store";
import { getIconEl } from "../../lib/icons";
import { isValidPattern } from "../../lib/rules";
import type { Rule } from "../../types";

/** The two match types creatable/editable inline — "event" (legacy, retired) and "all" (catch-all) are not. */
export type EditableMatchType = "source" | "name";

export const MATCH_TYPE_ICON: Record<EditableMatchType, { icon: ReactNode; label: string }> = {
  source: { icon: <Link2 size={11} />, label: "Source" },
  name: { icon: <CaseSensitive size={11} />, label: "Texte" },
};

// ── Generic small dropdown, used for the match-type / source / display-type pickers ────

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

export function RuleEditRow({ rule, onDelete, dragProps, lockMatch, lockDisplayType }: {
  rule: Rule;
  onDelete: () => void;
  dragProps?: DragProps;
  /** The match (type + value) is implied by context (e.g. "this source") — render it read-only instead of a dropdown/input. */
  lockMatch?: boolean;
  /** The display type is implied by context (e.g. "this type's edit form") — render it as a plain badge instead of a dropdown. */
  lockDisplayType?: boolean;
}) {
  const { updateRule } = useRuleStore();
  const { types, getType } = useEventTypeStore();
  const { connections } = useConnectionStore();

  const matchType = rule.matchType as EditableMatchType;
  const displayType = getType(rule.displayTypeId);
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

      {lockMatch ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
          {MATCH_TYPE_ICON[matchType].icon}
        </span>
      ) : (
        <RuleDropdown
          label="Type de correspondance"
          value={matchType}
          options={["source", "name"] as const}
          onChange={(mt) => patch({ matchType: mt, matchValue: "" })}
          renderTrigger={(mt) => (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
              {MATCH_TYPE_ICON[mt].icon}
            </span>
          )}
          renderOption={(mt) => <><span className="text-muted-foreground">{MATCH_TYPE_ICON[mt].icon}</span>{MATCH_TYPE_ICON[mt].label}</>}
        />
      )}

      {lockMatch ? (
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
        displayType
          ? <ItemBadge color={displayType.color}>{getIconEl(displayType.icon, 10, "#fff")}</ItemBadge>
          : <ItemBadge color="#ef4444"><AlertTriangle size={10} color="#fff" /></ItemBadge>
      ) : (
        <RuleDropdown
          label="Type d'affichage"
          value={rule.displayTypeId}
          options={types.map((t) => t.id)}
          onChange={(id) => patch({ displayTypeId: id })}
          renderTrigger={() =>
            displayType
              ? <ItemBadge color={displayType.color}>{getIconEl(displayType.icon, 10, "#fff")}</ItemBadge>
              : <ItemBadge color="#ef4444"><AlertTriangle size={10} color="#fff" /></ItemBadge>
          }
          renderOption={(id) => {
            const t = types.find((x) => x.id === id);
            if (!t) return null;
            return <><ItemBadge color={t.color}>{getIconEl(t.icon, 10, "#fff")}</ItemBadge><span className="truncate">{t.label}</span></>;
          }}
        />
      )}

      <DeleteButton onDelete={onDelete} />
    </div>
  );
}
