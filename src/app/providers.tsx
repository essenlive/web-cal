"use client";

import { useEffect } from "react";
import { useThemeStore } from "../store";
import { getActiveTheme, resolveThemeCssVars } from "../lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const { customThemes, selectedThemeId } = useThemeStore();
  const activeTheme = getActiveTheme(customThemes, selectedThemeId);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", activeTheme.mode === "dark");
    const vars = resolveThemeCssVars(activeTheme);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, [activeTheme]);

  return <>{children}</>;
}
