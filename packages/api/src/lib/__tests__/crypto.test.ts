import { describe, it, expect, beforeEach } from "bun:test";
import { encrypt, decrypt, encryptJson, decryptJson, sha256, generateToken, generateApiKey } from "../crypto.js";

// Ensure encryption key is available for all tests
beforeEach(() => {
  process.env.ENCRYPTION_SECRET = "test-encryption-secret-for-unit-tests";
});

describe("encrypt / decrypt", () => {
  it("round-trips a plain string", () => {
    const plaintext = "hello world";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const ciphertext = encrypt("");
    expect(decrypt(ciphertext)).toBe("");
  });

  it("round-trips unicode content", () => {
    const plaintext = "emoji: \u{1F680} and CJK: \u4F60\u597D";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a).not.toBe(b);
    // Both still decrypt to the original
    expect(decrypt(a)).toBe("same input");
    expect(decrypt(b)).toBe("same input");
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encrypt("sensitive");
    // Flip a character in the middle of the base64 string
    const tampered =
      ciphertext.slice(0, 10) +
      (ciphertext[10] === "A" ? "B" : "A") +
      ciphertext.slice(11);
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe("encryptJson / decryptJson", () => {
  it("round-trips a simple object", () => {
    const data = { userId: "u_123", role: "admin", count: 42 };
    const ciphertext = encryptJson(data);
    expect(typeof ciphertext).toBe("string");
    const decrypted = decryptJson<typeof data>(ciphertext);
    expect(decrypted).toEqual(data);
  });

  it("round-trips nested objects and arrays", () => {
    const data = { items: [1, 2, 3], nested: { ok: true } };
    expect(decryptJson(encryptJson(data))).toEqual(data);
  });
});

describe("sha256", () => {
  it("returns a 64-char hex string", () => {
    const hash = sha256("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("produces consistent output for the same input", () => {
    expect(sha256("deterministic")).toBe(sha256("deterministic"));
  });

  it("produces different output for different inputs", () => {
    expect(sha256("aaa")).not.toBe(sha256("bbb"));
  });

  it("matches a known SHA-256 digest", () => {
    // SHA-256 of empty string is well-known
    expect(sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("generateToken", () => {
  it("returns a 64-char hex string by default (32 bytes)", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("respects custom byte length", () => {
    const token = generateToken(16);
    expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("generateApiKey", () => {
  it("returns key, prefix, and hash", () => {
    const result = generateApiKey();
    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("prefix");
    expect(result).toHaveProperty("hash");
  });

  it("key starts with sk_live_ prefix", () => {
    const { key } = generateApiKey();
    expect(key.startsWith("sk_live_")).toBe(true);
  });

  it("prefix is the first 12 characters of the key", () => {
    const { key, prefix } = generateApiKey();
    expect(prefix).toBe(key.slice(0, 12));
  });

  it("hash is the SHA-256 of the full key", () => {
    const { key, hash } = generateApiKey();
    expect(hash).toBe(sha256(key));
  });

  it("generates unique keys each time", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });
});
