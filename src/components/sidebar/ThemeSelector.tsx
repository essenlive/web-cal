"use client";

/**
 * ThemeSelector — replaces the old light/dark toggle button in the Header.
 * A Radix Popover listing every theme (built-ins + custom), with an inline
 * entry point to create a new theme and, per custom theme, to edit it.
 */

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, Edit2, Palette, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { useThemeStore, useUIStore } from "../../store";
import { getAllThemes, isBuiltinTheme } from "../../lib/theme";
import type { Theme } from "../../types";

export function ThemeSelector() {
  const { customThemes, selectedThemeId, selectTheme } = useThemeStore();
  const { openDrawer } = useUIStore();
  const themes = getAllThemes(customThemes);

  const [popoverOpen, setPopoverOpen] = useState(false);

  function openCreate() {
    setPopoverOpen(false);
    openDrawer("theme");
  }

  function openEdit(theme: Theme) {
    setPopoverOpen(false);
    openDrawer("theme", theme.id);
  }

  return (
    <>
      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger asChild>
          <button
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Changer de thème"
          >
            <Palette size={17} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[200px]
                       flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95"
          >
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
              >
                <button
                  onClick={() => {
                    selectTheme(theme.id);
                    setPopoverOpen(false);
                  }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span
                    className="size-3.5 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: theme.accent }}
                  />
                  <span className="text-sm text-foreground truncate flex-1">{theme.name}</span>
                  {theme.id === selectedThemeId && (
                    <Check size={14} className="text-primary shrink-0" />
                  )}
                </button>
                {!isBuiltinTheme(theme.id) && (
                  <button
                    onClick={() => openEdit(theme)}
                    aria-label={`Modifier ${theme.name}`}
                    className={cn(
                      "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background shrink-0",
                      "opacity-0 group-hover:opacity-100 transition-opacity"
                    )}
                  >
                    <Edit2 size={12} />
                  </button>
                )}
              </div>
            ))}

            <div className="border-t border-border my-1" />

            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus size={14} />
              Nouveau thème
            </button>

            <Popover.Arrow className="fill-border" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
