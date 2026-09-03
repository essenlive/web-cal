"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "../ui/action-button";
import { SETTINGS_STORAGE_KEYS } from "../../store";
import { CLOCK_STORAGE_KEY } from "../../lib/sync/clock";

export function ResetTab() {
  function handleReset() {
    for (const key of [...SETTINGS_STORAGE_KEYS, CLOCK_STORAGE_KEY]) localStorage.removeItem(key);
    window.location.reload();
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Efface tous les réglages de cet appareil (sources, types d&rsquo;événements, règles, presets, thèmes, préférences) et recharge l&rsquo;application avec les valeurs par défaut.
      </p>
      <p className="text-xs text-muted-foreground">
        Pensez à exporter vos réglages avant si vous voulez pouvoir les restaurer ensuite.
      </p>
      <ActionButton variant="destructive" confirmChildren="Confirmer la suppression" onAction={handleReset}>
        <Trash2 /> Tout réinitialiser
      </ActionButton>
    </div>
  );
}
