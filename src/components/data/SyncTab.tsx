"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCircle, Check, Copy, Link2, Loader2, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "../ui/button";
import { useSync } from "../../lib/sync/useSync";
import { parseSyncHash } from "../../lib/sync/link";

function QRCodeImage({ link }: { link: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (!dataUrl) return <div className="size-[220px] rounded-lg bg-muted animate-pulse" />;
  return <img src={dataUrl} alt="QR code du lien de synchronisation" width={220} height={220} className="rounded-lg border border-border" />;
}

export function SyncTab() {
  const { status, start, join, applyIncoming, keepLocal, reset } = useSync();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const parsed = parseSyncHash(window.location.hash);
    if (parsed) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      join(parsed.roomId, parsed.keyParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only, from the URL at load time
  }, []);

  async function handleCopy(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Transfère vos réglages vers un autre appareil par le serveur Overcal, qui ne relaie que des données chiffrées de bout en bout (la clé reste dans le lien) et ne les garde que quelques minutes, pour synchroniser sources, types d&rsquo;événements, règles, presets, thèmes et préférences. La version la plus récente des deux appareils l&rsquo;emporte.
      </p>

      {status.phase === "idle" && (
        <Button onClick={() => start()}>
          <Link2 /> Générer un lien de synchronisation
        </Button>
      )}

      {status.phase === "waiting" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <QRCodeImage link={status.link} />
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                Scannez ce code avec l&rsquo;autre appareil, ou partagez le lien ci-dessous.
              </p>
              <div className="flex gap-1.5">
                <code className="flex-1 min-w-0 truncate text-xs bg-muted rounded px-2 py-1.5">{status.link}</code>
                <Button variant="outline" size="icon" onClick={() => handleCopy(status.link)} aria-label="Copier le lien">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> En attente de l&rsquo;autre appareil…
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>Annuler</Button>
            </div>
          </div>
        </div>
      )}

      {status.phase === "connecting" && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin" /> Connexion à l&rsquo;autre appareil…
        </p>
      )}

      {status.phase === "confirm" && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm text-foreground">
            Réglages reçus de l&rsquo;autre appareil ({format(status.incomingUpdatedAt, "d MMM HH:mm:ss", { locale: fr })}
            {status.localUpdatedAt > 0 && <> — les vôtres datent du {format(status.localUpdatedAt, "d MMM HH:mm:ss", { locale: fr })}</>}).
            {status.incomingUpdatedAt > status.localUpdatedAt ? " Ils sont plus récents que les vôtres." : " Les vôtres sont plus récents."}
          </p>
          <p className="text-xs text-muted-foreground">Appliquer les réglages reçus remplacera entièrement ceux de cet appareil.</p>
          <div className="flex gap-2">
            <Button onClick={applyIncoming}>Récupérer les réglages reçus</Button>
            <Button variant="outline" onClick={keepLocal}>Garder mes réglages</Button>
          </div>
        </div>
      )}

      {status.phase === "done" && (
        <p className="text-sm text-foreground flex items-center gap-1.5">
          <Check size={16} className="text-green-600 dark:text-green-400" />
          {status.applied ? "Réglages reçus et appliqués." : "Vos réglages ont été conservés."}
        </p>
      )}

      {status.phase === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle size={16} /> {status.message}
          </p>
          <Button variant="outline" onClick={reset}>
            <RefreshCw size={16} /> Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
