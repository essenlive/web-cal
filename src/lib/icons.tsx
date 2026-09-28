import { lazy, Suspense, type ComponentType } from "react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

type IconSlug = keyof typeof dynamicIconImports;

// Mirrors lucide-react's own name derivation (createLucideIcon sets each
// component's `displayName` to `toPascalCase(kebabName)`), reimplemented here
// so we only need the tiny `dynamicIconImports` slug map — not the ~1750
// icon components themselves — to compute the same canonical names that are
// already stored on EventType.icon.
function toPascalCase(kebab: string): string {
  const camel = kebab.replace(/[\s-_]+(\w)/g, (_m, c: string) => c.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

const SLUGS = Object.keys(dynamicIconImports) as IconSlug[];

/** Every icon name usable with `getIconEl` — lucide-react's canonical PascalCase
 *  component names, e.g. "Users" or "SquareActivity" — sorted alphabetically. */
export const ALL_ICON_NAMES: string[] = SLUGS.map(toPascalCase).sort((a, b) => a.localeCompare(b));

const slugByName = new Map<string, IconSlug>(SLUGS.map((slug) => [toPascalCase(slug), slug]));

type IconComponent = ComponentType<{ size?: number; color?: string; className?: string }>;

const componentCache = new Map<IconSlug, IconComponent>();

function getIconComponent(slug: IconSlug) {
  let Component = componentCache.get(slug);
  if (!Component) {
    Component = lazy(dynamicIconImports[slug]) as unknown as IconComponent;
    componentCache.set(slug, Component);
  }
  return Component;
}

/**
 * Renders a lucide icon by name (as stored on EventType.icon and friends), or
 * nothing if the name is unrecognized. Each icon is code-split and fetched on
 * demand the first time its name is rendered anywhere — never the full icon
 * set — and cached afterwards, so re-rendering the same icon never re-fetches.
 */
export function getIconEl(name: string | undefined, size = 16, color?: string, className?: string) {
  const slug = name ? slugByName.get(name) : undefined;
  if (!slug) return null;
  const Icon = getIconComponent(slug);
  return (
    <Suspense fallback={null}>
      <Icon size={size} color={color} className={className} />
    </Suspense>
  );
}
