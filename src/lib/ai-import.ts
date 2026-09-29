/**
 * Parses the JSON produced by the "prompt autonome" (see docs/ai-rules-prompt.md
 * and its schema, docs/ai-rules-schema.json) — display types, matching rules,
 * presets and themes drafted by an AI from the user's own calendar sources/events.
 * Envelope: `{ version, exportedAt, data: { "overcal:event-types": {...}, "overcal:rules": {...}, ... } }`,
 * keyed like the stores' persisted localStorage blobs (`{ state: {...} }` per key), restricted
 * to those four keys, so the AI's output is schema-checkable against a documented shape. applyAiImport() below then merges it
 * into, or replaces, the matching stores.
 *
 * Deliberately permissive on the *content* of each field: a malformed value
 * degrades to a sane default with a warning rather than rejecting the whole
 * import, since the JSON comes from an LLM's free-form output. The envelope
 * shape itself (the four keys and their `state.*` arrays) is checked strictly —
 * that part is exactly what the schema documents, so a mismatch there means the
 * AI didn't follow the prompt at all.
 */
import type { Connection, DisplayStyle, Preset, Rule, RuleMatchType, Theme, ThemeMode, ThemePattern } from "../types";
import { isValidPattern } from "./rules";
import { ALL_ICON_NAMES } from "./icons";
import { GOOGLE_FONTS } from "./google-fonts";
import { BUILTIN_THEMES, THEME_PATTERNS, THEME_RADIUS_PRESETS } from "./theme";
import { useConnectionStore, useEventTypeStore, usePresetStore, useRuleStore, useThemeStore } from "../store";

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
  pattern?: ThemePattern;
}

export interface ParsedAiRule {
  matchType: RuleMatchType;
  matchValue: string;
  originalDisplayTypeId: string;
  enabled: boolean;
}

export interface ParsedAiTheme {
  /** The AI's own id, used only to resolve `presets[].themeId` — a fresh UUID is persisted instead. */
  originalId: string;
  name: string;
  mode: ThemeMode;
  accent: string;
  fontFamily?: string;
  radius?: string;
  pattern?: ThemePattern;
}

export interface ParsedAiPreset {
  name: string;
  description?: string;
  color?: string;
  /** Connection.id → hidden. */
  connections: Record<string, boolean>;
  /** AI or existing type id → hidden; resolved to persisted ids on apply. */
  eventTypes: Record<string, boolean>;
  /** AI or existing theme id. */
  originalThemeId?: string;
}

export type AiSection = "types" | "rules" | "presets" | "themes";

export interface ParsedAiImport {
  /** Which of the four keys the JSON contained — "replace" only touches these. */
  sections: AiSection[];
  eventTypes: ParsedAiEventType[];
  rules: ParsedAiRule[];
  presets: ParsedAiPreset[];
  themes: ParsedAiTheme[];
  /** Existing type/theme ids the AI re-listed as-is: "replace" keeps them. */
  reusedTypeIds: string[];
  reusedThemeIds: string[];
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

/** Lowercase kebab slug of a label — the id fallback when the AI omits one. */
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** `obj`'s boolean entries whose key passes `known`; the rest are reported once. */
function pickBooleans(raw: unknown, known: (id: string) => boolean, warnings: string[], context: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [id, hidden] of Object.entries(raw)) {
    if (typeof hidden === "boolean" && known(id)) out[id] = hidden;
    else warnings.push(`${context} : "${id}" inconnu, ignoré.`);
  }
  return out;
}

