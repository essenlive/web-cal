"use client";

/**
 * AiRulesTab — the "prompt autonome" flow, as a tab on the Data page:
 *  - Export: builds the prompt + the user's sources, a sample of their events
 *    and their current types/rules (lib/ai-prompt.ts), to copy or download and
 *    paste into any AI assistant.
 *  - Import: takes the JSON the AI returns (settings-export envelope, checked
 *    against docs/ai-rules-schema.json by lib/ai-import.ts) and merges it in:
 *    new event types are created, "name" rules added, and "source" rules update
 *    the existing auto-created source rule for that connection (there is
 *    exactly one per connection — see useSourceRule in RuleEditRow.tsx).
 *    Nothing existing is overwritten or deleted.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore } from "../../store";
import { parseAiImport } from "../../lib/ai-import";
import { buildAiExport } from "../../lib/ai-prompt";

interface ImportSummary {
  typesCreated: number;
  rulesApplied: number;
  warnings: string[];
}

export function AiRulesTab() {
  const [importText, setImportText] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { addType, types } = useEventTypeStore();
  const { rules, addRule, updateRule } = useRuleStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();

  const exportText = buildAiExport(connections, events, types, rules);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      toast.success("Prompt et données copiés");
    } catch {
      toast.error("Copie impossible — sélectionne le texte et copie-le manuellement.");
    }
  }

  function downloadExport() {
    const blob = new Blob([exportText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webcal-prompt-regles-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const existingIds = new Set(types.map((t) => t.id));
    const parsed = parseAiImport(importText, connections, existingIds);
    if ("error" in parsed) {
      setError(parsed.error);
      setSummary(null);
      return;
    }
    setError(null);

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
    const resolveTypeId = (id: string) => idMap.get(id) ?? (types.some((t) => t.id === id) ? id : undefined);

    const warnings = [...parsed.warnings];
    let rulesApplied = 0;
    const nameRules = parsed.rules.filter((r) => r.matchType === "name");
    const sourceRules = parsed.rules.filter((r) => r.matchType === "source");

    // Inserted newest-first within their tier (see useRuleStore.addRule) — reversing
    // here restores the priority order the AI specified (index 0 = highest priority).
    for (const r of [...nameRules].reverse()) {
      const displayTypeId = resolveTypeId(r.originalDisplayTypeId);
      if (!displayTypeId) continue;
      const duplicate = rules.some((x) => x.matchType === "name" && x.matchValue === r.matchValue && x.displayTypeId === displayTypeId);
      if (duplicate) {
        warnings.push(`Règle "${r.matchValue}" déjà présente, non dupliquée.`);
        continue;
      }
      addRule({ matchType: "name", matchValue: r.matchValue, displayTypeId, enabled: r.enabled });
      rulesApplied += 1;
    }
    for (const r of sourceRules) {
      const displayTypeId = resolveTypeId(r.originalDisplayTypeId);
      const existing = rules.find((x) => x.matchType === "source" && x.matchValue === r.matchValue);
      if (!displayTypeId || !existing) continue;
      updateRule({ ...existing, displayTypeId, enabled: r.enabled });
      rulesApplied += 1;
    }

    setSummary({ typesCreated: parsed.eventTypes.length, rulesApplied, warnings });
    setImportText("");
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">1. Exporter pour l&apos;IA</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Le prompt et tes données (sources, jusqu&apos;à 20 titres d&apos;événements distincts par source, types et
            règles actuels — sans les URL ni identifiants des calendriers). Colle-le dans ton assistant IA, réponds à
            ses questions, puis importe le JSON qu&apos;il renvoie ci-dessous.
          </p>
        </div>
        <textarea
          readOnly
          value={exportText}
          onFocus={(e) => e.currentTarget.select()}
          rows={8}
          aria-label="Prompt et données à copier"
          className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-mono outline-hidden focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadExport}>
            <Download /> Télécharger
          </Button>
          <Button onClick={copyExport}>
            <Copy /> Copier
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">2. Importer le JSON de l&apos;IA</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Colle ici le bloc JSON renvoyé par l&apos;IA (format des réglages web-cal, vérifié par{" "}
            <code className="text-[11px]">docs/ai-rules-schema.json</code>). Les types et règles sont ajoutés aux
            tiens, rien n&apos;est supprimé.
          </p>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='{ "version": 1, "exportedAt": "…", "data": { "overcal:event-types": …, "overcal:rules": … } }'
          rows={6}
          aria-label="JSON renvoyé par l'IA"
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

        <Button
          onClick={handleImport}
          disabled={!importText.trim()}
          className={cn(!importText.trim() && "opacity-50 cursor-not-allowed")}
        >
          <Upload /> Importer
        </Button>
      </div>
    </div>
  );
}
