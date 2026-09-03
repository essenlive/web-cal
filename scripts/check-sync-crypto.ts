/**
 * Self-check for the P2P sync envelope crypto (src/lib/sync/crypto.ts) — the one
 * security-relevant path in that feature. Run with:
 *   node --experimental-strip-types scripts/check-sync-crypto.ts
 * No test framework: this repo has no unit test runner, and this is a single
 * focused assertion script, not a suite.
 */
import assert from "node:assert/strict";
import { encryptEnvelope, decryptEnvelope } from "../src/lib/sync/crypto.ts";

async function main() {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const payload = { hello: "world", n: 42, nested: { ok: true } };

  const envelope = await encryptEnvelope(key, payload);
  const decrypted = await decryptEnvelope<typeof payload>(key, envelope);
  assert.deepEqual(decrypted, payload, "round-trip should return the original payload");

  const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + "AAAA" };
  await assert.rejects(() => decryptEnvelope(key, tampered), "tampered ciphertext must fail to decrypt, not silently return garbage");

  const wrongKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  await assert.rejects(() => decryptEnvelope(wrongKey, envelope), "decrypting with the wrong key must fail");

  const iv1 = (await encryptEnvelope(key, payload)).iv;
  const iv2 = (await encryptEnvelope(key, payload)).iv;
  assert.notEqual(iv1, iv2, "IV must be fresh per message, never reused");

  console.log("ok: sync crypto round-trips and rejects tampered/wrong-key envelopes");
}

main();
