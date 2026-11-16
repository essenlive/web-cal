import { describe, it, expect, beforeAll } from "vitest";
import { decryptSecret, encryptSecret } from "../../src/server/config/secrets";

describe("secrets", () => {
  beforeAll(() => { process.env.SECRET_KEY = "test-key"; });
  it("round-trips and does not leak the plaintext", () => {
    const enc = encryptSecret("hunter2");
    expect(enc).not.toContain("hunter2");
    expect(decryptSecret(enc)).toBe("hunter2");
  });
  it("fails to decrypt with another key", () => {
    const enc = encryptSecret("hunter2");
    process.env.SECRET_KEY = "other";
    expect(() => decryptSecret(enc)).toThrow();
    process.env.SECRET_KEY = "test-key";
  });
});
