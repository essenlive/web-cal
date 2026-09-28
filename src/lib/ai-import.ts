/**
 * Parses the JSON produced by the "prompt autonome" (see docs/ai-rules-prompt.md
 * and its schema, docs/ai-rules-schema.json) — a set of display types + matching
 * rules drafted by an AI from the user's own calendar sources/events. Uses the
 * same envelope as web-cal's settings export/import (see lib/settings-export.ts:
 * `{ version, exportedAt, data: { "overcal:event-types": {...}, "overcal:rules": {...} } }`),
 * restricted to those two keys, so the AI's output is schema-checkable against a
 * shape web-cal already knows how to read.
 *
 * Deliberately permissive on the *content* of each field: a malformed value
 * degrades to a sane default with a warning rather than rejecting the whole
 * import, since the JSON comes from an LLM's free-form output. The envelope
 * shape itself (the two keys, `state.types`/`state.rules`) is checked strictly —
 * that part is exactly what the schema documents, so a mismatch there means the
 * AI didn't follow the prompt at all.
 */
import type { Connection, DisplayStyle, RuleMatchType } from "../types";
import { isValidPattern } from "./rules";
import { ALL_ICON_NAMES } from "./icons";

export const DISPLAY_STYLES: DisplayStyle[] = [
  "text", "avatar-tr", "avatar-bl", "avatar-br", "block", "background", "border-top", "border-bottom",
];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#3b82f6";
const DEFAULT_ICON = "Calendar";
const ICON_NAMES_LOWER = new Set(ALL_ICON_NAMES.map((n) => n.toLowerCase()));

export interface ParsedAiEventType {
  /** The AI's own kebab-case id, used only to resolve `rules[].displayTypeId` below — never persisted as-is if it collides with an existing type id. */
  originalId: string;
  label: string;
  color: string;
  icon: string;
  badgeLetter: boolean;
  allDayStyle: DisplayStyle;
  timedStyle: DisplayStyle;
}

export interface ParsedAiRule {
  matchType: RuleMatchType;
  matchValue: string;
  originalDisplayTypeId: string;
  enabled: boolean;
}

export interface ParsedAiImport {
  eventTypes: ParsedAiEventType[];
  rules: ParsedAiRule[];
  warnings: string[];
}

function resolveIconName(raw: unknown, warnings: string[], context: string): string {
  const name = typeof raw === "string" ? raw : "";
  const canonical = ALL_ICON_NAMES.find((n) => n.toLowerCase() === name.toLowerCase());
  if (canonical) return canonical;
  if (name && !ICON_NAMES_LOWER.has(name.toLowerCase())) {
    warnings.push(`${context} : icône "${name}" inconnue, remplacée par "${DEFAULT_ICON}".`);
  }
  return DEFAULT_ICON;
}

function resolveColor(raw: unknown, warnings: string[], context: string): string {
  if (typeof raw === "string" && HEX_COLOR.test(raw)) return raw;
  warnings.push(`${context} : couleur "${String(raw)}" invalide, remplacée par ${DEFAULT_COLOR}.`);
  return DEFAULT_COLOR;
}

function resolveStyle(raw: unknown, warnings: string[], context: string): DisplayStyle {
  if (typeof raw === "string" && (DISPLAY_STYLES as string[]).includes(raw)) return raw as DisplayStyle;
  warnings.push(`${context} : style "${String(raw)}" invalide, remplacé par "block".`);
  return "block";
}

/**
 * Parses and validates the AI's raw JSON output. Returns `{ error }` for
 * envelope-shape failures (not JSON, wrong top-level keys, missing
 * `state.types`/`state.rules` arrays — i.e. it isn't the schema's shape at
 * all) — everything else degrades field by field into `warnings`.
 */
