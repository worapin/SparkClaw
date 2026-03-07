import { describe, expect, test } from "bun:test";
import { generateId, generateSecureToken, sha256 } from "../utils.js";

describe("generateId", () => {
  test("returns a valid UUID", () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("generateSecureToken", () => {
  test("returns 64-char hex string by default (32 bytes)", () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  test("supports custom byte length", () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32);
  });

  test("returns unique values", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("sha256", () => {
  test("returns 64-char hex hash", async () => {
    const hash = await sha256("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test("returns consistent hash for same input", async () => {
    const hash1 = await sha256("test");
    const hash2 = await sha256("test");
    expect(hash1).toBe(hash2);
  });

  test("returns different hash for different input", async () => {
    const hash1 = await sha256("hello");
    const hash2 = await sha256("world");
    expect(hash1).not.toBe(hash2);
  });
});
