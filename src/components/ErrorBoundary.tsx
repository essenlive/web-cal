"use client";

import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Root-level safety net — without this, an uncaught render error blanks the whole app to a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
          <p className="text-sm font-medium text-foreground">Une erreur est survenue.</p>
          <p className="max-w-sm text-xs text-muted-foreground">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
