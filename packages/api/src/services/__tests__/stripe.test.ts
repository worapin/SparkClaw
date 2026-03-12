import { describe, it, expect, mock, beforeEach } from "bun:test";
import type Stripe from "stripe";

// ---- Mocks ----

// Mock the DB: insert, update, and query operations
const mockReturning = mock(() => Promise.resolve([{ id: "sub_internal_1", userId: "u_1", plan: "pro" }]));
const mockInsertValues = mock(() => ({ returning: mockReturning }));
const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockUpdateWhere = mock(() => Promise.resolve());
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

const mockQueryFindFirst = mock(() =>
  Promise.resolve({ id: "sub_internal_1", userId: "u_1", plan: "pro" }),
);

const mockUsersFindFirst = mock(() =>
  Promise.resolve({ id: "u_1", email: "test@example.com" }),
);

const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
  query: {
    subscriptions: { findFirst: mockQueryFindFirst },
    users: { findFirst: mockUsersFindFirst },
  },
};

const mockSubscriptions = { stripeSubscriptionId: "stripeSubscriptionId", stripeCustomerId: "stripeCustomerId" };
const mockInstances = { subscriptionId: "subscriptionId" };
const mockUsers = { id: "id" };

mock.module("@sparkclaw/shared/db", () => ({
  db: mockDb,
  subscriptions: mockSubscriptions,
  instances: mockInstances,
  users: mockUsers,
}));

mock.module("drizzle-orm", () => ({
  eq: (col: string, val: string) => ({ col, val }),
}));

// Mock queueInstanceProvisioning
const mockQueueInstanceProvisioning = mock(() => Promise.resolve());
mock.module("../../services/queue.js", () => ({
  queueInstanceProvisioning: mockQueueInstanceProvisioning,
}));

// Mock logger
mock.module("../../lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

// Mock email service
mock.module("../../services/email.js", () => ({
  sendInstanceReadyEmail: mock(() => Promise.resolve(true)),
  sendErrorEmail: mock(() => Promise.resolve(true)),
  sendPaymentFailedEmail: mock(() => Promise.resolve(true)),
  sendSubscriptionCanceledEmail: mock(() => Promise.resolve(true)),
}));

// Mock Stripe (the module constructor and subscriptions.retrieve)
const mockStripeRetrieve = mock(() =>
  Promise.resolve({
    id: "sub_stripe_1",
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
  }),
);

mock.module("stripe", () => {
  return {
    default: class {
      subscriptions = { retrieve: mockStripeRetrieve };
      webhooks = { constructEvent: mock() };
      checkout = { sessions: { create: mock() } };
      billingPortal = { sessions: { create: mock() } };
    },
  };
});

mock.module("@sparkclaw/shared/constants", () => ({
  getStripePriceId: (plan: string) => `price_${plan}`,
}));

// ---- Import the module under test AFTER mocks are set up ----
const {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} = await import("../../services/stripe.js");

// ---- Tests ----

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  process.env.WEB_URL = "http://localhost:5173";
  process.env.REDIS_URL = "redis://localhost:6379";

  // Reset call counts
  mockReturning.mockClear();
  mockInsertValues.mockClear();
  mockInsert.mockClear();
  mockUpdateWhere.mockClear();
  mockUpdateSet.mockClear();
  mockUpdate.mockClear();
  mockQueryFindFirst.mockClear();
  mockQueueInstanceProvisioning.mockClear();
  mockStripeRetrieve.mockClear();
  mockUsersFindFirst.mockClear();
});

