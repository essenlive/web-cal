import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../../store";
import { describeMatch, findMatchingRule } from "../../lib/rules";

export function SanityPanel() {
  const { rules } = useRuleStore();
  const { getType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

  const brokenRules = rules.filter((r) => !getType(r.displayTypeId));

  const deadRules = useMemo(() => {
    const hit = new Set(events.map((e) => findMatchingRule(e, rules).id));
    return rules.filter((r) => r.enabled && r.matchType !== "all" && !hit.has(r.id));
  }, [events, rules]);

  if (brokenRules.length === 0 && deadRules.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 size={14} className="text-green-500" />
        Aucun problème détecté.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 text-xs">
      {brokenRules.map((r) => (
        <li key={r.id} className="flex items-start gap-1.5 text-amber-600 dark:text-amber-500">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Règle « {describeMatch(r, getEventTitle, getConnectionName)} » cible un type supprimé — repli sur le type par défaut.
          </span>
        </li>
      ))}
      {deadRules.map((r) => (
        <li key={r.id} className="flex items-start gap-1.5 text-muted-foreground">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Règle « {describeMatch(r, getEventTitle, getConnectionName)} » ne correspond à aucun événement chargé.
          </span>
        </li>
      ))}
    </ul>
  );
}
