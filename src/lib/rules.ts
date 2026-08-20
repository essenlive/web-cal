import type { CalendarEvent, Rule } from "../types";

/** True if `pattern` is a syntactically valid RegExp. */
export function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern, "i");
    return true;
  } catch {
    return false;
  }
}

// Compiled RegExp cache for `name`-type rules, keyed by rule id — rebuilt (see
// compiledPatternFor below) only when a rule's id/matchValue pair isn't already
// cached, instead of re-parsing the same pattern on every matchesRule() call for
// every event on every render. See specs/008-events-perf-caching/research.md
// Decision F. Keyed by `${rule.id}:${rule.matchValue}` so an edited pattern (same
// id, new matchValue) recompiles instead of serving a stale RegExp.
const compiledPatternCache = new Map<string, RegExp | null>();

function compiledPatternFor(rule: Rule): RegExp | null {
  const cacheKey = `${rule.id}:${rule.matchValue}`;
  const cached = compiledPatternCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let compiled: RegExp | null;
  try {
    compiled = new RegExp(rule.matchValue, "i");
  } catch {
    compiled = null;
  }
  compiledPatternCache.set(cacheKey, compiled);
  return compiled;
}

/** Whether `event` matches `rule`, per its matchType. The catch-all ("all") always matches. */
export function matchesRule(event: CalendarEvent, rule: Rule): boolean {
  switch (rule.matchType) {
    case "event":
      return event.id === rule.matchValue;
    case "source":
      return event.calendarId === rule.matchValue;
    case "name": {
      if (!rule.matchValue) return false;
      const pattern = compiledPatternFor(rule);
      return pattern ? pattern.test(event.title) : false;
    }
    case "all":
      return true;
  }
}

/**
 * First enabled rule matching `event`, in priority order (array order). If its target
 * display type has since been deleted, the caller (see `resolveEventType`) falls back
 * to the default type rather than skipping to the next rule. Always returns a `Rule` —
 * the catch-all rule always matches and is always enabled, so there is always one to fall
 * back to.
 */
export function findMatchingRule(event: CalendarEvent, rules: Rule[]): Rule {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (matchesRule(event, rule)) return rule;
  }
  // Unreachable in practice — the catch-all rule always matches and is always enabled.
  return rules[rules.length - 1];
}

/** Human-readable description of what a rule matches, resolving event/source ids to their names. */
export function describeMatch(
  rule: Rule,
  getEventTitle: (id: string) => string | undefined,
  getConnectionName: (id: string) => string | undefined,
): string {
  if (rule.matchType === "event") return getEventTitle(rule.matchValue) ?? `Événement ${rule.matchValue}`;
  if (rule.matchType === "source") return getConnectionName(rule.matchValue) ?? `Source ${rule.matchValue}`;
  if (rule.matchType === "all") return "Tous les événements";
  return rule.matchValue;
}
