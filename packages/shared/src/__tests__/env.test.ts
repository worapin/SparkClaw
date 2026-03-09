import { describe, it, expect, beforeEach } from "bun:test";

// We need a fresh module for each test because validateEnv caches _env.
// We use dynamic import with cache busting via a helper.

// Save original env
const originalEnv = { ...process.env };

beforeEach(() => {
  // Restore original env vars before each test
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});

// Helper: get a fresh validateEnv by re-importing
async function freshValidateEnv() {
  // Bust the module cache by appending a query param with a timestamp
  const mod = await import(`../env.js?t=${Date.now()}-${Math.random()}`);
  return mod.validateEnv as () => ReturnType<typeof import("../env.js")["validateEnv"]>;
}

describe("validateEnv", () => {
  it("succeeds with defaults when no env vars are set", async () => {
    // All fields are optional or have defaults, so a bare environment should work.
    // Note: bun sets NODE_ENV=test automatically when running tests.
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();

    expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    expect(env.PORT).toBe(3000);
    expect(env.WEB_URL).toBe("http://localhost:5173");
    expect(env.CUSTOM_DOMAIN_ROOT).toBe("sparkclaw.io");
    expect(env.OPENCLAW_GITHUB_REPO).toBe("sparkclaw/openclaw-template");
  });

  it("applies default for SESSION_SECRET", async () => {
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();
    expect(env.SESSION_SECRET).toBe("dev-secret-change-in-production-min-32-chars");
  });

  it("coerces PORT from string to number", async () => {
    process.env.PORT = "8080";
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();
    expect(env.PORT).toBe(8080);
  });

  it("rejects invalid NODE_ENV values", async () => {
    process.env.NODE_ENV = "staging";
    const validateEnv = await freshValidateEnv();
    expect(() => validateEnv()).toThrow("Missing or invalid environment variables");
  });

  it("accepts valid NODE_ENV values", async () => {
    for (const valid of ["development", "production", "test"] as const) {
      process.env.NODE_ENV = valid;
      const validateEnv = await freshValidateEnv();
      const env = validateEnv();
      expect(env.NODE_ENV).toBe(valid);
    }
  });

  it("rejects SESSION_SECRET shorter than 8 chars", async () => {
    process.env.SESSION_SECRET = "short";
    const validateEnv = await freshValidateEnv();
    expect(() => validateEnv()).toThrow("Missing or invalid environment variables");
  });

  it("accepts a valid SESSION_SECRET of 8+ chars", async () => {
    process.env.SESSION_SECRET = "a-valid-session-secret-here";
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();
    expect(env.SESSION_SECRET).toBe("a-valid-session-secret-here");
  });

  it("rejects WEB_URL that is not a valid URL", async () => {
    process.env.WEB_URL = "not-a-url";
    const validateEnv = await freshValidateEnv();
    expect(() => validateEnv()).toThrow("Missing or invalid environment variables");
  });

  it("passes through optional string fields as undefined when not set", async () => {
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.RAILWAY_API_TOKEN).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });

  it("defaults POSTHOG_HOST to the US endpoint", async () => {
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();
    expect(env.POSTHOG_HOST).toBe("https://us.i.posthog.com");
  });

  it("defaults LANGFUSE_HOST to the cloud endpoint", async () => {
    const validateEnv = await freshValidateEnv();
    const env = validateEnv();
    expect(env.LANGFUSE_HOST).toBe("https://cloud.langfuse.com");
  });
});

describe("getEnv", () => {
  it("throws when called before validateEnv", async () => {
    const mod = await import(`../env.js?t=${Date.now()}-${Math.random()}`);
    expect(() => mod.getEnv()).toThrow("Environment not validated");
  });

  it("returns the cached env after validateEnv is called", async () => {
    const mod = await import(`../env.js?t=${Date.now()}-${Math.random()}`);
    const env1 = mod.validateEnv();
    const env2 = mod.getEnv();
    expect(env2).toBe(env1); // Same reference (cached)
  });
});
