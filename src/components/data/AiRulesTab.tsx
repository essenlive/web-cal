"use client";

/**
 * AiRulesTab — the "prompt autonome" flow, as a tab on the Data page:
 *  - Export: builds the prompt + the user's sources, a sample of their events
 *    and their current types/rules/presets/themes (lib/ai-prompt.ts), to copy
 *    or download and paste into any AI assistant.
 *  - Import: takes the JSON the AI returns (settings-export envelope, checked
 *    against docs/ai-rules-schema.json) and either merges it in or replaces
 *    the sections it contains — see applyAiImport in lib/ai-import.ts.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { cn } from "../../lib/utils";
import { useRuleStore, useEventTypeStore, useConnectionStore, useEventsStore, usePresetStore, useThemeStore } from "../../store";
import { applyAiImport, type AiImportMode, type AiImportSummary } from "../../lib/ai-import";
import { buildAiExport } from "../../lib/ai-prompt";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function AiRulesTab() {
  const [importText, setImportText] = useState("");
  const [mode, setMode] = useState<AiImportMode>("merge");
  const [summary, setSummary] = useState<AiImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { connections } = useConnectionStore();
  const { events } = useEventsStore();
  const { presets } = usePresetStore();
  const { customThemes } = useThemeStore();

  const exportText = buildAiExport(connections, events, types, rules, presets, customThemes);

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
    a.download = `webcal-prompt-reglages-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const result = applyAiImport(importText, mode);
    if ("error" in result) {
      setError(result.error);
      setSummary(null);
      return;
    }
    setError(null);
    setSummary(result);
    setImportText("");
    toast.success(mode === "replace" ? "Réglages remplacés" : "Réglages ajoutés");
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">1. Exporter pour l&apos;IA</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Le prompt et tes données (sources, jusqu&apos;à 20 titres d&apos;événements distincts par source, types,
            règles, presets et thèmes actuels — sans les URL ni identifiants des calendriers). Colle-le dans ton assistant IA, réponds à
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
            <code className="text-[11px]">docs/ai-rules-schema.json</code>).
          </p>
        </div>
        <div role="radiogroup" aria-label="Mode d'import" className="grid grid-cols-2 gap-2">
          {([
            ["merge", "Ajouter aux miens", "Crée les nouveaux éléments, rien n'est supprimé."],
            ["replace", "Tout remplacer", "Pour chaque section fournie par l'IA, ses types, règles, presets ou thèmes remplacent les tiens."],
          ] as const).map(([value, title, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                mode === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <div className="text-xs font-medium text-foreground">{title}</div>
              <div className="text-[11px] text-muted-foreground">{text}</div>
            </button>
          ))}
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
              Créés : {plural(summary.typesCreated, "type")}, {plural(summary.presetsCreated, "preset")}, {plural(summary.themesCreated, "thème")} · {plural(summary.rulesApplied, "règle")} appliquée{summary.rulesApplied > 1 ? "s" : ""}.
            </p>
            {summary.warnings.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}

        {mode === "replace" ? (
          <ActionButton
            variant="destructive"
            onAction={handleImport}
            disabled={!importText.trim()}
            confirmChildren="Confirmer le remplacement"
          >
            <Upload /> Importer et remplacer
          </ActionButton>
        ) : (
          <Button onClick={handleImport} disabled={!importText.trim()}>
            <Upload /> Importer
          </Button>
        )}
      </div>
    </div>
  );
}
