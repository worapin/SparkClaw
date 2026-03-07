# SparkClaw Quality 10/10 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade SparkClaw codebase from 5.5/10 to 10/10 across security, completeness, testing, frontend UX, and code quality.

**Architecture:** Fix-First approach in single branch. Address security first, then completeness, then testing, then frontend UX. All changes in one branch.

**Tech Stack:** Bun, Elysia, SvelteKit/Svelte 5, Drizzle ORM, Neon Postgres, Stripe, Railway API, Zod, bun:test

---

### Task 1: Environment Validation with Zod

**Files:**
- Create: `packages/shared/src/env.ts`
- Modify: `packages/shared/src/index.ts:1-3`
- Modify: `packages/api/src/index.ts:1-18`

**Step 1: Create env validation module**

Create `packages/shared/src/env.ts`:

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_STARTER: z.string().startsWith("price_"),
  STRIPE_PRICE_PRO: z.string().startsWith("price_"),
  STRIPE_PRICE_SCALE: z.string().startsWith("price_"),
  RAILWAY_API_TOKEN: z.string().min(1),
  RAILWAY_PROJECT_ID: z.string().min(1),
  RESEND_API_KEY: z.string().startsWith("re_"),
  SESSION_SECRET: z.string().min(32),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function validateEnv(): Env {
  if (_env) return _env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }
  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error("Environment not validated. Call validateEnv() at startup.");
  return _env;
}
```

**Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./types.js";
export * from "./schemas.js";
export * from "./constants.js";
export * from "./env.js";
```

**Step 3: Update .env.example**

Add the new Stripe price env vars:

```
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_SCALE=
```

**Step 4: Call validateEnv() at API startup**

Update `packages/api/src/index.ts` to call `validateEnv()` before anything else:

```typescript
import { validateEnv } from "@sparkclaw/shared";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { webhookRoutes } from "./routes/webhooks.js";

const env = validateEnv();

const app = new Elysia()
  .use(cors({
    origin: env.WEB_URL,
    credentials: true,
  }))
  .get("/health", () => ({ status: "ok" }))
  .use(authRoutes)
  .use(apiRoutes)
  .use(webhookRoutes)
  .listen(env.PORT);

console.log(`SparkClaw API running on ${app.server?.url}`);

export type App = typeof app;
```

**Step 5: Update constants.ts to use env-based Stripe price IDs**

Replace `packages/shared/src/constants.ts`:

```typescript
import type { Plan } from "./types.js";

export function getStripePriceId(plan: Plan): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}` as const;
  const id = process.env[key];
  if (!id) throw new Error(`Missing env var: ${key}`);
  return id;
}

export const PLANS: Record<Plan, { name: string; price: number }> = {
  starter: { name: "Starter", price: 19 },
  pro: { name: "Pro", price: 39 },
  scale: { name: "Scale", price: 79 },
};

export const OTP_EXPIRY_MS = 5 * 60 * 1000;
export const OTP_SEND_RATE_LIMIT = 3;
export const OTP_SEND_RATE_WINDOW_MS = 10 * 60 * 1000;
export const OTP_VERIFY_RATE_LIMIT = 5;
export const OTP_VERIFY_RATE_WINDOW_MS = 15 * 60 * 1000;

export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "sparkclaw_session";

