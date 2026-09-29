import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** A settings card: title + description on the left, its control on the right, and optional
 *  extra content underneath (e.g. the theme pickers once "Suivre le système" is on). */
export function SettingRow({ title, description, control, children, className }: {
  title: string;
  description: ReactNode;
  control: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 rounded-lg bg-muted/50 px-3 py-2.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}
