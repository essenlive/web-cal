"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { applyBundle, isSettingsBundle, type SettingsBundle } from "../../lib/sync/bundle";

export function ImportTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<SettingsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setApplied(false);
    setPending(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (!isSettingsBundle(parsed)) throw new Error("not a settings bundle");
      setPending(parsed);
    } catch {
      const message = "Ce fichier n'est pas un export de réglages valide.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Importe un fichier de réglages précédemment exporté. Cela remplace entièrement les réglages actuels de cet appareil (sources, types d&rsquo;événements, règles, presets, thèmes, préférences).
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload /> Choisir un fichier
      </Button>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {pending && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm text-foreground">
            Fichier valide — {pending.connections.length} source(s), {pending.eventTypes.length} type(s) d&rsquo;événement, {pending.rules.length} règle(s), {pending.presets.length} preset(s).
          </p>
          <ActionButton
            variant="destructive"
            confirmChildren="Confirmer le remplacement"
            onAction={() => {
              applyBundle(pending);
              setPending(null);
              setApplied(true);
              toast.success("Réglages importés");
            }}
          >
            Importer et remplacer mes réglages
          </ActionButton>
        </div>
      )}

      {applied && <p className="text-xs text-muted-foreground">Réglages importés.</p>}
    </div>
  );
}
