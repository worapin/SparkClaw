import { describe, expect, test, afterEach } from "bun:test";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  test("allows requests under the limit", () => {
    limiter = new RateLimiter(3, 60_000);
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key1")).toBe(true);
  });

  test("blocks requests over the limit", () => {
    limiter = new RateLimiter(2, 60_000);
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key1")).toBe(false);
  });

  test("tracks keys independently", () => {
    limiter = new RateLimiter(1, 60_000);
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key2")).toBe(true);
    expect(limiter.check("key1")).toBe(false);
    expect(limiter.check("key2")).toBe(false);
  });

  test("returns correct remaining count", () => {
    limiter = new RateLimiter(3, 60_000);
    expect(limiter.remaining("key1")).toBe(3);
    limiter.check("key1");
    expect(limiter.remaining("key1")).toBe(2);
    limiter.check("key1");
    expect(limiter.remaining("key1")).toBe(1);
    limiter.check("key1");
    expect(limiter.remaining("key1")).toBe(0);
  });

  test("resets after window expires", async () => {
    limiter = new RateLimiter(1, 50);
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key1")).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.check("key1")).toBe(true);
  });
});
