import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock getEnv to return a controlled CUSTOM_DOMAIN_ROOT
const mockGetEnv = mock(() => ({
  CUSTOM_DOMAIN_ROOT: "test.sparkclaw.io",
}));

mock.module("@sparkclaw/shared", () => ({
  getEnv: mockGetEnv,
}));

// Mock transitive dependencies pulled by railway.js
mock.module("@sparkclaw/shared/db", () => ({
  db: { insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }), update: () => ({ set: () => ({ where: () => Promise.resolve() }) }), query: { users: { findFirst: () => Promise.resolve(null) }, subscriptions: { findFirst: () => Promise.resolve(null) }, instances: { findFirst: () => Promise.resolve(null) } } },
  instances: {},
  users: {},
  subscriptions: {},
}));

mock.module("drizzle-orm", () => ({
  eq: () => ({}),
}));

mock.module("../../services/openclaw.js", () => ({
  configureOpenClaw: () => Promise.resolve({ success: true }),
}));

mock.module("../../services/email.js", () => ({
  sendInstanceReadyEmail: () => Promise.resolve(true),
  sendErrorEmail: () => Promise.resolve(true),
  sendSubscriptionCanceledEmail: () => Promise.resolve(true),
  sendPaymentFailedEmail: () => Promise.resolve(true),
  sendAccountDeletedEmail: () => Promise.resolve(true),
}));

mock.module("../../lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

mock.module("@sparkclaw/shared/constants", () => ({
  INSTANCE_POLL_INTERVAL_MS: 100,
  INSTANCE_POLL_MAX_ATTEMPTS: 1,
  INSTANCE_PROVISION_MAX_RETRIES: 1,
}));

// Import after mocks
const { generateCustomDomain } = await import("../../services/railway.js");

beforeEach(() => {
  mockGetEnv.mockClear();
});

describe("generateCustomDomain", () => {
  it("produces a domain in the format claw-<8chars>.<root>", () => {
    const instanceId = "a1b2c3d4-e5f6-7890-abcd-ef0123456789";
    const domain = generateCustomDomain(instanceId);
    expect(domain).toBe("claw-a1b2c3d4.test.sparkclaw.io");
  });

  it("lowercases the subdomain portion", () => {
    const instanceId = "ABCDEF01-upper-case-test-000000000000";
    const domain = generateCustomDomain(instanceId);
    expect(domain).toBe("claw-abcdef01.test.sparkclaw.io");
  });

  it("uses the first 8 characters of the instanceId", () => {
    const instanceId = "12345678-rest-does-not-matter";
    const domain = generateCustomDomain(instanceId);
    expect(domain.startsWith("claw-12345678.")).toBe(true);
  });

  it("appends the CUSTOM_DOMAIN_ROOT from env", () => {
    mockGetEnv.mockImplementation(() => ({
      CUSTOM_DOMAIN_ROOT: "custom.example.com",
    }));

    const domain = generateCustomDomain("aaaabbbb-cccc");
    expect(domain).toBe("claw-aaaabbbb.custom.example.com");
  });

  it("calls getEnv to retrieve the domain root", () => {
    generateCustomDomain("anything1-2345");
    expect(mockGetEnv).toHaveBeenCalled();
  });
});
