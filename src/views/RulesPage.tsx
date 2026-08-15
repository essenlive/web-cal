"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CaseSensitive, ChevronDown, GripVertical, Link2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { ItemBadge } from "../components/sidebar/ItemRow";
import type { DragProps } from "../components/sidebar/Sidebar";
import { DrawerItemRow, AddItemButton, DeleteButton } from "../components/settings/DrawerItemRow";
import { PanelHeader, InlineLink } from "../components/settings/PanelHeader";
import { useUIStore, useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../store";
import { useDragReorder } from "../hooks/useDragReorder";
import { getIconEl } from "../components/settings/EventTypeModal";
import { describeMatch, isValidPattern } from "../lib/rules";
import type { Rule, RuleMatchType } from "../types";

const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  event: "Événement",
  name: "Texte",
  source: "Source",
  all: "Défaut",
};

/** The two match types creatable/editable from the new inline row — "event" (legacy, retired) and "all" (catch-all) are not. */
type EditableMatchType = "source" | "name";

const MATCH_TYPE_ICON: Record<EditableMatchType, { icon: ReactNode; label: string }> = {
  source: { icon: <Link2 size={11} />, label: "Source" },
  name: { icon: <CaseSensitive size={11} />, label: "Texte" },
};

// ── Generic small dropdown, used for the match-type / source / display-type pickers ────

function RuleDropdown<T extends string>({ value, options, onChange, renderTrigger, renderOption, className, label }: {
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

// ── Inline-editable row for "source"/"name" rules ───────────────────────────────

function RuleEditRow({ rule, onDelete, dragProps }: { rule: Rule; onDelete: () => void; dragProps?: DragProps }) {
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
    <div {...dragProps} className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5">
      <GripVertical size={14} className="shrink-0 text-muted-foreground/40 cursor-grab" />

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

      {matchType === "source" ? (
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

      <DeleteButton onDelete={onDelete} />
    </div>
  );
}

/**
 * Rules manager — rendered as drawer content from the sidebar's flat "Règles"
 * button. Every row is inline-editable (three dropdowns + a value editor,
 * committing immediately via updateRule) — no more separate edit form. The
 * catch-all rule (matchType "all") is never shown as a row — it's not
 * user-manageable, just referenced in the description via the current default
 * type. Legacy "event" rules (the old "just this event" quick action, now
 * retired) still render, read-only, via DrawerItemRow so they stay visible
 * and deletable without pretending to support inline editing they can't do.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for prop-shape parity with SettingsDrawer's generic openDrawer(panel, editId)/openNewItemDrawer(panel) call; there's no deep-link edit view to jump to anymore.
export function RulesPanel(_props: { initialEditRuleId?: string; openCreate?: boolean } = {}) {
  const { openDrawer } = useUIStore();
  const { rules, addRule, removeRule, reorderRule } = useRuleStore();
  const { getType, getDefaultType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const visibleRules = rules.filter((r) => r.matchType !== "all");
  const { getDragProps } = useDragReorder(visibleRules, (r) => r.id, reorderRule);
  const defaultType = getDefaultType();

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

  return (
    <>
      <PanelHeader
        title="Règles d'affichage"
        description={
          <>
            C&apos;est ici que l&apos;on définit les règles qui déterminent quel{" "}
            <InlineLink onClick={() => openDrawer("eventType")}>type</InlineLink>{" "}
            d&apos;affichage chaque événement doit utiliser. Les règles peuvent s&apos;appliquer à une source ou à un texte dans le titre. Elles
            s&apos;appliquent par ordre de priorité, de haut en bas. Si aucune règle ne s&apos;applique, le style par
            défaut est actuellement —{" "}
            <InlineLink onClick={() => openDrawer("eventType", defaultType.id)}>{defaultType.label}</InlineLink>.
          </>
        }
      />

      <div className="space-y-1.5 px-4 pb-4">
        {visibleRules.map((rule, index) =>
          rule.matchType === "source" || rule.matchType === "name" ? (
            <RuleEditRow key={rule.id} rule={rule} onDelete={() => removeRule(rule.id)} dragProps={getDragProps(index)} />
          ) : (
            <DrawerItemRow
              key={rule.id}
              badge={
                getType(rule.displayTypeId)
                  ? <ItemBadge color={getType(rule.displayTypeId)!.color}>{getIconEl(getType(rule.displayTypeId)!.icon, 10, "#fff")}</ItemBadge>
                  : <ItemBadge color="#ef4444"><AlertTriangle size={10} color="#fff" /></ItemBadge>
              }
              name={describeMatch(rule, getEventTitle, getConnectionName)}
              tag={
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {MATCH_TYPE_LABELS[rule.matchType]}
                </span>
              }
              onDelete={() => removeRule(rule.id)}
              dragProps={getDragProps(index)}
            />
          )
        )}
        <AddItemButton
          label="Nouvelle règle"
          onClick={() => addRule({ matchType: "name", matchValue: "", displayTypeId: defaultType.id })}
        />
      </div>
    </>
  );
}