function resolvePattern(raw: unknown, warnings: string[], context: string): { pattern?: ThemePattern } {
  const pattern = THEME_PATTERNS.find((x) => x.value === raw)?.value;
  if (raw !== undefined && !pattern) warnings.push(`${context} : motif "${String(raw)}" inconnu, aucun motif.`);
  return pattern ? { pattern } : {};
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
  existingThemeIds: ReadonlySet<string> = new Set(),
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

  const arrays: Record<AiSection, [key: string, field: string]> = {
    types: ["overcal:event-types", "types"],
    rules: ["overcal:rules", "rules"],
    presets: ["overcal:presets", "presets"],
    themes: ["overcal:themes", "customThemes"],
  };
  const raws: Partial<Record<AiSection, unknown[]>> = {};
  for (const [section, [key, field]] of Object.entries(arrays) as [AiSection, [string, string]][]) {
    const entry = data[key] as Record<string, unknown> | undefined;
    if (entry === undefined) continue;
    const arr = (entry?.state as Record<string, unknown> | undefined)?.[field];
    if (!Array.isArray(arr)) {
      return { error: `data["${key}"].state.${field} doit être un tableau — voir docs/ai-rules-schema.json.` };
    }
    raws[section] = arr;
  }
  const sections = Object.keys(raws) as AiSection[];
  if (sections.length === 0) {
    return { error: "Le JSON ne contient aucune section (types, règles, presets, thèmes) — rien à importer." };
  }
  const rawTypes = raws.types ?? [];
  const rawRules = raws.rules ?? [];

  const warnings: string[] = [];
  const knownConnectionIds = new Set(connections.map((c) => c.id));
  const seenTypeIds = new Set<string>();
  const reusedTypeIds: string[] = [];

  const eventTypes: ParsedAiEventType[] = [];
  for (const [index, entry] of rawTypes.entries()) {
    const t = entry as Record<string, unknown>;
    const context = `Type #${index + 1}`;
    const label = typeof t.label === "string" && t.label.trim() ? t.label.trim() : `Type ${index + 1}`;
    let originalId = typeof t.id === "string" && t.id.trim() ? t.id.trim() : slug(label);
    // The export hands the AI the user's current types; re-listing one means "reuse it",
    // never "overwrite it" — rules may still point at it below.
    if (existingTypeIds.has(originalId)) {
      warnings.push(`${context} : "${label}" existe déjà (id "${originalId}"), conservé tel quel.`);
      reusedTypeIds.push(originalId);
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
      ...resolvePattern(t.pattern, warnings, context),
    });
  }

  const rules: ParsedAiRule[] = [];
  for (const [index, entry] of rawRules.entries()) {
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

  const themes: ParsedAiTheme[] = [];
  const seenThemeIds = new Set<string>();
  const reusedThemeIds: string[] = [];
  for (const [index, entry] of (raws.themes ?? []).entries()) {
    const t = entry as Record<string, unknown>;
    const context = `Thème #${index + 1}`;
    const name = typeof t.name === "string" && t.name.trim() ? t.name.trim() : `Thème ${index + 1}`;
    let originalId = typeof t.id === "string" && t.id.trim() ? t.id.trim() : slug(name);
    if (existingThemeIds.has(originalId)) {
      warnings.push(`${context} : "${name}" existe déjà (id "${originalId}"), conservé tel quel.`);
      reusedThemeIds.push(originalId);
      continue;
    }
    if (seenThemeIds.has(originalId)) {
      warnings.push(`${context} : id "${originalId}" dupliqué, un suffixe a été ajouté.`);
      originalId = `${originalId}-${index}`;
    }
    seenThemeIds.add(originalId);
    if (t.mode !== "light" && t.mode !== "dark") warnings.push(`${context} : mode "${String(t.mode)}" invalide, remplacé par "light".`);
    const font = GOOGLE_FONTS.find((f) => typeof t.fontFamily === "string" && f.family.toLowerCase() === t.fontFamily.toLowerCase())?.family;
    if (t.fontFamily !== undefined && !font) warnings.push(`${context} : police "${String(t.fontFamily)}" non proposée, police par défaut utilisée.`);
    const radius = THEME_RADIUS_PRESETS.find((r) => r.value === t.radius)?.value;
    if (t.radius !== undefined && !radius) warnings.push(`${context} : arrondi "${String(t.radius)}" invalide, arrondi par défaut utilisé.`);
    themes.push({
      originalId,
      name,
      mode: t.mode === "dark" ? "dark" : "light",
      accent: resolveColor(t.accent, warnings, context),
      ...(font ? { fontFamily: font } : {}),
      ...(radius ? { radius } : {}),
      ...resolvePattern(t.pattern, warnings, context),
    });
  }

  const presets: ParsedAiPreset[] = [];
  const seenPresetNames = new Set<string>();
  for (const [index, entry] of (raws.presets ?? []).entries()) {
    const p = entry as Record<string, unknown>;
    const context = `Preset #${index + 1}`;
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name || seenPresetNames.has(name.toLowerCase())) {
      warnings.push(`${context} : nom "${name}" vide ou dupliqué, preset ignoré.`);
      continue;
    }
    seenPresetNames.add(name.toLowerCase());
    const themeId = typeof p.themeId === "string" ? p.themeId : undefined;
    const themeKnown = themeId !== undefined && (seenThemeIds.has(themeId) || existingThemeIds.has(themeId));
    if (themeId !== undefined && !themeKnown) warnings.push(`${context} : thème "${themeId}" introuvable, ignoré.`);
    const color = typeof p.color === "string" && HEX_COLOR.test(p.color) ? p.color : undefined;
    presets.push({
      name,
      ...(typeof p.description === "string" && p.description.trim() ? { description: p.description.trim() } : {}),
      ...(color ? { color } : {}),
      connections: pickBooleans(p.connections, (id) => knownConnectionIds.has(id), warnings, `${context} (source)`),
      eventTypes: pickBooleans(p.eventTypes, (id) => seenTypeIds.has(id) || existingTypeIds.has(id), warnings, `${context} (type)`),
      ...(themeKnown ? { originalThemeId: themeId } : {}),
    });
  }

  return { sections, eventTypes, rules, presets, themes, reusedTypeIds, reusedThemeIds, warnings };
}

