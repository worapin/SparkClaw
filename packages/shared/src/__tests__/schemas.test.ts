import { describe, expect, test } from "bun:test";
import { emailSchema, otpCodeSchema, planSchema, sendOtpSchema, verifyOtpSchema, createCheckoutSchema } from "../schemas.js";

describe("emailSchema", () => {
  test("accepts valid email", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  test("rejects invalid email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  test("rejects email exceeding 255 chars", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    expect(emailSchema.safeParse(longEmail).success).toBe(false);
  });
});

describe("otpCodeSchema", () => {
  test("accepts 6-digit code", () => {
    expect(otpCodeSchema.safeParse("123456").success).toBe(true);
  });

  test("rejects non-numeric code", () => {
    expect(otpCodeSchema.safeParse("abcdef").success).toBe(false);
  });

  test("rejects wrong length", () => {
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
    expect(otpCodeSchema.safeParse("1234567").success).toBe(false);
  });
});

describe("planSchema", () => {
  test("accepts valid plans", () => {
    expect(planSchema.safeParse("starter").success).toBe(true);
    expect(planSchema.safeParse("pro").success).toBe(true);
    expect(planSchema.safeParse("scale").success).toBe(true);
  });

  test("rejects invalid plan", () => {
    expect(planSchema.safeParse("enterprise").success).toBe(false);
  });
});

describe("sendOtpSchema", () => {
  test("accepts valid input", () => {
    expect(sendOtpSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  test("rejects missing email", () => {
    expect(sendOtpSchema.safeParse({}).success).toBe(false);
  });
});

describe("verifyOtpSchema", () => {
  test("accepts valid input", () => {
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", code: "123456" }).success).toBe(true);
  });

  test("rejects invalid code", () => {
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", code: "abc" }).success).toBe(false);
  });
});

describe("createCheckoutSchema", () => {
  test("accepts valid plan", () => {
    expect(createCheckoutSchema.safeParse({ plan: "pro" }).success).toBe(true);
  });

  test("rejects invalid plan", () => {
    expect(createCheckoutSchema.safeParse({ plan: "free" }).success).toBe(false);
  });
});
