"use client";

/**
 * State machine hook behind the Sync tab (src/components/data/SyncTab.tsx):
 * idle -> waiting (initiator) / connecting (joiner) -> confirm -> done, or error
 * at any step. See specs/.../plan.md for the full flow.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { generateKey, generateRoomId, buildSyncLink, importKey } from "./link";
import { encryptEnvelope, decryptEnvelope, type Envelope } from "./crypto";
import { openPeerChannel, type PeerChannel } from "./peer";
import { captureBundle, applyBundle, isSettingsBundle, type SettingsBundle } from "./bundle";
import { getSettingsUpdatedAt } from "./clock";

const WAIT_TIMEOUT_MS = 5 * 60 * 1000;

export type SyncStatus =
  | { phase: "idle" }
  | { phase: "waiting"; link: string }
  | { phase: "connecting" }
  | { phase: "confirm"; incomingUpdatedAt: number; localUpdatedAt: number }
  | { phase: "done"; applied: boolean }
  | { phase: "error"; message: string };

function errorMessage(message: string, type?: string): string {
  if (type === "peer-unavailable") return "Ce lien n'est plus valable (déjà utilisé, expiré, ou l'autre appareil n'est plus là).";
  if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
    return "Impossible de joindre le service de connexion — vérifiez votre connexion internet.";
  }
  return `Erreur de connexion : ${message}${type ? ` (${type})` : ""}`;
}

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>({ phase: "idle" });
  const teardownRef = useRef<(() => void) | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const channelRef = useRef<PeerChannel | null>(null);
  const incomingRef = useRef<SettingsBundle | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cleanup = useCallback(() => {
    clearTimeout(timeoutRef.current);
    teardownRef.current?.();
    teardownRef.current = null;
    channelRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const onOpen = useCallback((channel: PeerChannel) => {
    clearTimeout(timeoutRef.current);
    channelRef.current = channel;
    setStatus({ phase: "connecting" });
    const key = keyRef.current!;
    encryptEnvelope(key, captureBundle()).then((envelope) => channel.send(envelope));
  }, []);

  const onMessage = useCallback(async (data: unknown) => {
    const key = keyRef.current;
    if (!key) return;
    try {
      const bundle = await decryptEnvelope<SettingsBundle>(key, data as Envelope);
      if (!isSettingsBundle(bundle)) throw new Error("malformed bundle");
      // Always let the person choose, on both ends — don't auto-discard just because
      // the local clock looks newer, since that clock can lag behind a real edit.
      // incomingUpdatedAt/localUpdatedAt are shown as a hint, not a verdict.
      incomingRef.current = bundle;
      setStatus({ phase: "confirm", incomingUpdatedAt: bundle.updatedAt, localUpdatedAt: getSettingsUpdatedAt() });
    } catch {
      setStatus({ phase: "error", message: "Message reçu invalide ou corrompu — synchronisation annulée." });
      cleanup();
    }
  }, [cleanup]);

  const onError = useCallback(
    (message: string, type?: string) => {
      setStatus({ phase: "error", message: errorMessage(message, type) });
      cleanup();
    },
    [cleanup]
  );

  const onClose = useCallback(() => {
    setStatus((s) => (s.phase === "confirm" || s.phase === "done" || s.phase === "error" ? s : { phase: "idle" }));
  }, []);

  const begin = useCallback(
    (role: "initiate" | "join", roomId: string, key: CryptoKey) => {
      cleanup();
      keyRef.current = key;
      teardownRef.current = openPeerChannel(role, roomId, { onOpen, onMessage, onClose, onError });
    },
    [cleanup, onOpen, onMessage, onClose, onError]
  );

  const start = useCallback(async () => {
    const roomId = generateRoomId();
    const key = await generateKey();
    const link = await buildSyncLink(roomId, key);
    setStatus({ phase: "waiting", link });
    begin("initiate", roomId, key);
    timeoutRef.current = setTimeout(
      () => setStatus({ phase: "error", message: "Personne ne s'est connecté — générez un nouveau lien." }),
      WAIT_TIMEOUT_MS
    );
  }, [begin]);

  const join = useCallback(
    async (roomId: string, keyParam: string) => {
      setStatus({ phase: "connecting" });
      const key = await importKey(keyParam);
      begin("join", roomId, key);
    },
    [begin]
  );

  const applyIncoming = useCallback(() => {
    if (incomingRef.current) applyBundle(incomingRef.current);
    setStatus({ phase: "done", applied: true });
    cleanup();
  }, [cleanup]);

  const keepLocal = useCallback(() => {
    setStatus({ phase: "done", applied: false });
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setStatus({ phase: "idle" });
  }, [cleanup]);

  return { status, start, join, applyIncoming, keepLocal, reset };
}
