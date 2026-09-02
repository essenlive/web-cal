import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DebugView } from "../components/debug/DebugView";

export function DebugPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="flex items-center h-14 px-4 border-b border-border bg-card shrink-0 gap-2">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-muted-foreground">
          <ArrowLeft size={16} />
          Calendrier
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-sm font-bold text-foreground">Debug</h1>
      </header>
      <main className="flex-1 overflow-auto">
        <DebugView />
      </main>
    </div>
  );
}
