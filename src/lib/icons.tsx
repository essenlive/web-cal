import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Renders a lucide icon by name (as stored on EventType.icon and friends), or nothing if the name is unrecognized. */
export function getIconEl(name: string, size = 16, color?: string) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

/**
 * Every icon name usable with getIconEl, deduped from lucide-react's export
 * aliases (each icon is exported under several names, e.g. "Users", "UsersIcon",
 * "LucideUsers" — one canonical name is kept per icon), sorted alphabetically.
 */
export const ALL_ICON_NAMES: string[] = (() => {
  const byComponent = new Map<unknown, string[]>();
  for (const [name, value] of Object.entries(Icons)) {
    if (typeof value !== "object" || value === null) continue;
    const names = byComponent.get(value) ?? [];
    names.push(name);
    byComponent.set(value, names);
  }
  const canonicalNames: string[] = [];
  for (const names of byComponent.values()) {
    canonicalNames.push(names.find((n) => !n.startsWith("Lucide") && !n.endsWith("Icon")) ?? names[0]);
  }
  return canonicalNames.sort((a, b) => a.localeCompare(b));
})();
