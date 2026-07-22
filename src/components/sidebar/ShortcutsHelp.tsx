"use client";

import * as Popover from "@radix-ui/react-popover";
import { Keyboard } from "lucide-react";
import { usePresetStore } from "../../store";

const VIEW_ROWS = [
  { keys: "M", label: "Vue mois" },
  { keys: "W", label: "Vue semaine" },
  { keys: "D", label: "Vue jour" },
  { keys: "A", label: "Vue agenda" },
];

const NAV_ROWS = [{ keys: "← / →", label: "Période précédente / suivante" }];

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground truncate">{label}</span>
      <kbd className="font-mono text-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{keys}</kbd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      {children}
    </div>
  );
}

export function ShortcutsHelp() {
  const { presets } = usePresetStore();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          aria-label="Raccourcis clavier"
        >
          <Keyboard size={17} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 bg-card border border-border rounded-xl shadow-lg p-3 min-w-[240px]
                     flex flex-col gap-3 animate-in fade-in-0 zoom-in-95"
        >
          <Section title="Vues">
            {VIEW_ROWS.map((row) => <Row key={row.keys} {...row} />)}
          </Section>

          <Section title="Navigation">
            {NAV_ROWS.map((row) => <Row key={row.keys} {...row} />)}
          </Section>

          <Section title="Présélections">
            <Row keys="0" label="Tout afficher" />
            {presets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun preset enregistré.</p>
            ) : (
              presets.slice(0, 9).map((preset, i) => (
                <Row key={preset.id} keys={String(i + 1)} label={preset.name} />
              ))
            )}
          </Section>

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
