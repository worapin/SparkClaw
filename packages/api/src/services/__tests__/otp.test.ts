import { describe, expect, test } from "bun:test";
import { generateOtp, hashOtp } from "../otp.js";

describe("generateOtp", () => {
  test("returns 6-digit string", () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  test("returns different codes", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtp()));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("hashOtp", () => {
  test("returns 64-char hex string", async () => {
    const hash = await hashOtp("123456");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test("same input gives same hash", async () => {
    const h1 = await hashOtp("123456");
    const h2 = await hashOtp("123456");
    expect(h1).toBe(h2);
  });

  test("different input gives different hash", async () => {
    const h1 = await hashOtp("123456");
    const h2 = await hashOtp("654321");
    expect(h1).not.toBe(h2);
  });
});