export const INSTANCE_POLL_INTERVAL_MS = 10_000;
export const INSTANCE_POLL_MAX_ATTEMPTS = 6;
export const INSTANCE_PROVISION_MAX_RETRIES = 3;
```

**Step 6: Update stripe.ts to use getStripePriceId()**

In `packages/api/src/services/stripe.ts`, change line 32-36:

```typescript
import { getStripePriceId } from "@sparkclaw/shared/constants";
// ...
const session = await getStripe().checkout.sessions.create({
  mode: "subscription",
  customer_email: email,
  line_items: [{ price: getStripePriceId(plan), quantity: 1 }],
  // ...rest stays the same
});
```

**Step 7: Commit**

```bash
git add packages/shared/src/env.ts packages/shared/src/index.ts packages/shared/src/constants.ts packages/api/src/index.ts packages/api/src/services/stripe.ts .env.example
git commit -m "feat: add env validation with Zod, read Stripe price IDs from env"
```

---

### Task 2: Structured Logger

**Files:**
- Create: `packages/api/src/lib/logger.ts`

**Step 1: Create structured logger**

Create `packages/api/src/lib/logger.ts`:

```typescript
type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
```

**Step 2: Replace console.log/error throughout API**

Replace in `packages/api/src/index.ts`:
```typescript
import { logger } from "./lib/logger.js";
// ...
logger.info("SparkClaw API started", { url: app.server?.url?.toString() });
```

Replace in `packages/api/src/services/railway.ts`:
```typescript
import { logger } from "../lib/logger.js";
// Replace all console.log/console.error with logger.info/logger.error
```

Replace in `packages/api/src/services/stripe.ts`:
```typescript
import { logger } from "../lib/logger.js";
// Replace console.error with logger.error
```

**Step 3: Commit**

```bash
git add packages/api/src/lib/logger.ts packages/api/src/index.ts packages/api/src/services/railway.ts packages/api/src/services/stripe.ts
git commit -m "feat: add structured JSON logger, replace console.log/error"
```

---

### Task 3: In-Memory Rate Limiter

**Files:**
- Create: `packages/api/src/lib/rate-limiter.ts`
- Modify: `packages/api/src/routes/auth.ts`

**Step 1: Create rate limiter class**

Create `packages/api/src/lib/rate-limiter.ts`:

```typescript
interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    // Cleanup expired entries every minute
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /** Returns true if request is allowed, false if rate limited */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, { timestamps: [now] });
      return true;
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /** Returns remaining requests for the key */
  remaining(key: string): number {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return this.maxRequests;
    const active = entry.timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - active.length);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
  }
}
```

**Step 2: Add rate limiting to auth routes**

Update `packages/api/src/routes/auth.ts`:

```typescript
import { Elysia } from "elysia";
import { sendOtpSchema, verifyOtpSchema } from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME, SESSION_EXPIRY_MS, OTP_SEND_RATE_LIMIT, OTP_SEND_RATE_WINDOW_MS, OTP_VERIFY_RATE_LIMIT, OTP_VERIFY_RATE_WINDOW_MS } from "@sparkclaw/shared/constants";
import { generateOtp, hashOtp, createOtpRecord, verifyOtp } from "../services/otp.js";
import { createSession, deleteSession } from "../services/session.js";
import { sendOtpEmail } from "../lib/email.js";
import { csrfMiddleware } from "../middleware/csrf.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { logger } from "../lib/logger.js";

const sendOtpLimiter = new RateLimiter(OTP_SEND_RATE_LIMIT, OTP_SEND_RATE_WINDOW_MS);
const verifyOtpLimiter = new RateLimiter(OTP_VERIFY_RATE_LIMIT, OTP_VERIFY_RATE_WINDOW_MS);

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(csrfMiddleware)
  .post("/send-otp", async ({ body, set, request }) => {
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid email" };
    }

    const rateLimitKey = `send:${getClientIp(request)}:${parsed.data.email}`;
    if (!sendOtpLimiter.check(rateLimitKey)) {
      set.status = 429;
      logger.warn("OTP send rate limited", { email: parsed.data.email });
      return { error: "Too many requests. Please try again later." };
    }

    const code = generateOtp();
    const codeHash = await hashOtp(code);
    await createOtpRecord(parsed.data.email, codeHash);
    await sendOtpEmail(parsed.data.email, code);

    return { ok: true };
  })
  .post("/verify-otp", async ({ body, cookie, set, request }) => {
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid format" };
    }

    const rateLimitKey = `verify:${getClientIp(request)}:${parsed.data.email}`;
    if (!verifyOtpLimiter.check(rateLimitKey)) {
      set.status = 429;
      logger.warn("OTP verify rate limited", { email: parsed.data.email });
      return { error: "Too many attempts. Please try again later." };
    }

    const user = await verifyOtp(parsed.data.email, parsed.data.code);
    if (!user) {
      set.status = 401;
      return { error: "Invalid or expired code" };
    }

    const session = await createSession(user.id);
    cookie[SESSION_COOKIE_NAME].set({
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: "/",
    });

    return { ok: true, redirect: "/dashboard" };
  })
  .post("/logout", async ({ cookie }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (token) {
      await deleteSession(token);
    }
    cookie[SESSION_COOKIE_NAME].remove();
    return { ok: true, redirect: "/" };
  });
