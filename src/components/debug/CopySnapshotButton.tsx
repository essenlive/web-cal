import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";

/**
 * Copies a JSON snapshot of the *calling panel's own data* — scoped to whichever
 * tab it's rendered in, never the whole debug page. `context` is a plain-English
 * paragraph baked into the payload so the JSON is self-explanatory when pasted
 * into an AI chat with no other context: what app this is, what each field means,
 * and any domain rules needed to reason about it (e.g. rule priority order).
 */
export function CopySnapshotButton({ context, data }: { context: string; data: Record<string, unknown> }) {
  const copy = async () => {
    const snapshot = { context, generatedAt: new Date().toISOString(), ...data };
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success("Instantané copié dans le presse-papiers.");
    } catch {
      toast.error("Impossible de copier l'instantané.");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 shrink-0">
      <Copy size={12} />
      Copier
    </Button>
  );
}
