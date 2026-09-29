import { useMemo, useState } from "react";
import { cn, NATIVE_SELECT } from "../../lib/utils";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../../store";
import { describeMatch, findMatchingRule } from "../../lib/rules";
import { SortHeader, ColorDot, type SortDir } from "./table";
import { CopySnapshotButton } from "./CopySnapshotButton";
import type { EventType, Rule } from "../../types";

const MATCH_TYPE_LABEL: Record<Rule["matchType"], string> = {
  event: "Événement", name: "Texte", source: "Source", all: "Toutes (défaut)",
};

type RuleState = "ok" | "dead" | "broken";

const STATE_LABEL: Record<RuleState, string> = {
  ok: "OK", dead: "Inactive (0 événement)", broken: "Type supprimé",
};
const STATE_TEXT_COLOR: Record<RuleState, string> = {
  ok: "text-green-600 dark:text-green-500",
  dead: "text-amber-600 dark:text-amber-500",
  broken: "text-red-600 dark:text-red-500",
};
const STATE_BORDER_COLOR: Record<RuleState, string> = {
  ok: "border-l-transparent",
  dead: "border-l-amber-500",
  broken: "border-l-red-500",
};

interface Row {
  rule: Rule;
  priority: number;
  target: string;
  type?: EventType;
  hitCount: number;
  state: RuleState;
}

type SortKey = "priority" | "matchType" | "target" | "type" | "enabled" | "hits" | "state";

function compareRows(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "priority": return a.priority - b.priority;
    case "matchType": return a.rule.matchType.localeCompare(b.rule.matchType);
    case "target": return a.target.localeCompare(b.target);
    case "type": return (a.type?.label ?? "").localeCompare(b.type?.label ?? "");
    case "enabled": return Number(a.rule.enabled) - Number(b.rule.enabled);
    case "hits": return a.hitCount - b.hitCount;
    case "state": return a.state.localeCompare(b.state);
  }
}

export function RulesPanel() {
  const { rules } = useRuleStore();
  const { getType } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const [search, setSearch] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState<"all" | Rule["matchType"]>("all");
  const [stateFilter, setStateFilter] = useState<"all" | RuleState>("all");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "on" | "off">("all");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

  const rows = useMemo<Row[]>(() => {
    const hitCounts = new Map<string, number>();
    for (const e of events) {
      const matched = findMatchingRule(e, rules);
      hitCounts.set(matched.id, (hitCounts.get(matched.id) ?? 0) + 1);
    }
    return rules.map((rule, i) => {
      const type = getType(rule.displayTypeId);
      const hitCount = hitCounts.get(rule.id) ?? 0;
      const broken = !type;
      const dead = rule.enabled && rule.matchType !== "all" && hitCount === 0;
      const state: RuleState = broken ? "broken" : dead ? "dead" : "ok";
      return { rule, priority: i + 1, target: describeMatch(rule, getEventTitle, getConnectionName), type, hitCount, state };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, events, getType, connections]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.target.toLowerCase().includes(q) || (r.type?.label.toLowerCase().includes(q) ?? false))
      .filter((r) => matchTypeFilter === "all" || r.rule.matchType === matchTypeFilter)
      .filter((r) => stateFilter === "all" || r.state === stateFilter)
      .filter((r) => enabledFilter === "all" || (enabledFilter === "on") === r.rule.enabled)
      .sort((a, b) => (sortDir === "asc" ? 1 : -1) * compareRows(a, b, sortKey));
  }, [rows, search, matchTypeFilter, stateFilter, enabledFilter, sortKey, sortDir]);

  const snapshotData = useMemo(() => ({
    rules: rows.map((r) => ({
      priority: r.priority,
      matchType: r.rule.matchType,
      target: r.target,
      enabled: r.rule.enabled,
      displayType: r.type?.label ?? null,
      matchingEventCount: r.hitCount,
      state: r.state,
    })),
  }), [rows]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par cible ou type…"
          className="w-56 max-w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
        <select value={matchTypeFilter} onChange={(e) => setMatchTypeFilter(e.target.value as typeof matchTypeFilter)} className={NATIVE_SELECT}>
          <option value="all">Tous les types</option>
          {(Object.keys(MATCH_TYPE_LABEL) as Rule["matchType"][]).map((t) => <option key={t} value={t}>{MATCH_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)} className={NATIVE_SELECT}>
          <option value="all">État : tous</option>
          <option value="ok">OK</option>
          <option value="dead">Inactive</option>
          <option value="broken">Type supprimé</option>
        </select>
        <select value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value as typeof enabledFilter)} className={NATIVE_SELECT}>
          <option value="all">Activée : toutes</option>
          <option value="on">Oui</option>
          <option value="off">Non</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{filtered.length} / {rules.length} règles</span>
        <CopySnapshotButton
          context="web-cal debug snapshot — onglet Règles. Les règles sont évaluées dans l'ordre (priority = ordre d'évaluation, 1 = en premier) ; la première règle activée qui correspond à un événement détermine son type d'affichage — il y a toujours une règle 'catch-all' (matchType 'all') en dernier qui correspond à tout. 'matchingEventCount' est le nombre d'événements actuellement chargés dont CETTE règle est la première correspondance. 'state' vaut ok | dead (activée mais 0 événement correspondant actuellement) | broken (le type d'affichage ciblé a été supprimé ; l'app retombe alors sur le type par défaut)."
          data={snapshotData}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <SortHeader label="Priorité" sortKey="priority" active={sortKey === "priority"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Type" sortKey="matchType" active={sortKey === "matchType"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Cible" sortKey="target" active={sortKey === "target"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Style appliqué" sortKey="type" active={sortKey === "type"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Activée" sortKey="enabled" active={sortKey === "enabled"} dir={sortDir} onSort={onSort} />
              <SortHeader label="Événements correspondants" sortKey="hits" active={sortKey === "hits"} dir={sortDir} onSort={onSort} />
              <SortHeader label="État" sortKey="state" active={sortKey === "state"} dir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.rule.id} className={cn("border-l-2", STATE_BORDER_COLOR[r.state], !r.rule.enabled && "opacity-50")}>
                <td className="px-3 py-1.5 text-muted-foreground">{r.priority}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{MATCH_TYPE_LABEL[r.rule.matchType]}</td>
                <td className="px-3 py-1.5 text-foreground">{r.target}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {r.type ? <><ColorDot color={r.type.color} />{r.type.label}</> : "— (type supprimé)"}
                  </span>
                </td>
                <td className={cn("px-3 py-1.5", r.rule.enabled ? "text-green-600 dark:text-green-500" : "text-muted-foreground")}>
                  {r.rule.enabled ? "Oui" : "Non"}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.hitCount}</td>
                <td className={cn("px-3 py-1.5 font-medium", STATE_TEXT_COLOR[r.state])}>{STATE_LABEL[r.state]}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Aucune règle.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
