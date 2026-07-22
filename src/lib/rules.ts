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

/** Whether `event` matches `rule`, per its matchType. The catch-all ("all") always matches. */
export function matchesRule(event: CalendarEvent, rule: Rule): boolean {
  switch (rule.matchType) {
    case "event":
      return event.id === rule.matchValue;
    case "source":
      return event.calendarId === rule.matchValue;
    case "name":
      try {
        return new RegExp(rule.matchValue, "i").test(event.title);
      } catch {
        return false;
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
  if (rule.matchType === "event") return getEventTitle(rule.matchValue) ?? `Event ${rule.matchValue}`;
  if (rule.matchType === "source") return getConnectionName(rule.matchValue) ?? `Source ${rule.matchValue}`;
  if (rule.matchType === "all") return "Any event (default)";
  return rule.matchValue;
}
