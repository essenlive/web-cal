"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { SourcesPanel } from "./SourcesPanel";
import { EventsPanel } from "./EventsPanel";
import { RulesPanel } from "./RulesPanel";
import { StoragePanel } from "./StoragePanel";

const TABS = [
  {
    id: "sources",
    label: "Sources & cache",
    description: "Chaque source configurée, son statut de connexion, et le cache local des événements déjà récupérés (plages couvertes, dernière récupération, réessais en cours).",
  },
  {
    id: "rules",
    label: "Règles",
    description: "Les règles d'affichage, évaluées de haut en bas — la première règle activée qui correspond à un événement décide de son type. La colonne État signale les règles inactives ou pointant vers un type supprimé.",
  },
  {
    id: "events",
    label: "Événements",
    description: "Tous les événements actuellement chargés, avec la règle qui s'applique à chacun, le type résolu, et pourquoi il est visible ou masqué.",
  },
  {
    id: "storage",
    label: "Stockage",
    description: "Le contenu brut de localStorage pour les clés persistées par l'application (connexions, règles, types, thème, cache d'événements…).",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DebugView() {
  const [tab, setTab] = useState<TabId>("sources");
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

      {tab === "sources" && <SourcesPanel />}
      {tab === "rules" && <RulesPanel />}
      {tab === "events" && <EventsPanel />}
      {tab === "storage" && <StoragePanel />}
    </div>
  );
}
