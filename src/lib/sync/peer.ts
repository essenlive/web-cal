/**
 * Transport for device-to-device sync through the Overcal server's relay
 * (/api/relay/<room>/<slot>, see src/server/relay.ts). Same contract as the former
 * WebRTC channel: the payload handed to `send` is already encrypted (crypto.ts), so the
 * relay only ever stores ciphertext, read-once, for a few minutes.
 *
 * Roles: the initiator ("init") waits until the joiner posts its envelope, then opens the
 * channel and replies; the joiner ("join") opens immediately, posts, then waits for the reply.
 */

export type PeerRole = "initiate" | "join";

export interface PeerChannel {
  send(data: unknown): void;
}

export interface PeerChannelHandlers {
  onOpen: (channel: PeerChannel) => void;
  onMessage: (data: unknown) => void;
  onClose: () => void;
  /** `type` is "unavailable" when the server has no relay (e.g. a static client-only host), "timeout" when the other device never answered. */
  onError: (message: string, type?: string) => void;
}

const POLL_MS = 1500;
const JOIN_TIMEOUT_MS = 2 * 60 * 1000;

/** Opens (initiate) or joins (join) a single-use room. Returns a teardown function that stops polling. */
export function openPeerChannel(role: PeerRole, roomId: string, handlers: PeerChannelHandlers, base = ""): () => void {
  const mine = role === "initiate" ? "init" : "join";
  const theirs = role === "initiate" ? "join" : "init";
  const url = (slot: string) => `${base}/api/relay/${roomId}/${slot}`;
  let torn = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();

  const channel: PeerChannel = {
    send(data) {
      fetch(url(mine), { method: "PUT", body: JSON.stringify(data) }).then((r) => {
        if (!r.ok && !torn) handlers.onError(`relais indisponible (${r.status})`, r.status === 404 ? "unavailable" : "network");
      }, () => !torn && handlers.onError("réseau", "network"));
    },
  };

  async function poll() {
    if (torn) return;
    try {
      const res = await fetch(url(theirs), { cache: "no-store" });
      if (torn) return;
      if (res.status === 404 || res.status === 405) return handlers.onError("pas de relais sur ce serveur", "unavailable");
      if (!res.ok && res.status !== 204) return handlers.onError(`relais indisponible (${res.status})`, "network");
      if (res.status === 200) {
        const data = await res.json();
        if (torn) return;
        if (role === "initiate") handlers.onOpen(channel);
        handlers.onMessage(data);
        return;
      }
      if (role === "join" && Date.now() - startedAt > JOIN_TIMEOUT_MS) return handlers.onError("délai dépassé", "timeout");
    } catch {
      if (!torn) return handlers.onError("réseau", "network");
    }
    timer = setTimeout(poll, POLL_MS);
  }

  if (role === "join") handlers.onOpen(channel);
  timer = setTimeout(poll, role === "join" ? POLL_MS : 0);

  return function teardown() {
    torn = true;
    clearTimeout(timer);
  };
}