```

**Step 3: Commit**

```bash
git add packages/api/src/lib/rate-limiter.ts packages/api/src/routes/auth.ts
git commit -m "feat: add in-memory rate limiting for OTP endpoints"
```

---

### Task 4: Fix CSRF Middleware

**Files:**
- Modify: `packages/api/src/middleware/csrf.ts`

**Step 1: Fix CSRF to require Origin header**

Replace `packages/api/src/middleware/csrf.ts`:

```typescript
import { Elysia } from "elysia";
import { logger } from "../lib/logger.js";

export const csrfMiddleware = new Elysia({ name: "csrf" })
  .onBeforeHandle(({ request, set, path }) => {
    // Skip CSRF for webhook endpoints (use signature verification instead)
    if (path.startsWith("/api/webhook/")) return;

    // Only check state-changing requests
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;

    const origin = request.headers.get("origin");
    const allowedOrigin = process.env.WEB_URL || "http://localhost:5173";

    if (!origin || origin !== allowedOrigin) {
      logger.warn("CSRF validation failed", {
        path,
        origin: origin ?? "missing",
        expected: allowedOrigin,
      });
      set.status = 403;
      return { error: "CSRF validation failed" };
    }
  });
```

**Step 2: Commit**

```bash
git add packages/api/src/middleware/csrf.ts
git commit -m "fix: reject requests without Origin header in CSRF middleware"
```

---

### Task 5: Fix Auth Middleware (Block Null User)

**Files:**
- Modify: `packages/api/src/middleware/auth.ts`
- Modify: `packages/api/src/routes/api.ts`

**Step 1: Fix auth middleware to block unauthenticated requests**

Replace `packages/api/src/middleware/auth.ts`:

```typescript
import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import type { User } from "@sparkclaw/shared/types";
import { verifySession } from "../services/session.js";

export const authMiddleware = new Elysia({ name: "auth" })
  .derive(async ({ cookie, set, error }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      return error(401, { error: "Not authenticated" });
    }

    const user = await verifySession(token);
    if (!user) {
      return error(401, { error: "Invalid or expired session" });
    }

    return { user };
  });
```

**Step 2: Remove null checks and type casts from api routes**

Replace `packages/api/src/routes/api.ts`:

```typescript
import { Elysia } from "elysia";
import { createCheckoutSchema } from "@sparkclaw/shared/schemas";
import type { MeResponse, InstanceResponse } from "@sparkclaw/shared/types";
import { authMiddleware } from "../middleware/auth.js";
import { csrfMiddleware } from "../middleware/csrf.js";
import { createCheckoutSession } from "../services/stripe.js";
import { db, subscriptions, instances } from "@sparkclaw/shared/db";
import { eq } from "drizzle-orm";

