"use client";

import { choiceClass, cn } from "../../lib/utils";
import { THEME_PATTERNS } from "../../lib/theme";
import type { ThemePattern } from "../../types";

/** Background-pattern tiles, each previewing its own texture in `ink` — shared by the theme and display-type editors. */
export function PatternPicker({ value, onChange, ink, label = "Motif de fond" }: {
  value: ThemePattern;
  onChange: (p: ThemePattern) => void;
  ink: string;
  label?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={label}>
        {THEME_PATTERNS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value === p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg p-1.5 text-[11px]",
              choiceClass(value === p.value)
            )}
          >
            <span
              className="h-8 w-full rounded-md border border-border bg-background"
              style={{ backgroundImage: p.image(ink), backgroundSize: p.size }}
            />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
