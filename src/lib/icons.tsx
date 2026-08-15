import * as Icons from "lucide-react";

/** Renders a lucide icon by name (as stored on EventType.icon and friends), or nothing if the name is unrecognized. */
export function getIconEl(name: string, size = 16, color?: string) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}