export type AiImportMode = "merge" | "replace";

export interface AiImportSummary {
  typesCreated: number;
  rulesApplied: number;
  presetsCreated: number;
  themesCreated: number;
  warnings: string[];
}

/**
 * Parses `raw` and writes it into the stores, one setState per section.
 *  - "merge": new types/themes/presets are added (a preset whose name is taken is
 *    skipped), "name" rules inserted at the top of their tier, "source" rules
 *    retarget that connection's existing source rule. Nothing is removed.
 *  - "replace": for each section present in the JSON, the AI's version wins —
 *    only what can't be recreated survives (the default type, the catch-all rule,
 *    one source rule per connection, the built-in themes) plus whatever existing
 *    type/theme the AI explicitly reused or referenced. Sections the JSON omits
 *    are left untouched. Event-id rules are dropped with the rest of the rules.
 */
export function applyAiImport(raw: string, mode: AiImportMode): AiImportSummary | { error: string } {
  const { connections } = useConnectionStore.getState();
  const { types, getDefaultType } = useEventTypeStore.getState();
  const { rules } = useRuleStore.getState();
  const { presets } = usePresetStore.getState();
  const { customThemes, themeOrder, selectedThemeId } = useThemeStore.getState();

  const parsed = parseAiImport(raw, connections, new Set(types.map((t) => t.id)), new Set(customThemes.map((t) => t.id)));
  if ("error" in parsed) return parsed;
  const replace = mode === "replace";
  const has = (section: AiSection) => parsed.sections.includes(section);
  const warnings = [...parsed.warnings];
  const defaultTypeId = getDefaultType().id;

  // ── Types ──
  const typeIdMap = new Map<string, string>(); // AI id → persisted id
  const takenTypeIds = new Set(types.map((t) => t.id));
  const createdTypes = parsed.eventTypes.map((t) => {
    const id = takenTypeIds.has(t.originalId) ? crypto.randomUUID() : t.originalId;
    takenTypeIds.add(id);
    typeIdMap.set(t.originalId, id);
    const { originalId: _, ...fields } = t;
    return { ...fields, id };
  });
  const referencedTypeIds = new Set([
    ...parsed.reusedTypeIds,
    ...parsed.rules.map((r) => r.originalDisplayTypeId),
    ...parsed.presets.flatMap((p) => Object.keys(p.eventTypes)),
  ]);
  const keptTypes = replace && has("types") ? types.filter((t) => t.isDefault || referencedTypeIds.has(t.id)) : types;
  if (has("types")) useEventTypeStore.setState({ types: [...keptTypes, ...createdTypes] });
  const resolveTypeId = (id: string) => typeIdMap.get(id) ?? (keptTypes.some((t) => t.id === id) ? id : undefined);

  // ── Rules ──
  let rulesApplied = 0;
  if (has("rules")) {
    const now = Date.now();
    const base = replace
      ? rules.filter((r) => r.matchType === "source" || r.matchType === "all")
        .map((r) => (r.matchType === "source" ? { ...r, displayTypeId: defaultTypeId, enabled: true } : r))
      : rules;
    const nameRules: Rule[] = [];
    for (const r of parsed.rules.filter((x) => x.matchType === "name")) {
      const displayTypeId = resolveTypeId(r.originalDisplayTypeId);
      if (!displayTypeId) continue;
      if (base.some((x) => x.matchType === "name" && x.matchValue === r.matchValue && x.displayTypeId === displayTypeId)) {
        warnings.push(`Règle "${r.matchValue}" déjà présente, non dupliquée.`);
        continue;
      }
      nameRules.push({ id: crypto.randomUUID(), matchType: "name", matchValue: r.matchValue, displayTypeId, enabled: r.enabled, createdAt: now });
    }
    const sourceTargets = new Map(parsed.rules.filter((x) => x.matchType === "source").map((r) => [r.matchValue, r]));
    const withSources = base.map((x) => {
      const r = x.matchType === "source" ? sourceTargets.get(x.matchValue) : undefined;
      const displayTypeId = r && resolveTypeId(r.originalDisplayTypeId);
      if (!r || !displayTypeId) return x;
      rulesApplied += 1;
      return { ...x, displayTypeId, enabled: r.enabled };
    });
    // AI order is priority order: its name rules go, in order, above every existing
    // name/source rule (below event-id rules, which only survive a merge).
    const insertAt = withSources.findIndex((x) => x.matchType !== "event");
    const at = insertAt === -1 ? withSources.length : insertAt;
    useRuleStore.setState({ rules: [...withSources.slice(0, at), ...nameRules, ...withSources.slice(at)] });
    rulesApplied += nameRules.length;
  }

  // ── Themes ──
  const themeIdMap = new Map<string, string>();
  const createdThemes: Theme[] = parsed.themes.map(({ originalId, ...fields }) => {
    const id = crypto.randomUUID();
    themeIdMap.set(originalId, id);
    return { ...fields, id };
  });
  const referencedThemeIds = new Set([...parsed.reusedThemeIds, ...parsed.presets.flatMap((p) => (p.originalThemeId ? [p.originalThemeId] : []))]);
  const keptThemes = replace && has("themes")
    ? customThemes.filter((t) => BUILTIN_THEMES.some((b) => b.id === t.id) || referencedThemeIds.has(t.id))
    : customThemes;
  if (has("themes")) {
    const themesAfter = [...keptThemes, ...createdThemes];
    const keptOrder = themeOrder.filter((id) => keptThemes.some((t) => t.id === id));
    useThemeStore.setState({
      customThemes: themesAfter,
      themeOrder: [...keptOrder, ...createdThemes.map((t) => t.id)],
      // Replacing themes shows the AI's first one; merging keeps the current pick.
      selectedThemeId: (replace && createdThemes[0]?.id) || (themesAfter.some((t) => t.id === selectedThemeId) ? selectedThemeId : themesAfter[0].id),
    });
  }
  const resolveThemeId = (id?: string) => (id ? themeIdMap.get(id) ?? (keptThemes.some((t) => t.id === id) ? id : undefined) : undefined);

  // ── Presets ──
  let presetsCreated = 0;
  if (has("presets")) {
    const base = replace ? [] : presets;
    const created: Preset[] = [];
    for (const p of parsed.presets) {
      if (base.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) {
        warnings.push(`Preset "${p.name}" déjà présent, non dupliqué.`);
        continue;
      }
      const eventTypes: Record<string, boolean> = {};
      for (const [id, hidden] of Object.entries(p.eventTypes)) {
        const resolved = resolveTypeId(id);
        if (resolved) eventTypes[resolved] = hidden;
      }
      const themeId = resolveThemeId(p.originalThemeId);
      created.push({
        id: crypto.randomUUID(),
        name: p.name,
        ...(p.description ? { description: p.description } : {}),
        ...(p.color ? { color: p.color } : {}),
        connections: p.connections,
        eventTypes,
        ...(themeId ? { themeId } : {}),
      });
    }
    usePresetStore.setState({ presets: [...base, ...created] });
    presetsCreated = created.length;
  }

  return { typesCreated: createdTypes.length, rulesApplied, presetsCreated, themesCreated: createdThemes.length, warnings };
}
