"use client";

import { useEffect } from "react";
import { useThemeStore } from "../store";
import { getActiveTheme, loadGoogleFont, resolveThemeCssVars } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const { customThemes, selectedThemeId } = useThemeStore();
  const activeTheme = getActiveTheme(customThemes, selectedThemeId);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", activeTheme.mode === "dark");
    loadGoogleFont(activeTheme.fontFamily ?? "DM Sans");
    const vars = resolveThemeCssVars(activeTheme);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, [activeTheme]);

  return (
    <>
      {children}
      <Toaster theme={activeTheme.mode} />
    </>
  );
}
