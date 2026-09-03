"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { captureBundle } from "../../lib/sync/bundle";
import { getSettingsUpdatedAt } from "../../lib/sync/clock";

export function ExportTab() {
  const [downloaded, setDownloaded] = useState(false);
  const updatedAt = getSettingsUpdatedAt();

  function handleExport() {
    const bundle = captureBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overcal-settings-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    toast.success("Réglages exportés");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Télécharge une copie de vos réglages (sources, types d&rsquo;événements, règles, presets, thèmes, préférences) dans un fichier JSON, à réimporter plus tard sur cet appareil ou un autre.
      </p>
      <p className="text-xs text-muted-foreground">
        {updatedAt
          ? `Dernière modification connue : ${format(updatedAt, "d MMM HH:mm:ss", { locale: fr })}.`
          : "Aucune modification enregistrée pour l'instant sur cet appareil."}
      </p>
      <Button onClick={handleExport}>
        <Download /> Télécharger le fichier
      </Button>
      {downloaded && <p className="text-xs text-muted-foreground">Fichier téléchargé.</p>}
    </div>
  );
}
