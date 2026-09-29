"use client";

import { useEffect } from "react";
import { useThemeStore } from "../store";
import { getActiveTheme, loadGoogleFont, resolveThemeCssVars } from "../lib/theme";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import { ErrorBoundary } from "../components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  const { customThemes, selectedThemeId, systemThemes, previewTheme } = useThemeStore();
  const activeTheme = previewTheme ?? getActiveTheme(customThemes, selectedThemeId);

  // "Suivre le système": keep selectedThemeId in step with the OS color scheme. Written via
  // setState, not selectTheme — selectTheme is the *manual* pick, which turns this off.
  useEffect(() => {
    if (!systemThemes) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => useThemeStore.setState({ selectedThemeId: query.matches ? systemThemes.dark : systemThemes.light });
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [systemThemes]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", activeTheme.mode === "dark");
    loadGoogleFont(activeTheme.fontFamily ?? "DM Sans");
    const vars = resolveThemeCssVars(activeTheme);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, [activeTheme]);

  useEffect(() => {
    // ponytail: dev-mode SW would intercept and re-cache every HMR/chunk
    // request on each recompile — that's the GET spam. Production only.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster theme={activeTheme.mode} />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
