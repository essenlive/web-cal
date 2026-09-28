"use client";

import { AlertTriangle } from "lucide-react";
import { ItemBadge } from "../components/sidebar/ItemRow";
import { DrawerItemRow, AddItemButton } from "../components/settings/DrawerItemRow";
import { AiRulesImport } from "../components/settings/AiRulesImport";
import { RuleEditRow, useSourceRule } from "../components/settings/RuleEditRow";
import { useFilteredRuleDragReorder } from "../components/settings/EventTypeModal";
import { PanelHeader, InlineLink } from "../components/settings/PanelHeader";
import { useUIStore, useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../store";
import { getIconEl } from "../lib/icons";
import { describeMatch } from "../lib/rules";

/** Ensures a connection's fixed source rule exists — auto-created if missing. Renders nothing; the row itself is rendered from the merged `rules` list once created. Also mounted by StatsPage, which reads `rules` without ever opening this drawer. */
export function EnsureSourceRule({ connectionId }: { connectionId: string }) {
  useSourceRule(connectionId);
  return null;
}

/**
 * Rules manager — rendered as drawer content from the sidebar's flat "Règles"
 * button. Source and text rules render as a single list in true priority
 * order (array order), freely reorderable across type — a source rule can
 * outrank a text rule or vice versa. Source rules stay undeletable (one per
 * connection, auto-created) and their value locked to that connection; text
 * rules are freely addable/deletable/editable. Legacy "event" rules (the old
 * "just this event" quick action, now retired) still render, read-only,
 * under "Autres" if any remain from before that feature was retired.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for prop-shape parity with SettingsDrawer's generic openDrawer(panel, editId)/openNewItemDrawer(panel) call; there's no deep-link edit view to jump to anymore.
export function RulesPanel(_props: { initialEditRuleId?: string; openCreate?: boolean } = {}) {
  const { openDrawer } = useUIStore();
  const { rules, addRule, removeRule, reorderRule } = useRuleStore();
  const { getType, getDefaultType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  // Priority order is array order — filtering preserves it, so this is already sorted.
  const orderedRules = rules.filter((r) => r.matchType === "name" || r.matchType === "source");
  const legacyRules = rules.filter((r) => r.matchType === "event");
  const { getDragProps } = useFilteredRuleDragReorder(rules, orderedRules, reorderRule);
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
            s&apos;appliquent par ordre de priorité, de haut en bas — glissez une règle pour changer sa priorité,
            source comme texte. Si aucune règle ne s&apos;applique, le style par
            défaut est actuellement —{" "}
            <InlineLink onClick={() => openDrawer("eventType", defaultType.id)}>{defaultType.label}</InlineLink>.
          </>
        }
      />

      {connections.map((c) => <EnsureSourceRule key={c.id} connectionId={c.id} />)}

      <div className="space-y-4 px-4 pb-4">
        <div className="space-y-1.5">
          {orderedRules.map((rule, index) => {
            const duplicate =
              rule.matchType === "name"
                ? () => addRule({ matchType: rule.matchType, matchValue: rule.matchValue, displayTypeId: rule.displayTypeId, enabled: rule.enabled })
                : undefined;
            return (
              <RuleEditRow
                key={rule.id}
                rule={rule}
                onDuplicate={duplicate}
                onDelete={rule.matchType === "name" ? () => removeRule(rule.id) : undefined}
                dragProps={getDragProps(index)}
                lockValue={rule.matchType === "source"}
              />
            );
          })}
          <AddItemButton
            label="Nouvelle règle de texte"
            onClick={() => addRule({ matchType: "name", matchValue: "", displayTypeId: defaultType.id })}
          />
          <AiRulesImport />
        </div>

        {legacyRules.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1.5">Autres</h3>
            <div className="space-y-1.5">
              {legacyRules.map((rule) => (
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
                      Événement
                    </span>
                  }
                  onDelete={() => removeRule(rule.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