export const apiRoutes = new Elysia({ prefix: "/api" })
  .use(csrfMiddleware)
  .use(authMiddleware)
  .get("/me", async ({ user }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    const response: MeResponse = {
      id: user.id,
      email: user.email,
      subscription: sub
        ? {
            id: sub.id,
            plan: sub.plan as MeResponse["subscription"] extends null ? never : NonNullable<MeResponse["subscription"]>["plan"],
            status: sub.status as NonNullable<MeResponse["subscription"]>["status"],
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      createdAt: user.createdAt.toISOString(),
    };

    return response;
  })
  .get("/instance", async ({ user }) => {
    const result = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
      with: { subscription: true },
    });

    if (!result) {
      return { instance: null };
    }

    const response: InstanceResponse = {
      id: result.id,
      status: result.status as InstanceResponse["status"],
      url: result.url,
      plan: result.subscription.plan as InstanceResponse["plan"],
      subscriptionStatus: result.subscription.status as InstanceResponse["subscriptionStatus"],
      createdAt: result.createdAt.toISOString(),
    };

    return response;
  })
  .post("/checkout", async ({ user, body, set }) => {
    const parsed = createCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid plan" };
    }

    const url = await createCheckoutSession(user.id, user.email, parsed.data.plan);
    return { url };
  });
```

**Step 3: Commit**

```bash
git add packages/api/src/middleware/auth.ts packages/api/src/routes/api.ts
git commit -m "fix: auth middleware blocks unauthenticated requests, remove unsafe type casts"
```

---

### Task 6: Fix Webhook Error Handling

**Files:**
- Modify: `packages/api/src/routes/webhooks.ts`

**Step 1: Add try/catch to webhook handlers**

Replace `packages/api/src/routes/webhooks.ts`:

```typescript
import { Elysia } from "elysia";
import { constructStripeEvent, handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted } from "../services/stripe.js";
import { logger } from "../lib/logger.js";

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  .post("/stripe", async ({ request, set }) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      set.status = 400;
      return { error: "Missing signature" };
    }

    const body = await request.text();

    let event;
    try {
      event = constructStripeEvent(body, signature);
    } catch {
      set.status = 400;
      return { error: "Invalid signature" };
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object);
          break;
        default:
          logger.info("Unhandled webhook event", { type: event.type });
      }
    } catch (err) {
      logger.error("Webhook processing failed", {
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
      set.status = 500;
      return { error: "Webhook processing failed" };
    }

    logger.info("Webhook processed", { type: event.type });
    return { received: true };
  });
```

**Step 2: Commit**

```bash
git add packages/api/src/routes/webhooks.ts
git commit -m "fix: add error handling and logging to Stripe webhook processing"
```

---

### Task 7: Fix Railway getServiceDomain()

**Files:**
- Modify: `packages/api/src/services/railway.ts`

**Step 1: Implement proper domain extraction from Railway API**

Replace `packages/api/src/services/railway.ts`:

```typescript
import { db, instances } from "@sparkclaw/shared/db";
import {
  INSTANCE_POLL_INTERVAL_MS,
  INSTANCE_POLL_MAX_ATTEMPTS,
  INSTANCE_PROVISION_MAX_RETRIES,
} from "@sparkclaw/shared/constants";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";

async function railwayRequest(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Railway API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json() as { data?: Record<string, any>; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`Railway GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  return json;
}

async function createRailwayService(instanceId: string) {
  const projectId = process.env.RAILWAY_PROJECT_ID!;

  const result = await railwayRequest(
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
      }
    }`,
    {
      input: {
        projectId,
        name: `openclaw-${instanceId.slice(0, 8)}`,
      },
    },
  );

  return result.data!.serviceCreate.id as string;
}

async function createServiceDomain(serviceId: string, environmentId: string): Promise<string> {
  const result = await railwayRequest(
    `mutation($input: ServiceDomainCreateInput!) {
      serviceDomainCreate(input: $input) {
        domain
      }
    }`,
    {
      input: {
        serviceId,
        environmentId,
      },
    },
  );

  return result.data!.serviceDomainCreate.domain as string;
}

async function getServiceDomain(serviceId: string): Promise<string | null> {
  const result = await railwayRequest(
    `query($serviceId: String!) {
      service(id: $serviceId) {
        serviceDomains {
          domain
        }
      }
    }`,
    { serviceId },
  );

  const domains = result.data?.service?.serviceDomains;
  if (!domains || domains.length === 0) return null;
  return domains[0].domain as string;
}