describe("handleCheckoutCompleted", () => {
  const fakeSession = {
    metadata: { userId: "u_1", plan: "pro" },
    subscription: "sub_stripe_1",
    customer: "cus_123",
  } as unknown as Stripe.Checkout.Session;

  it("inserts a new subscription into the DB", async () => {
    await handleCheckoutCompleted(fakeSession);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);

    const firstInsertCall = mockInsertValues.mock.calls.at(0) as unknown[] | undefined;
    const insertedValues = firstInsertCall?.[0] as Record<string, unknown> | undefined;
    expect(insertedValues).toBeDefined();
    if (!insertedValues) throw new Error("Expected inserted values to be present");
    expect(insertedValues.userId).toBe("u_1");
    expect(insertedValues.plan).toBe("pro");
    expect(insertedValues.stripeCustomerId).toBe("cus_123");
    expect(insertedValues.stripeSubscriptionId).toBe("sub_stripe_1");
    expect(insertedValues.status).toBe("active");
  });

  it("retrieves the Stripe subscription to get period end", async () => {
    await handleCheckoutCompleted(fakeSession);
    expect(mockStripeRetrieve).toHaveBeenCalledWith("sub_stripe_1");
  });

  it("queues instance provisioning with userId and subscriptionId", async () => {
    await handleCheckoutCompleted(fakeSession);

    // queueInstanceProvisioning is called asynchronously via .catch
    // Give the microtask queue a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(mockQueueInstanceProvisioning).toHaveBeenCalledWith("u_1", "sub_internal_1");
  });

  it("does nothing when metadata is missing userId", async () => {
    const noUser = { metadata: { plan: "pro" }, subscription: "sub_stripe_1", customer: "cus_x" } as unknown as Stripe.Checkout.Session;
    await handleCheckoutCompleted(noUser);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does nothing when metadata is missing plan", async () => {
    const noPlan = { metadata: { userId: "u_1" }, subscription: "sub_stripe_1", customer: "cus_x" } as unknown as Stripe.Checkout.Session;
    await handleCheckoutCompleted(noPlan);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionUpdated", () => {
  it("updates status to active when subscription is active", async () => {
    const sub = {
      id: "sub_stripe_1",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(sub);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);

    const firstUpdateCall = mockUpdateSet.mock.calls.at(0) as unknown[] | undefined;
    const setArg = firstUpdateCall?.[0] as Record<string, unknown> | undefined;
    expect(setArg).toBeDefined();
    if (!setArg) throw new Error("Expected update payload to be present");
    expect(setArg.status).toBe("active");
    expect(setArg.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it("updates status to past_due when subscription is not active", async () => {
    const sub = {
      id: "sub_stripe_1",
      status: "past_due",
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(sub);

    const firstUpdateCall = mockUpdateSet.mock.calls.at(0) as unknown[] | undefined;
    const setArg = firstUpdateCall?.[0] as Record<string, unknown> | undefined;
    expect(setArg).toBeDefined();
    if (!setArg) throw new Error("Expected update payload to be present");
    expect(setArg.status).toBe("past_due");
  });
});

describe("handleSubscriptionDeleted", () => {
  it("marks subscription as canceled in the DB", async () => {
    const sub = { id: "sub_stripe_1" } as unknown as Stripe.Subscription;

    await handleSubscriptionDeleted(sub);

    // First update call: set subscription status to canceled
    expect(mockUpdate).toHaveBeenCalled();
    const firstUpdateCall = mockUpdateSet.mock.calls.at(0) as unknown[] | undefined;
    const firstSetArg = firstUpdateCall?.[0] as Record<string, unknown> | undefined;
    expect(firstSetArg).toBeDefined();
    if (!firstSetArg) throw new Error("Expected first update payload to be present");
    expect(firstSetArg.status).toBe("canceled");
  });

  it("suspends associated instances when subscription exists", async () => {
    mockQueryFindFirst.mockImplementationOnce(() =>
      Promise.resolve({ id: "sub_internal_1", userId: "u_1", plan: "pro" }),
    );

    const sub = { id: "sub_stripe_1" } as unknown as Stripe.Subscription;
    await handleSubscriptionDeleted(sub);

    // Second update call: set instance status to suspended
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const secondUpdateCall = mockUpdateSet.mock.calls.at(1) as unknown[] | undefined;
    const secondSetArg = secondUpdateCall?.[0] as Record<string, unknown> | undefined;
    expect(secondSetArg).toBeDefined();
    if (!secondSetArg) throw new Error("Expected second update payload to be present");
    expect(secondSetArg.status).toBe("suspended");
  });

  it("does not update instances when subscription is not found", async () => {
    mockQueryFindFirst.mockImplementationOnce(() => Promise.resolve(undefined as any));

    const sub = { id: "sub_stripe_missing" } as unknown as Stripe.Subscription;
    await handleSubscriptionDeleted(sub);

    // Only 1 update call (the subscription status), no instance update
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