export function parseAiImport(
  raw: string,
  connections: Connection[],
  existingTypeIds: ReadonlySet<string>,
): ParsedAiImport | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "JSON invalide — vérifie que le texte collé est bien le bloc JSON complet renvoyé par l'IA." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { error: "Le JSON doit être un objet — voir docs/ai-rules-schema.json." };
  }
  const envelope = parsed as Record<string, unknown>;
  if (envelope.version !== 1 || typeof envelope.data !== "object" || envelope.data === null) {
    return { error: "Ce n'est pas l'enveloppe attendue ({ version: 1, exportedAt, data: {...} }) — voir docs/ai-rules-schema.json." };
  }
  const data = envelope.data as Record<string, unknown>;

  const typesEntry = data["overcal:event-types"] as Record<string, unknown> | undefined;
  const rulesEntry = data["overcal:rules"] as Record<string, unknown> | undefined;
  const rawTypes = (typesEntry?.state as Record<string, unknown> | undefined)?.types;
  const rawRules = (rulesEntry?.state as Record<string, unknown> | undefined)?.rules;
  if (typesEntry !== undefined && !Array.isArray(rawTypes)) {
    return { error: "data[\"overcal:event-types\"].state.types doit être un tableau — voir docs/ai-rules-schema.json." };
  }
  if (rulesEntry !== undefined && !Array.isArray(rawRules)) {
    return { error: "data[\"overcal:rules\"].state.rules doit être un tableau — voir docs/ai-rules-schema.json." };
  }
  if (!Array.isArray(rawTypes) && !Array.isArray(rawRules)) {
    return { error: "Le JSON ne contient ni \"overcal:event-types\" ni \"overcal:rules\" — rien à importer." };
  }

  const warnings: string[] = [];
  const knownConnectionIds = new Set(connections.map((c) => c.id));
  const seenTypeIds = new Set<string>();

  const eventTypes: ParsedAiEventType[] = [];
  for (const [index, entry] of (Array.isArray(rawTypes) ? (rawTypes as unknown[]) : []).entries()) {
    const t = entry as Record<string, unknown>;
    const context = `Type #${index + 1}`;
    const label = typeof t.label === "string" && t.label.trim() ? t.label.trim() : `Type ${index + 1}`;
    let originalId = typeof t.id === "string" && t.id.trim() ? t.id.trim() : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    // The export hands the AI the user's current types; re-listing one means "reuse it",
    // never "overwrite it" — rules may still point at it below.
    if (existingTypeIds.has(originalId)) {
      warnings.push(`${context} : "${label}" existe déjà (id "${originalId}"), conservé tel quel.`);
      continue;
    }
    if (seenTypeIds.has(originalId)) {
      warnings.push(`${context} : id "${originalId}" dupliqué, un suffixe a été ajouté.`);
      originalId = `${originalId}-${index}`;
    }
    seenTypeIds.add(originalId);
    eventTypes.push({
      originalId,
      label,
      color: resolveColor(t.color, warnings, context),
      icon: resolveIconName(t.icon, warnings, context),
      badgeLetter: t.badgeLetter === true,
      allDayStyle: resolveStyle(t.allDayStyle, warnings, `${context} (all-day)`),
      timedStyle: resolveStyle(t.timedStyle, warnings, `${context} (horaire)`),
    });
  }

  const rules: ParsedAiRule[] = [];
  for (const [index, entry] of (Array.isArray(rawRules) ? (rawRules as unknown[]) : []).entries()) {
    const r = entry as Record<string, unknown>;
    const context = `Règle #${index + 1}`;
    const matchType = r.matchType;
    if (matchType !== "name" && matchType !== "source") {
      warnings.push(`${context} : type de correspondance "${String(matchType)}" ignoré (seuls "name" et "source" sont importés).`);
      continue;
    }
    const matchValue = typeof r.matchValue === "string" ? r.matchValue : "";
    if (matchType === "name") {
      if (!matchValue || !isValidPattern(matchValue)) {
        warnings.push(`${context} : motif "${matchValue}" invalide, règle ignorée.`);
        continue;
      }
    } else if (!knownConnectionIds.has(matchValue)) {
      warnings.push(`${context} : source "${matchValue}" introuvable parmi les connexions actuelles, règle ignorée.`);
      continue;
    }
    const originalDisplayTypeId = typeof r.displayTypeId === "string" ? r.displayTypeId : "";
    if (!seenTypeIds.has(originalDisplayTypeId) && !existingTypeIds.has(originalDisplayTypeId)) {
      warnings.push(`${context} : type d'affichage "${originalDisplayTypeId}" introuvable (ni nouveau, ni existant), règle ignorée.`);
      continue;
    }
    rules.push({ matchType, matchValue, originalDisplayTypeId, enabled: r.enabled !== false });
  }

  return { eventTypes, rules, warnings };
}
