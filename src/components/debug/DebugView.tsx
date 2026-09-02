import type { ReactNode } from "react";
import { SourcesPanel } from "./SourcesPanel";
import { EventsPanel } from "./EventsPanel";
import { RulesPanel } from "./RulesPanel";
import { SanityPanel } from "./SanityPanel";
import { StoragePanel } from "./StoragePanel";
import { CopySnapshotButton } from "./CopySnapshotButton";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function DebugView() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          État interne en lecture seule : sources et cache de récupération, événements chargés, et comment le
          moteur de règles résout chacun d&apos;eux.
        </p>
        <CopySnapshotButton />
      </div>

      <Section title="Sources & cache"><SourcesPanel /></Section>
      <Section title="Vérifications de configuration"><SanityPanel /></Section>
      <Section title="Règles"><RulesPanel /></Section>
      <Section title="Événements chargés"><EventsPanel /></Section>
      <Section title="Stockage local"><StoragePanel /></Section>
    </div>
  );
}