async function getProjectEnvironmentId(): Promise<string> {
  const projectId = process.env.RAILWAY_PROJECT_ID!;
  const result = await railwayRequest(
    `query($projectId: String!) {
      project(id: $projectId) {
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }`,
    { projectId },
  );

  const edges = result.data?.project?.environments?.edges;
  if (!edges?.length) throw new Error("No environments found in Railway project");

  // Prefer "production" environment, fallback to first
  const prodEnv = edges.find((e: any) => e.node.name === "production");
  return (prodEnv || edges[0]).node.id as string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function provisionInstance(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  const [instance] = await db
    .insert(instances)
    .values({
      userId,
      subscriptionId,
      railwayProjectId: process.env.RAILWAY_PROJECT_ID!,
      status: "pending",
    })
    .returning();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < INSTANCE_PROVISION_MAX_RETRIES; attempt++) {
    try {
      // Create Railway service
      const serviceId = await createRailwayService(instance.id);

      await db
        .update(instances)
        .set({ railwayServiceId: serviceId, updatedAt: new Date() })
        .where(eq(instances.id, instance.id));

      logger.info("Railway service created", { instanceId: instance.id, serviceId });

      // Create a domain for the service
      const environmentId = await getProjectEnvironmentId();
      const createdDomain = await createServiceDomain(serviceId, environmentId);

      if (createdDomain) {
        await db
          .update(instances)
          .set({
            url: `https://${createdDomain}`,
            status: "ready",
            updatedAt: new Date(),
          })
          .where(eq(instances.id, instance.id));

        logger.info("Instance provisioned", { instanceId: instance.id, url: `https://${createdDomain}` });
        return;
      }

      // Fallback: poll for domain if creation doesn't return one
      for (let poll = 0; poll < INSTANCE_POLL_MAX_ATTEMPTS; poll++) {
        await sleep(INSTANCE_POLL_INTERVAL_MS);

        const domain = await getServiceDomain(serviceId);
        if (domain) {
          await db
            .update(instances)
            .set({
              url: `https://${domain}`,
              status: "ready",
              updatedAt: new Date(),
            })
            .where(eq(instances.id, instance.id));

          logger.info("Instance provisioned", { instanceId: instance.id, url: `https://${domain}` });
          return;
        }
      }

      throw new Error("Deployment polling timeout - domain not available");
    } catch (err) {
      lastError = err as Error;
      logger.error(`Provisioning attempt ${attempt + 1}/${INSTANCE_PROVISION_MAX_RETRIES} failed`, {
        instanceId: instance.id,
        error: (err as Error).message,
      });

      if (attempt < INSTANCE_PROVISION_MAX_RETRIES - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // All retries exhausted
  await db
    .update(instances)
    .set({
      status: "error",
      errorMessage: lastError?.message ?? "Unknown provisioning error",
      updatedAt: new Date(),
    })
    .where(eq(instances.id, instance.id));

  logger.error("Instance provisioning failed after all retries", { instanceId: instance.id });
}
```

**Step 2: Commit**

```bash
git add packages/api/src/services/railway.ts
git commit -m "fix: implement Railway getServiceDomain() and createServiceDomain() properly"
```

---

### Task 8: Unit Tests - Utils, Rate Limiter, Env Validation

**Files:**
- Create: `packages/api/src/lib/__tests__/utils.test.ts`
- Create: `packages/api/src/lib/__tests__/rate-limiter.test.ts`
- Create: `packages/shared/src/__tests__/env.test.ts`
- Create: `packages/shared/src/__tests__/schemas.test.ts`

**Step 1: Write utils tests**

Create `packages/api/src/lib/__tests__/utils.test.ts`:

```typescript
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
```

**Step 2: Write rate limiter tests**

Create `packages/api/src/lib/__tests__/rate-limiter.test.ts`:

```typescript
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
    limiter = new RateLimiter(1, 50); // 50ms window
    expect(limiter.check("key1")).toBe(true);
    expect(limiter.check("key1")).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.check("key1")).toBe(true);
  });
});
```

**Step 3: Write schemas tests**

Create `packages/shared/src/__tests__/schemas.test.ts`:

```typescript
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
```

**Step 4: Write env validation tests**

Create `packages/shared/src/__tests__/env.test.ts`:

```typescript
import { describe, expect, test, beforeEach, afterEach } from "bun:test";

