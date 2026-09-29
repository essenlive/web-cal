"use client";

/**
 * "Bien démarrer" checklist, shown at the top of the Help drawer. Steps tick themselves from
 * the stores' state (lib/onboarding.ts); each step's button opens the form that completes it.
 * Once the three core steps are done only the remaining bonus steps stay; with those done
 * too, the whole card disappears.
 */

import { useMemo } from "react";
import Link from "next/link";
import { Check, Circle, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { cn } from "../../lib/utils";
import {
  DEFAULT_EVENT_TYPES, useConnectionStore, useEventTypeStore, useOnboardingStore, usePresetStore, useRuleStore, useThemeStore, useUIStore,
  type DrawerPanel,
} from "../../store";
import { BUILTIN_THEMES } from "../../lib/theme";
import { coreDone, DEMO_CONNECTION_ID, onboardingSteps, type OnboardingStep } from "../../lib/onboarding";


const SEEDED_TYPE_IDS = new Set(DEFAULT_EVENT_TYPES.map((t) => t.id));
const BUILTIN_THEME_IDS = new Set(BUILTIN_THEMES.map((t) => t.id));

export function useOnboardingSteps(): OnboardingStep[] {
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { presets } = usePresetStore();
  const { customThemes, selectedThemeId } = useThemeStore();
  const { aiImported } = useOnboardingStore();
  return useMemo(
    () => onboardingSteps({ connections, types, rules, presets, customThemes, selectedThemeId, aiImported }, SEEDED_TYPE_IDS, BUILTIN_THEME_IDS),
    [connections, types, rules, presets, customThemes, selectedThemeId, aiImported],
  );
}

/** Same as the matching sidebar "+": straight into the new-item form (rules: a blank rule, edited inline in the rules drawer). */
function openStep(panel: DrawerPanel) {
  const ui = useUIStore.getState();
  if (panel !== "rules") return ui.openNewItemDrawer(panel);
  useRuleStore.getState().addRule({ matchType: "name", matchValue: "", displayTypeId: useEventTypeStore.getState().getDefaultType().id });
  ui.openDrawer("rules");
}

function StepRow({ step }: { step: OnboardingStep }) {
  const { removeConnection } = useConnectionStore();
  return (
    <li className="flex items-center gap-2 py-1">
      {step.done
        ? <Check size={14} className="shrink-0 text-green-600 dark:text-green-400" aria-label="Fait" />
        : <Circle size={14} className="shrink-0 text-muted-foreground" aria-label="À faire" />}
      <span className={cn("flex-1 min-w-0 truncate text-sm", step.done ? "text-muted-foreground line-through" : "text-foreground")}>
        {step.title}
      </span>
      {!step.done && step.panel && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openStep(step.panel!)}>Commencer</Button>
      )}
      {!step.done && step.id === "removeDemo" && (
        <ActionButton
          variant="ghost"
          size="sm"
          onAction={() => removeConnection(DEMO_CONNECTION_ID)}
          confirmChildren={<><Trash2 size={12} />Confirmer</>}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={12} />Supprimer
        </ActionButton>
      )}
      {!step.done && step.id === "ai" && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link href="/data#ai">Ouvrir</Link>
        </Button>
      )}
    </li>
  );
}

export function GettingStarted() {
  const steps = useOnboardingSteps();
  const { dismissed, setDismissed } = useOnboardingStore();
  const core = steps.filter((s) => !s.bonus);
  const bonus = steps.filter((s) => s.bonus && s.visible && !s.done);
  const ready = coreDone(steps);
  if (ready && bonus.length === 0) return null;

  return (
    <section className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Bien démarrer</h3>
        <span className="text-xs text-muted-foreground">{core.filter((s) => s.done).length} / {core.length}</span>
      </div>
      {ready ? (
        <p className="text-xs text-muted-foreground">Les bases sont en place. Pour aller plus loin :</p>
      ) : (
        <ul>{core.map((s) => <StepRow key={s.id} step={s} />)}</ul>
      )}
      {bonus.length > 0 && (
        <>
          {!ready && <h4 className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pour aller plus loin</h4>}
          <ul>{bonus.map((s) => <StepRow key={s.id} step={s} />)}</ul>
        </>
      )}
      {!dismissed && (
        <button onClick={() => setDismissed(true)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Ne plus ouvrir l&apos;aide automatiquement
        </button>
      )}
    </section>
  );
}
