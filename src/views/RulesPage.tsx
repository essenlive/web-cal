"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ItemBadge } from "../components/sidebar/ItemRow";
import { DrawerItemRow, AddItemButton } from "../components/settings/DrawerItemRow";
import { PanelHeader, InlineLink } from "../components/settings/PanelHeader";
import { useUIStore, useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../store";
import { useDragReorder } from "../hooks/useDragReorder";
import { getIconEl } from "../components/settings/EventTypeModal";
import { RuleModal } from "../components/settings/RuleModal";
import { describeMatch } from "../lib/rules";
import type { Rule } from "../types";

const MATCH_TYPE_LABELS: Record<Rule["matchType"], string> = {
  event: "Événement",
  name: "Texte",
  source: "Source",
  all: "Défaut",
};

/**
 * Rules manager — rendered as drawer content from the sidebar, beneath the
 * display types list. The catch-all rule (matchType "all") is never shown as
 * a row — it's not user-manageable, just referenced in the description via
 * the current default type.
 */
export function RulesPanel({ initialEditRuleId, openCreate }: { initialEditRuleId?: string; openCreate?: boolean } = {}) {
  const { openDrawer } = useUIStore();
  const { rules, removeRule, reorderRule } = useRuleStore();
  const { getType, getDefaultType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const visibleRules = rules.filter((r) => r.matchType !== "all");
  const { getDragProps } = useDragReorder(visibleRules, (r) => r.id, reorderRule);
  const defaultType = getDefaultType();

  const initialRule = initialEditRuleId ? rules.find((r) => r.id === initialEditRuleId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialRule || !!openCreate);
  const [editingRule, setEditingRule] = useState<Rule | null>(initialRule);

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

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
        {visibleRules.map((rule, index) => {
          const displayType = getType(rule.displayTypeId);
          const broken = !displayType;
          return (
            <DrawerItemRow
              key={rule.id}
              badge={
                broken
                  ? <ItemBadge color="#ef4444"><AlertTriangle size={10} color="#fff" /></ItemBadge>
                  : <ItemBadge color={displayType.color}>{getIconEl(displayType.icon, 10, "#fff")}</ItemBadge>
              }
              name={describeMatch(rule, getEventTitle, getConnectionName)}
              tag={
                <span
                  title={broken ? "Le type d'affichage n'existe plus" : undefined}
                  className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {MATCH_TYPE_LABELS[rule.matchType]}
                </span>
              }
              onEdit={() => { setEditingRule(rule); setFormOpen(true); }}
              onDelete={() => removeRule(rule.id)}
              dragProps={getDragProps(index)}
            />
          );
        })}
        <AddItemButton label="Nouvelle règle" onClick={() => { setEditingRule(null); setFormOpen(true); }} />
      </div>
    </>
  );
}