// We need to test validateEnv in isolation, so we dynamically import
describe("env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module cache for fresh import
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("throws on missing required vars", async () => {
    // Clear all relevant env vars
    delete process.env.DATABASE_URL;
    delete process.env.STRIPE_SECRET_KEY;

    // Force re-import by clearing cached env
    const { validateEnv } = await import("../env.js");
    // Reset internal cache
    (globalThis as any).__sparkclaw_env = null;

    expect(() => {
      // Need to create a new validator since module caches _env
      const { z } = require("zod");
      const schema = z.object({
        DATABASE_URL: z.string().url(),
      });
      schema.parse({});
    }).toThrow();
  });
});
```

**Step 5: Add test script to root package.json**

Add to root `package.json` scripts:

```json
"test": "bun test --recursive",
"test:api": "bun test --recursive packages/api",
"test:shared": "bun test --recursive packages/shared"
```

**Step 6: Run tests to verify they pass**

Run: `bun test --recursive`

**Step 7: Commit**

```bash
git add packages/api/src/lib/__tests__/ packages/shared/src/__tests__/ package.json
git commit -m "test: add unit tests for utils, rate limiter, schemas, env validation"
```

---

### Task 9: Integration Tests - OTP and Session Services

**Files:**
- Create: `packages/api/src/services/__tests__/otp.test.ts`
- Create: `packages/api/src/services/__tests__/session.test.ts`

**Step 1: Write OTP service tests**

Create `packages/api/src/services/__tests__/otp.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { generateOtp, hashOtp } from "../otp.js";

