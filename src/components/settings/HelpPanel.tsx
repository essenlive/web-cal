"use client";

/** Help drawer — how the app fits together, with the Debug page and GitHub repo links at the bottom. */

import Link from "next/link";
import { Bug, GitBranch } from "lucide-react";
import { PanelHeader, InlineLink } from "../settings/PanelHeader";
import { useUIStore } from "../../store";
import { GettingStarted } from "./GettingStarted";
import type { DrawerPanel } from "../../store";

const REPO_URL = "https://github.com/essenlive/web-cal";

const STEPS: { panel: DrawerPanel; title: string; text: string }[] = [
  { panel: "connection", title: "Sources", text: "Ajoutez vos calendriers via leur lien ICS. Les événements sont mis en cache et resynchronisés en arrière-plan." },
  { panel: "eventType", title: "Types", text: "Un type définit l'apparence d'un événement : couleur, icône, style (bloc, badge, fond…)." },
  { panel: "rules", title: "Règles", text: "Les règles associent les événements à un type, selon leur nom ou leur source. La première règle qui correspond l'emporte." },
  { panel: "preset", title: "Presets", text: "Enregistrez une combinaison de sources et de types visibles, et passez de l'une à l'autre avec les touches 1 à 9." },
  { panel: "theme", title: "Thème", text: "Couleurs, police et arrondis de toute l'interface." },
];

export function HelpPanel() {
  const openDrawer = useUIStore((s) => s.openDrawer);

  return (
    <>
      <PanelHeader title="Aide" description="Vos réglages restent dans ce navigateur, sans compte." />

      <div className="flex flex-col gap-3 px-4 pb-4">
        <GettingStarted />
        <ol className="space-y-2.5">
          {STEPS.map((step, i) => (
            <li key={step.panel} className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              <div className="font-medium text-foreground">
                {i + 1}. <InlineLink onClick={() => openDrawer(step.panel)}>{step.title}</InlineLink>
              </div>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="flex gap-2 border-t border-border pt-3">
          <Link href="/debug" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <Bug size={14} />
            Debug
          </Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <GitBranch size={14} />
            Dépôt GitHub
          </a>
        </div>
      </div>
    </>
  );
}
