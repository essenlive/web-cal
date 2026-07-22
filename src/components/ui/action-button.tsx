"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

type Status = "idle" | "armed" | "pending" | "success" | "error";

export interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Runs when triggered. May return a promise — while it's pending the button shows `pendingChildren`. */
  onAction: () => void | Promise<void>;
  /** Require an extra click to arm (destructive variant) before `onAction` runs. Default true, for destructive actions. */
  confirm?: boolean;
  /** Content shown once armed (only reachable when `confirm`). Defaults to `children`. */
  confirmChildren?: React.ReactNode;
  /** aria-label/title shown once armed. Defaults to the idle values. */
  confirmLabel?: string;
  /** Content shown while `onAction` is pending. Defaults to a spinning icon. */
  pendingChildren?: React.ReactNode;
  /** Content shown after `onAction` resolves. Defaults to a check icon. */
  successChildren?: React.ReactNode;
  /** Content shown after `onAction` rejects. Defaults to an alert icon. Can render the thrown error. */
  errorChildren?: React.ReactNode | ((error: unknown) => React.ReactNode);
  /** How long success/error stay visible before reverting to idle, in ms. Default 2500; 0 disables the revert. */
  revertMs?: number;
}

const DEFAULT_REVERT_MS = 2500;

/**
 * A button that owns its own destructive-confirm and async-status lifecycle:
 * idle -> (armed, if `confirm`) -> pending -> success/error -> idle. Same
 * element and shape throughout — only content/variant change.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      onAction,
      confirm = true,
      confirmChildren,
      confirmLabel,
      pendingChildren,
      successChildren,
      errorChildren,
      revertMs = DEFAULT_REVERT_MS,
      children,
      variant,
      className,
      onBlur,
      disabled,
      "aria-label": ariaLabel,
      title,
      ...props
    },
    ref
  ) => {
    const [status, setStatus] = React.useState<Status>("idle");
    const [error, setError] = React.useState<unknown>(null);
    const revertTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    React.useEffect(() => () => clearTimeout(revertTimer.current), []);

    async function run() {
      clearTimeout(revertTimer.current);
      setStatus("pending");
      try {
        await onAction();
        setStatus("success");
      } catch (err) {
        setError(err);
        setStatus("error");
      } finally {
        if (revertMs > 0) revertTimer.current = setTimeout(() => setStatus("idle"), revertMs);
      }
    }

    return (
      <Button
        ref={ref}
        type="button"
        variant={status === "armed" ? "destructive" : variant}
        data-status={status}
        disabled={disabled || status === "pending"}
        aria-label={status === "armed" ? confirmLabel ?? ariaLabel : ariaLabel}
        title={status === "armed" ? confirmLabel ?? title : title}
        className={cn(
          status === "success" && "text-green-600 dark:text-green-400",
          status === "error" && "text-destructive",
          className
        )}
        onBlur={(e) => {
          if (status === "armed") setStatus("idle");
          onBlur?.(e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (status === "armed") {
            run();
          } else if (status !== "pending") {
            if (confirm) setStatus("armed");
            else run();
          }
        }}
        {...props}
      >
        {status === "pending" && (pendingChildren ?? <RefreshCw className="animate-spin" />)}
        {status === "success" && (successChildren ?? <CheckCircle2 />)}
        {status === "error" &&
          ((typeof errorChildren === "function" ? errorChildren(error) : errorChildren) ?? <AlertCircle />)}
        {status === "armed" && (confirmChildren ?? children)}
        {status === "idle" && children}
      </Button>
    );
  }
);
ActionButton.displayName = "ActionButton";
