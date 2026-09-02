import { useMemo } from "react";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../../store";
import { describeMatch, findMatchingRule } from "../../lib/rules";
import type { Rule } from "../../types";

const MATCH_TYPE_LABEL: Record<Rule["matchType"], string> = {
  event: "Événement", name: "Texte", source: "Source", all: "Toutes (défaut)",
};

export function RulesPanel() {
  const { rules } = useRuleStore();
  const { getType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

  // Per-event resolution now lives in the merged events table (EventsPanel) — this
  // hit-count is the only thing here that still needs the first-match-wins walk.
  const hitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const rule = findMatchingRule(e, rules);
      counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1);
    }
    return counts;
  }, [events, rules]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:py-2">
            <th>Priorité</th>
            <th>Type</th>
            <th>Cible</th>
            <th>Style appliqué</th>
            <th>Activée</th>
            <th>Événements correspondants</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rules.map((rule, i) => {
            const type = getType(rule.displayTypeId);
            return (
              <tr key={rule.id} className={!rule.enabled ? "opacity-50" : undefined}>
                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{MATCH_TYPE_LABEL[rule.matchType]}</td>
                <td className="px-3 py-1.5 text-foreground">{describeMatch(rule, getEventTitle, getConnectionName)}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{type?.label ?? "— (type supprimé)"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{rule.enabled ? "Oui" : "Non"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{hitCounts.get(rule.id) ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
