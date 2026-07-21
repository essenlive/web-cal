"use client";

import { useEffect } from "react";
import { useUIStore } from "../store";

export function Providers({ children }: { children: React.ReactNode }) {
  const { darkMode } = useUIStore();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  return <>{children}</>;
}
