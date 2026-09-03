/**
 * AES-GCM envelope encryption for sync payloads (WebCrypto, no library). The key comes
 * from link.ts's pairing link fragment and never touches the signaling broker — see
 * specs/.../plan for the threat model. A fresh random IV is generated per message.
 */

export interface Envelope {
  iv: string; // base64
  ciphertext: string; // base64
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptEnvelope(key: CryptoKey, data: unknown): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

/** Throws if `envelope` was tampered with or the key doesn't match (AES-GCM auth tag check) — callers must treat that as "drop the message", not apply partial data. */
export async function decryptEnvelope<T>(key: CryptoKey, envelope: Envelope): Promise<T> {
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
