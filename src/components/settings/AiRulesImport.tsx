"use client";

/**
 * AiRulesImport — paste-in for the JSON produced by the "prompt autonome"
 * (docs/ai-rules-prompt.md): a set of display types + rules an AI drafted
 * from the user's own sources/events. Creates the event types, then applies
 * "name" rules as new text rules and "source" rules by updating the existing
 * auto-created source rule for that connection (there is exactly one per
 * connection — see useSourceRule/EnsureSourceRule in RuleEditRow.tsx).
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import { useRuleStore, useEventTypeStore, useConnectionStore } from "../../store";
import { parseAiImport } from "../../lib/ai-import";

interface ImportSummary {
  typesCreated: number;
  rulesApplied: number;
  warnings: string[];
}

export function AiRulesImport() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { addType, types } = useEventTypeStore();
  const { rules, addRule, updateRule } = useRuleStore();
  const { connections } = useConnectionStore();

  function reset() {
    setOpen(false);
    setText("");
    setSummary(null);
    setError(null);
  }

  function handleImport() {
    const parsed = parseAiImport(text, connections);
    if ("error" in parsed) {
      setError(parsed.error);
      setSummary(null);
      return;
    }
    setError(null);

    const existingIds = new Set(types.map((t) => t.id));
    const idMap = new Map<string, string>();
    for (const t of parsed.eventTypes) {
      const newId = existingIds.has(t.originalId) ? crypto.randomUUID() : t.originalId;
      existingIds.add(newId);
      idMap.set(t.originalId, newId);
      addType({
        id: newId,
        label: t.label,
        color: t.color,
        icon: t.icon,
        badgeLetter: t.badgeLetter,
        allDayStyle: t.allDayStyle,
        timedStyle: t.timedStyle,
      });
    }

    let rulesApplied = 0;
    const nameRules = parsed.rules.filter((r) => r.matchType === "name");
    const sourceRules = parsed.rules.filter((r) => r.matchType === "source");

    // Inserted newest-first within their tier (see useRuleStore.addRule) — reversing
    // here restores the priority order the AI specified (index 0 = highest priority).
    for (const r of [...nameRules].reverse()) {
      const displayTypeId = idMap.get(r.originalDisplayTypeId);
      if (!displayTypeId) continue;
      addRule({ matchType: "name", matchValue: r.matchValue, displayTypeId, enabled: r.enabled });
      rulesApplied += 1;
    }
    for (const r of sourceRules) {
      const displayTypeId = idMap.get(r.originalDisplayTypeId);
      const existing = rules.find((x) => x.matchType === "source" && x.matchValue === r.matchValue);
      if (!displayTypeId || !existing) continue;
      updateRule({ ...existing, displayTypeId, enabled: r.enabled });
      rulesApplied += 1;
    }

    setSummary({ typesCreated: parsed.eventTypes.length, rulesApplied, warnings: parsed.warnings });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Sparkles size={14} />
        Importer un JSON généré par IA
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Colle ici le bloc JSON renvoyé par l&apos;IA (voir <code className="text-[11px]">docs/ai-rules-prompt.md</code>).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "eventTypes": [...], "rules": [...] }'
        rows={6}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono outline-hidden focus:ring-2 focus:ring-primary/30 resize-none"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {summary && (
        <div className="rounded-lg bg-muted/50 p-2 space-y-1">
          <p className="text-xs font-medium text-foreground">
            {summary.typesCreated} type{summary.typesCreated > 1 ? "s" : ""} créé{summary.typesCreated > 1 ? "s" : ""}, {summary.rulesApplied} règle{summary.rulesApplied > 1 ? "s" : ""} appliquée{summary.rulesApplied > 1 ? "s" : ""}.
          </p>
          {summary.warnings.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
              {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={reset}
          className="flex-1 rounded-lg bg-muted py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          {summary ? "Fermer" : "Annuler"}
        </button>
        {!summary && (
          <button
            onClick={handleImport}
            disabled={!text.trim()}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              text.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Importer
          </button>
        )}
      </div>
    </div>
  );
}
