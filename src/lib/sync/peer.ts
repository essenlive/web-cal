/**
 * Thin transport wrapper over PeerJS (WebRTC DataChannel + the public signaling
 * broker). The broker only ever sees peer ids and opaque SDP/ICE blobs — never the
 * encryption key or synced data.
 *
 * `roomId` doubles as the room concept: the initiator registers it as its own peer
 * id on the broker, and the joiner connects directly to that id. That's the whole
 * rendezvous — no separate signaling protocol needed. Destroying the Peer after use
 * unregisters the id, making the link single-use.
 */

import Peer, { type DataConnection } from "peerjs";

export type PeerRole = "initiate" | "join";

// PeerJS's default RTCPeerConnection config is STUN-only, which fails to negotiate
// ("Negotiation of connection to X failed") whenever either device is behind a NAT
// STUN can't traverse alone (symmetric NAT, mobile carrier CGNAT, some corporate
// Wi-Fi). Free-tier ExpressTURN relay (EU) as a fallback — see https://www.expressturn.com/.
// These are TURN long-term credentials, meant to ship in client code (the browser
// has to have them to connect) — not a backend secret. They do draw against the
// account's free 1000GB/mo quota, so if usage ever grows past that, swap for a
// paid tier or self-hosted coturn.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    // Bare URL, no ?transport= query param — verified working via trickle-ICE
    // (produces a relay candidate); the transport-qualified variants didn't.
    urls: "turn:free.expressturn.com:3478",
    username: "000000002103795088",
    credential: "wi2MYUdkh+TmNT+ht0OYO/11a9A=",
  },
];

export interface PeerChannel {
  send(data: unknown): void;
}

export interface PeerChannelHandlers {
  onOpen: (channel: PeerChannel) => void;
  onMessage: (data: unknown) => void;
  onClose: () => void;
  /** `type` is PeerJS's PeerErrorType/DataConnectionErrorType string, e.g. "peer-unavailable" when the room doesn't exist (never opened, expired, or already used). */
  onError: (message: string, type?: string) => void;
}

// ponytail: console-only diagnostics for tracking down WebRTC negotiation failures
// (ICE candidate types gathered, connection state transitions, raw PeerJS errors) —
// remove once P2P sync is confirmed working across real-world networks.
function debug(...args: unknown[]) {
  // console.debug is hidden by default in most devtools consoles — use log instead so it's never filtered out.
  console.log("[sync]", ...args);
}

/** Opens (initiate) or joins (join) a single-use room keyed by `roomId`. Returns a teardown function that closes the connection and unregisters the peer id. */
export function openPeerChannel(role: PeerRole, roomId: string, handlers: PeerChannelHandlers): () => void {
  const peerOptions = { config: { iceServers: ICE_SERVERS }, debug: 2 as const };
  const peer = role === "initiate" ? new Peer(roomId, peerOptions) : new Peer(peerOptions);
  let conn: DataConnection | undefined;
  let torn = false;

  function wireConnection(connection: DataConnection) {
    conn = connection;
    debug("connection object created", { peer: connection.peer, reliable: connection.reliable });

    const pc = connection.peerConnection;
    if (pc) {
      pc.addEventListener("iceconnectionstatechange", () => debug("iceConnectionState ->", pc.iceConnectionState));
      pc.addEventListener("icegatheringstatechange", () => debug("iceGatheringState ->", pc.iceGatheringState));
      pc.addEventListener("connectionstatechange", () => debug("connectionState ->", pc.connectionState));
      pc.addEventListener("icecandidate", (e) => {
        if (e.candidate) debug("ICE candidate", { type: e.candidate.type, protocol: e.candidate.protocol, address: e.candidate.address });
        else debug("ICE gathering complete");
      });
      pc.addEventListener("icecandidateerror", (e) => {
        const err = e as RTCPeerConnectionIceErrorEvent;
        debug("ICE candidate error", { url: err.url, errorCode: err.errorCode, errorText: err.errorText });
      });
    } else {
      debug("no underlying RTCPeerConnection found on DataConnection — can't attach ICE diagnostics");
    }

    connection.on("open", () => {
      debug("data channel open");
      handlers.onOpen({ send: (data) => void connection.send(data) });
    });
    connection.on("data", (data) => handlers.onMessage(data));
    connection.on("close", () => {
      debug("data channel closed");
      handlers.onClose();
    });
    connection.on("error", (err) => {
      debug("connection error", err);
      handlers.onError(err.message, err.type);
    });
  }

  peer.on("open", (id) => {
    debug("peer open, id =", id);
    if (role === "join") wireConnection(peer.connect(roomId, { reliable: true }));
  });
  peer.on("connection", (connection) => {
    debug("incoming connection from", connection.peer);
    if (role === "initiate") wireConnection(connection);
  });
  peer.on("disconnected", () => debug("peer disconnected from signaling server"));
  peer.on("close", () => debug("peer closed"));
  peer.on("error", (err) => {
    debug("peer error", err);
    if (!torn) handlers.onError(err.message, err.type);
  });

  return function teardown() {
    torn = true;
    conn?.close();
    peer.destroy();
  };
}
