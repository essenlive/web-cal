"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { ExportTab } from "./ExportTab";
import { ImportTab } from "./ImportTab";
import { SyncTab } from "./SyncTab";
import { ServerTab } from "./ServerTab";
import { ResetTab } from "./ResetTab";

const TABS = [
  {
    id: "export",
    label: "Export",
    description: "Télécharge vos réglages actuels dans un fichier JSON.",
  },
  {
    id: "import",
    label: "Import",
    description: "Restaure des réglages depuis un fichier JSON précédemment exporté.",
  },
  {
    id: "sync",
    label: "Synchroniser",
    description: "Transfère tes réglages vers un autre appareil via le serveur Overcal (relais chiffré de bout en bout, rien n'est conservé).",
  },
  {
    id: "server",
    label: "Serveur",
    description: "Lit tes calendriers depuis le serveur Overcal qui sert cette page, avec ton jeton d'administration.",
  },
  {
    id: "reset",
    label: "Réinitialiser",
    description: "Efface tous les réglages de cet appareil.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** A sync pairing link (?room=...&key=... in the hash) always opens straight into the Sync tab;
 */
function initialTab(): TabId {
  if (typeof window !== "undefined" && window.location.hash.includes("room=")) return "sync";
  return "export";
}

export function DataView() {
  const [tab, setTab] = useState<TabId>(initialTab);
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex rounded-xl border border-border overflow-hidden bg-background w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground max-w-3xl">{active.description}</p>

      {tab === "export" && <ExportTab />}
      {tab === "import" && <ImportTab />}
      {tab === "sync" && <SyncTab />}
      {tab === "server" && <ServerTab />}
      {tab === "reset" && <ResetTab />}
    </div>
  );
}