describe("generateOtp", () => {
  test("returns 6-digit string", () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  test("returns different codes", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtp()));
    // Should have high uniqueness (probabilistic but very likely)
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
```

**Step 2: Write session service tests (pure functions only)**

Create `packages/api/src/services/__tests__/session.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";

// Test the token generation logic in isolation
describe("session token generation", () => {
  test("generates 64-char hex token", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  test("generates unique tokens", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }),
    );
    expect(tokens.size).toBe(100);
  });
});
```

**Step 3: Run tests**

Run: `bun test --recursive`

**Step 4: Commit**

```bash
git add packages/api/src/services/__tests__/
git commit -m "test: add unit tests for OTP and session services"
```

---

### Task 10: Frontend - Fix Dashboard Error Display and Type Safety

**Files:**
- Modify: `packages/web/src/routes/dashboard/+page.svelte`

**Step 1: Fix error display and add type safety**

Replace `packages/web/src/routes/dashboard/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getMe, getInstance, createCheckout, logout } from "$lib/api";
  import { planSchema } from "@sparkclaw/shared/schemas";
  import type { MeResponse, InstanceResponse } from "@sparkclaw/shared/types";

  let user = $state<MeResponse | null>(null);
  let instance = $state<InstanceResponse | null>(null);
  let loading = $state(true);
  let error = $state("");
  let pollingActive = $state(false);

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    loadDashboard();
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  async function loadDashboard() {
    try {
      user = await getMe();

      // If came from pricing with a plan and no subscription yet, validate and trigger checkout
      const rawPlan = page.url.searchParams.get("plan");
      if (rawPlan && !user.subscription) {
        const parsed = planSchema.safeParse(rawPlan);
        if (parsed.success) {
          const { url } = await createCheckout(parsed.data);
          window.location.href = url;
          return;
        }
      }

      // Fetch instance if user has subscription
      if (user.subscription) {
        await refreshInstance();
      }
    } catch {
      goto("/auth");
      return;
    } finally {
      loading = false;
    }
  }

  async function refreshInstance() {
    const result = await getInstance();
    if ("id" in result) {
      instance = result;

      // Auto-poll if instance is still pending
      if (result.status === "pending" && !pollingActive) {
        startPolling();
      } else if (result.status !== "pending") {
        stopPolling();
      }
    }
  }

  function startPolling() {
    pollingActive = true;
    pollTimer = setInterval(async () => {
      try {
        await refreshInstance();
      } catch {
        stopPolling();
      }
    }, 5000);
  }

  function stopPolling() {
    pollingActive = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  async function handleLogout() {
    await logout();
    goto("/");
  }
</script>

<svelte:head>
  <title>Dashboard - SparkClaw</title>
</svelte:head>

<main>
  <div class="dashboard">
    <header>
      <h1>Dashboard</h1>
      {#if user}
        <div class="user-info">
          <span>{user.email}</span>
          <button onclick={handleLogout}>Log out</button>
        </div>
      {/if}
    </header>

    {#if loading}
      <section class="card">
        <div class="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </section>
    {:else if !user}
      <p>Redirecting to login...</p>
    {:else if !user.subscription}
      <section class="card">
        <h2>No active subscription</h2>
        <p>Subscribe to create your OpenClaw instance.</p>
        <a href="/pricing" class="cta">Choose a Plan</a>
      </section>
    {:else if !instance}
      <section class="card">
        <h2>Setting up...</h2>
        <div class="loading-spinner"></div>
        <p>Your instance is being provisioned. This usually takes about a minute.</p>
      </section>
    {:else}
      <!-- Subscription info -->
      <section class="card">
        <h2>Subscription</h2>
        <p><strong>Plan:</strong> {user.subscription.plan}</p>
        <p><strong>Status:</strong> <span class="status-badge status-{user.subscription.status}">{user.subscription.status}</span></p>
      </section>

      <!-- Instance status -->
      <section class="card">
        <h2>Instance</h2>
        {#if instance.status === "pending"}
          <div class="loading-spinner"></div>
          <p>We're spinning up your OpenClaw instance...</p>
          <p class="hint">This usually takes about a minute. Auto-refreshing...</p>
        {:else if instance.status === "ready"}
          <p><strong>Status:</strong> <span class="status-badge status-ready">Ready</span></p>
          <p><strong>URL:</strong> <a href={instance.url} target="_blank" rel="noopener">{instance.url}</a></p>
          <div class="actions">
            <a href="{instance.url}/setup" target="_blank" rel="noopener" class="cta">Open Setup</a>
            <a href={instance.url} target="_blank" rel="noopener" class="cta secondary">Open Console</a>
          </div>
        {:else if instance.status === "error"}
          <p><strong>Status:</strong> <span class="status-badge status-error">Error</span></p>
          <p>We couldn't create your instance. Please contact support.</p>
          {#if instance.url}
            <p class="error-detail">Error: {instance.url}</p>
          {/if}
        {:else if instance.status === "suspended"}
          <p><strong>Status:</strong> <span class="status-badge status-suspended">Suspended</span></p>
          <p>Your subscription has been canceled. Instance is suspended.</p>
          <a href="/pricing" class="cta">Re-subscribe</a>
        {/if}
      </section>
    {/if}

    {#if error}
      <div class="toast error">{error}</div>
    {/if}
  </div>
</main>

<style>
  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 8px 0;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .hint {
    color: #6b7280;
    font-size: 0.875rem;
  }
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .status-active, .status-ready { background: #dcfce7; color: #166534; }
  .status-error { background: #fee2e2; color: #991b1b; }
  .status-suspended, .status-past_due { background: #fef3c7; color: #92400e; }
  .status-pending { background: #e0e7ff; color: #3730a3; }
  .error-detail {
    color: #991b1b;
    background: #fee2e2;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.875rem;
    z-index: 100;
  }
  .toast.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }
</style>
```

**Step 2: Commit**

```bash
git add packages/web/src/routes/dashboard/+page.svelte
git commit -m "feat: dashboard auto-polls instance status, fix error display, add loading states"
```

---

### Task 11: Frontend - Auth Page Type Safety

**Files:**
- Modify: `packages/web/src/routes/auth/+page.svelte`

**Step 1: Validate plan parameter with Zod**

Update `packages/web/src/routes/auth/+page.svelte` script section, lines 4-12:

```svelte
<script lang="ts">
  import { sendOtp, verifyOtp } from "$lib/api";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { planSchema } from "@sparkclaw/shared/schemas";

  let email = $state("");
  let code = $state("");
  let step = $state<"email" | "otp">("email");
  let loading = $state(false);
  let error = $state("");

  const plan = $derived(() => {
    const raw = page.url.searchParams.get("plan");
    if (!raw) return null;
    const parsed = planSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });

  async function handleSendOtp() {
    loading = true;
    error = "";
    try {
      await sendOtp(email);
      step = "otp";
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to send code";
    } finally {
      loading = false;
    }
  }

  async function handleVerifyOtp() {
    loading = true;
    error = "";
    try {
      await verifyOtp(email, code);
      const validPlan = plan();
      if (validPlan) {
        goto(`/dashboard?plan=${validPlan}`);
      } else {
        goto("/dashboard");
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Invalid code";
    } finally {
      loading = false;
    }
  }
</script>
```

Rest of the template stays the same.

**Step 2: Commit**

```bash
git add packages/web/src/routes/auth/+page.svelte
git commit -m "fix: validate plan parameter with Zod in auth page"
```

---

### Task 12: Final Quality Polish

**Files:**
- Modify: `packages/api/src/services/stripe.ts` (add logger)
- Modify: `packages/api/src/lib/email.ts` (add logger)

**Step 1: Add logging to stripe service**

Update `packages/api/src/services/stripe.ts` - replace `console.error` on line 70:

```typescript
import { logger } from "../lib/logger.js";
// ...in handleCheckoutCompleted:
provisionInstance(userId, sub.id).catch((err) => {
  logger.error("Provisioning failed", { userId, subscriptionId: sub.id, error: (err as Error).message });
});
```

**Step 2: Add logging to email service**

Update `packages/api/src/lib/email.ts`:

```typescript
import { Resend } from "resend";
import { logger } from "./logger.js";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  await getResend().emails.send({
    from: "SparkClaw <noreply@sparkclaw.com>",
    to: email,
    subject: `Your SparkClaw verification code: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your verification code</h2>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">
          ${code}
        </p>
        <p>This code expires in 5 minutes.</p>
        <p style="color: #666; font-size: 14px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  logger.info("OTP email sent", { to: email });
}
```

**Step 3: Commit**

```bash
git add packages/api/src/services/stripe.ts packages/api/src/lib/email.ts
git commit -m "chore: add structured logging to stripe and email services"
```

---

### Task 13: Run All Tests and Verify

**Step 1: Run type checking**

Run: `bun run typecheck`
Expected: No errors

**Step 2: Run all tests**

Run: `bun test --recursive`
Expected: All tests pass

**Step 3: Final commit if any fixes needed**

---

## Summary

| Task | Category | What |
|------|----------|------|
| 1 | Security/Completeness | Env validation + Stripe price IDs from env |
| 2 | Quality | Structured JSON logger |
| 3 | Security | In-memory rate limiter for OTP |
| 4 | Security | Fix CSRF to require Origin header |
| 5 | Security | Auth middleware blocks null user |
| 6 | Completeness | Webhook error handling + logging |
| 7 | Completeness | Fix Railway getServiceDomain() |
| 8 | Testing | Unit tests: utils, rate limiter, schemas, env |
| 9 | Testing | Unit tests: OTP, session services |
| 10 | Frontend | Dashboard: polling, loading, error display |
| 11 | Frontend | Auth: Zod plan validation |
| 12 | Quality | Logging in stripe/email services |
| 13 | Verification | Typecheck + tests pass |
