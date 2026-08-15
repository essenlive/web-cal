"use client";

import { AlertTriangle } from "lucide-react";
import { ItemBadge } from "../components/sidebar/ItemRow";
import { DrawerItemRow, AddItemButton } from "../components/settings/DrawerItemRow";
import { RuleEditRow } from "../components/settings/RuleEditRow";
import { PanelHeader, InlineLink } from "../components/settings/PanelHeader";
import { useUIStore, useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../store";
import { useDragReorder } from "../hooks/useDragReorder";
import { getIconEl } from "../lib/icons";
import { describeMatch } from "../lib/rules";
import type { RuleMatchType } from "../types";

const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  event: "Événement",
  name: "Texte",
  source: "Source",
  all: "Défaut",
};

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
        {visibleRules.map((rule, index) => {
          const duplicate = () =>
            addRule({ matchType: rule.matchType, matchValue: rule.matchValue, displayTypeId: rule.displayTypeId, enabled: rule.enabled });
          return rule.matchType === "source" || rule.matchType === "name" ? (
            <RuleEditRow key={rule.id} rule={rule} onDuplicate={duplicate} onDelete={() => removeRule(rule.id)} dragProps={getDragProps(index)} />
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
              onDuplicate={duplicate}
              onDelete={() => removeRule(rule.id)}
              dragProps={getDragProps(index)}
            />
          );
        })}
        <AddItemButton
          label="Nouvelle règle"
          onClick={() => addRule({ matchType: "name", matchValue: "", displayTypeId: defaultType.id })}
        />
      </div>
    </>
  );
}
