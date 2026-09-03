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

/** Opens (initiate) or joins (join) a single-use room keyed by `roomId`. Returns a teardown function that closes the connection and unregisters the peer id. */
export function openPeerChannel(role: PeerRole, roomId: string, handlers: PeerChannelHandlers): () => void {
  const peer = role === "initiate" ? new Peer(roomId) : new Peer();
  let conn: DataConnection | undefined;
  let torn = false;

  function wireConnection(connection: DataConnection) {
    conn = connection;
    connection.on("open", () => handlers.onOpen({ send: (data) => void connection.send(data) }));
    connection.on("data", (data) => handlers.onMessage(data));
    connection.on("close", () => handlers.onClose());
    connection.on("error", (err) => handlers.onError(err.message, err.type));
  }

  peer.on("open", () => {
    if (role === "join") wireConnection(peer.connect(roomId, { reliable: true }));
  });
  peer.on("connection", (connection) => {
    if (role === "initiate") wireConnection(connection);
  });
  peer.on("error", (err) => {
    if (!torn) handlers.onError(err.message, err.type);
  });

  return function teardown() {
    torn = true;
    conn?.close();
    peer.destroy();
  };
}
