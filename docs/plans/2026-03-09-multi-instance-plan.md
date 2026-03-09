# Multi-Instance Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create multiple OpenClaw instances, limited by their subscription plan (Starter: 1, Pro: 3, Scale: 10).

**Architecture:** Remove 1:1 unique constraints between users/subscriptions and instances. Add plan limit constants. Refactor API from single-instance endpoints to multi-instance CRUD. Update dashboard with instance list + navbar switcher.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes syntax), Elysia (Bun), Drizzle ORM, PostgreSQL, Tailwind CSS v4, BullMQ

**Build commands:**
- Type check: `bun run typecheck` (root)
- Generate migration: `bun run db:generate`
- Build all: `bun run build`
- Frontend check: `cd packages/web && bun run check`
- Tests: `bun test --recursive`

---

### Task 1: Add Plan Instance Limits to Shared Constants

**Files:**
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add PLAN_INSTANCE_LIMITS**

The file currently imports `Plan` type via `getStripePriceId` function parameter. We need an explicit import at the top.

Open `packages/shared/src/constants.ts`. The full file currently is:

```ts
import type { Plan } from "./types.js";

export function getStripePriceId(plan: Plan): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}`;
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
export const OTP_SEND_RATE_LIMIT = 100;
export const OTP_SEND_RATE_WINDOW_MS = 60 * 1000;
export const OTP_VERIFY_RATE_LIMIT = 100;
export const OTP_VERIFY_RATE_WINDOW_MS = 60 * 1000;

export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "sparkclaw_session";

export const INSTANCE_POLL_INTERVAL_MS = 10_000;
export const INSTANCE_POLL_MAX_ATTEMPTS = 6;
export const INSTANCE_PROVISION_MAX_RETRIES = 3;
```

Add this block at the end of the file (after `INSTANCE_PROVISION_MAX_RETRIES`):

```ts
export const PLAN_INSTANCE_LIMITS: Record<Plan, number> = {
  starter: 1,
  pro: 3,
  scale: 10,
};
```

**Step 2: Verify**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: add PLAN_INSTANCE_LIMITS constant"
```

---

### Task 2: Update Shared Types for Multi-Instance

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Update MeResponse**

In `packages/shared/src/types.ts`, find the `MeResponse` interface (lines 39-49):

```ts
// CURRENT:
export interface MeResponse {
  id: string;
  email: string;
  subscription: {
    id: string;
    plan: Plan;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  } | null;
  createdAt: string;
}
```

Replace with:

```ts
export interface MeResponse {
  id: string;
  email: string;
  subscription: {
    id: string;
    plan: Plan;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  } | null;
  instanceLimit: number;
  instanceCount: number;
  createdAt: string;
}
```

**Step 2: Update InstanceResponse**

Find `InstanceResponse` (lines 51-60):

```ts
// CURRENT:
export interface InstanceResponse {
  id: string;
  status: InstanceStatus;
  url: string | null;
  customDomain: string | null;
  domainStatus: DomainStatus;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}
```

Replace with:

```ts
export interface InstanceResponse {
  id: string;
  instanceName: string | null;
  status: InstanceStatus;
  url: string | null;
  customDomain: string | null;
  domainStatus: DomainStatus;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}
```

**Step 3: Update SetupWizardState**

Find `SetupWizardState` (lines 137-143). No changes needed — it already has `instanceId`.

**Step 4: Verify**

Run: `bun run typecheck`
Expected: Type errors in files that use `MeResponse` and `InstanceResponse` (this is expected — we'll fix in later tasks)

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add instanceLimit, instanceCount, instanceName to shared types"
```

---

### Task 3: Update Database Schema — Remove Unique Constraints

**Files:**
- Modify: `packages/shared/src/db/schema.ts`

**Step 1: Remove .unique() from instances.subscriptionId**

In `packages/shared/src/db/schema.ts`, find lines 116-119:

```ts
// CURRENT (line 116-119):
    subscriptionId: uuid("subscription_id")
      .notNull()
      .unique()
      .references(() => subscriptions.id),
```

Change to (remove `.unique()`):

```ts
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
```

**Step 2: Change uniqueIndex to index for subscription_id**

Find line 161:

```ts
// CURRENT:
    uniqueIndex("instances_subscription_id_idx").on(table.subscriptionId),
```

Change to:

```ts
    index("instances_subscription_id_idx").on(table.subscriptionId),
```

**Step 3: Update usersRelations — instance singular → instances plural**

Find lines 25-30:

```ts
// CURRENT:
export const usersRelations = relations(users, ({ many, one }) => ({
  otpCodes: many(otpCodes),
  sessions: many(sessions),
  subscription: one(subscriptions),
  instance: one(instances),
}));
```

Change to:

```ts
export const usersRelations = relations(users, ({ many, one }) => ({
  otpCodes: many(otpCodes),
  sessions: many(sessions),
  subscription: one(subscriptions),
  instances: many(instances),
}));
```

**Step 4: Update subscriptionsRelations — instance singular → instances plural**

Find lines 102-105:

```ts
// CURRENT:
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  instance: one(instances),
}));
```

Change to:

```ts
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  instances: many(instances),
}));
```

**Step 5: Generate migration**

```bash
bun run db:generate
```

This will create a new migration file in `drizzle/migrations/`. Review the generated SQL — it should:
- Drop unique index `instances_subscription_id_idx`
- Create regular index `instances_subscription_id_idx`

Note: The `instances.userId` column was never unique in schema (only the relation was one()), so no migration needed for it.

**Step 6: Verify**

Run: `bun run typecheck`
Expected: Errors in `admin.ts` lines 98, 208 where `instance` (singular) is used via `with: { instance: true }` — we will fix in Task 6.

**Step 7: Commit**

```bash
git add packages/shared/src/db/schema.ts drizzle/
git commit -m "feat: remove unique constraints on instances for multi-instance support"
```

---

### Task 4: Add createInstanceSchema to Shared Schemas

**Files:**
- Modify: `packages/shared/src/schemas.ts`

**Step 1: Add createInstanceSchema**

In `packages/shared/src/schemas.ts`, add after `createCheckoutSchema` (after line 20):

```ts
export const createInstanceSchema = z.object({
  instanceName: z.string().max(100).optional(),
});
```

**Step 2: Update saveSetupSchema to require instanceId**

Find `saveSetupSchema` (lines 68-74):

```ts
// CURRENT:
export const saveSetupSchema = z.object({
  instanceName: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  channels: z.array(channelConfigSchema).min(1, "Select at least one channel"),
  aiConfig: aiConfigSchema,
  features: featureFlagsSchema,
});
```

Change to:

```ts
export const saveSetupSchema = z.object({
  instanceId: z.string().uuid(),
  instanceName: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  channels: z.array(channelConfigSchema).min(1, "Select at least one channel"),
  aiConfig: aiConfigSchema,
  features: featureFlagsSchema,
});
```

**Step 3: Update saveChannelCredentialsSchema to require instanceId**

Find `saveChannelCredentialsSchema` (lines 76-79):

```ts
// CURRENT:
export const saveChannelCredentialsSchema = z.object({
  type: channelTypeSchema,
  credentials: z.record(z.string()),
});
```

Change to:

```ts
export const saveChannelCredentialsSchema = z.object({
  instanceId: z.string().uuid(),
  type: channelTypeSchema,
  credentials: z.record(z.string()),
});
```

**Step 4: Add exported type**

Add after the existing type exports (after line 85):

```ts
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
```

**Step 5: Verify**

Run: `bun run typecheck`

**Step 6: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat: add createInstanceSchema and instanceId to setup schemas"
```

---

### Task 5: Rewrite API Routes for Multi-Instance

**Files:**
- Modify: `packages/api/src/routes/api.ts`

**Step 1: Rewrite the entire file**

Replace the entire content of `packages/api/src/routes/api.ts` with:

```ts
import { Elysia } from "elysia";
import { createCheckoutSchema, createInstanceSchema } from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME, PLAN_INSTANCE_LIMITS } from "@sparkclaw/shared/constants";
import type { MeResponse, InstanceResponse, DomainStatus, Plan } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { createCheckoutSession } from "../services/stripe.js";
import { verifySession } from "../services/session.js";
import { db, subscriptions, instances } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { queueInstanceProvisioning } from "../services/queue.js";
import { logger } from "../lib/logger.js";

function toInstanceResponse(result: {
  id: string;
  instanceName: string | null;
  status: string;
  url: string | null;
  customDomain: string | null;
  domainStatus: string | null;
  createdAt: Date;
  subscription: { plan: string; status: string };
}): InstanceResponse {
  return {
    id: result.id,
    instanceName: result.instanceName,
    status: result.status as InstanceResponse["status"],
    url: result.url,
    customDomain: result.customDomain,
    domainStatus: (result.domainStatus as DomainStatus) ?? "pending",
    plan: result.subscription.plan as InstanceResponse["plan"],
    subscriptionStatus: result.subscription.status as InstanceResponse["subscriptionStatus"],
    createdAt: result.createdAt.toISOString(),
  };
}

export const apiRoutes = new Elysia({ prefix: "/api" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }

    const user = await verifySession(token);
    if (!user) {
      set.status = 401;
      throw new Error("Invalid or expired session");
    }

    return { user };
  })
  .onError(({ set, error: err }) => {
    if (err instanceof Error && (err.message === "Not authenticated" || err.message === "Invalid or expired session")) {
      set.status = 401;
      return { error: err.message };
    }
  })
  // ── GET /api/me ─────────────────────────────────────────────────────────────
  .get("/me", async ({ user }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    const userInstances = await db.query.instances.findMany({
      where: eq(instances.userId, user.id),
    });

    const plan = (sub?.plan as Plan) ?? "starter";

    const response: MeResponse = {
      id: user.id,
      email: user.email,
      subscription: sub
        ? {
            id: sub.id,
            plan: sub.plan as NonNullable<MeResponse["subscription"]>["plan"],
            status: sub.status as NonNullable<MeResponse["subscription"]>["status"],
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      instanceLimit: PLAN_INSTANCE_LIMITS[plan] ?? 1,
      instanceCount: userInstances.length,
      createdAt: user.createdAt.toISOString(),
    };

    return response;
  })
  // ── GET /api/instances ──────────────────────────────────────────────────────
  .get("/instances", async ({ user }) => {
    const results = await db.query.instances.findMany({
      where: eq(instances.userId, user.id),
      with: { subscription: true },
      orderBy: (instances, { desc }) => [desc(instances.createdAt)],
    });

    return { instances: results.map(toInstanceResponse) };
  })
  // ── GET /api/instances/:id ──────────────────────────────────────────────────
  .get("/instances/:id", async ({ user, params, set }) => {
    const result = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
      with: { subscription: true },
    });

    if (!result) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    return toInstanceResponse(result);
  })
  // ── POST /api/instances ─────────────────────────────────────────────────────
  .post("/instances", async ({ user, body, set }) => {
    const parsed = createInstanceSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    if (!sub || sub.status !== "active") {
      set.status = 403;
      return { error: "Active subscription required" };
    }

    const plan = sub.plan as Plan;
    const limit = PLAN_INSTANCE_LIMITS[plan] ?? 1;
    const existing = await db.query.instances.findMany({
      where: eq(instances.userId, user.id),
    });

    if (existing.length >= limit) {
      set.status = 403;
      return {
        error: "Instance limit reached",
        code: "UPGRADE_REQUIRED",
        limit,
        current: existing.length,
      };
    }

    await queueInstanceProvisioning(user.id, sub.id);

    logger.info("New instance creation requested", {
      userId: user.id,
      currentCount: existing.length,
      limit,
    });

    return { success: true, message: "Instance provisioning started" };
  })
  // ── DELETE /api/instances/:id ───────────────────────────────────────────────
  .delete("/instances/:id", async ({ user, params, set }) => {
    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
    });

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    // Delete from DB (cascade deletes channel_configs)
    await db.delete(instances).where(eq(instances.id, params.id));

    logger.info("Instance deleted", {
      userId: user.id,
      instanceId: params.id,
    });

    return { success: true };
  })
  // ── GET /api/instance (backward compat) ─────────────────────────────────────
  .get("/instance", async ({ user }) => {
    const result = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
      with: { subscription: true },
    });

    if (!result) {
      return { instance: null };
    }

    return toInstanceResponse(result);
  })
  // ── POST /api/checkout ──────────────────────────────────────────────────────
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

**Step 2: Verify**

Run: `bun run typecheck`
Expected: May show errors in other files that import from api.ts — should be none since exports are the same.

**Step 3: Commit**

```bash
git add packages/api/src/routes/api.ts
git commit -m "feat: add multi-instance API endpoints (list, get, create, delete)"
```

---

### Task 6: Update Setup Routes to Use instanceId

**Files:**
- Modify: `packages/api/src/routes/setup.ts`

**Step 1: Rewrite the entire file**

Replace the entire content of `packages/api/src/routes/setup.ts` with:

```ts
import { Elysia } from "elysia";
import {
  saveSetupSchema,
  saveChannelCredentialsSchema,
} from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import type { SetupWizardState } from "@sparkclaw/shared/types";
import type { SaveSetupInput } from "@sparkclaw/shared/schemas";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { db, instances, channelConfigs } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { configureOpenClaw } from "../services/openclaw.js";

/** Find instance by ID and verify it belongs to the user */
async function findUserInstance(instanceId: string, userId: string) {
  return db.query.instances.findFirst({
    where: and(eq(instances.id, instanceId), eq(instances.userId, userId)),
  });
}

export const setupRoutes = new Elysia({ prefix: "/api/setup" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }

    const user = await verifySession(token);
    if (!user) {
      set.status = 401;
      throw new Error("Invalid or expired session");
    }

    return { user };
  })
  // Get setup wizard state — requires ?instanceId= query param
  .get("/state", async ({ user, query, set }) => {
    const instanceId = query.instanceId as string;
    if (!instanceId) {
      set.status = 400;
      return { error: "instanceId query parameter is required" };
    }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, instanceId), eq(instances.userId, user.id)),
      with: { channelConfigs: true },
    });

    if (!instance) {
      return { state: null };
    }

    const state: SetupWizardState = {
      step: instance.setupCompleted ? 4 : 1,
      instanceId: instance.id,
      instanceUrl: instance.url ?? "",
      isConfigured: instance.setupCompleted ?? false,
      setupData: {
        instanceName: instance.instanceName ?? undefined,
        timezone: instance.timezone ?? undefined,
        channels: instance.channelConfigs.map((c) => ({
          type: c.type as any,
          enabled: c.enabled,
          credentials: c.credentials as Record<string, string> | undefined,
        })),
        aiConfig: (instance.aiConfig as any) ?? {
          model: "auto",
          persona: "friendly",
          language: "auto",
          temperature: 0.7,
          maxTokens: 4000,
        },
        features: (instance.features as any) ?? {
          imageGeneration: true,
          webSearch: true,
          fileProcessing: true,
          voiceMessages: false,
          memory: true,
          codeExecution: false,
          mediaGeneration: false,
          calendar: false,
          email: false,
        },
      },
    };

    return { state };
  })
  // Save setup wizard data — instanceId in body
  .post("/save", async ({ user, body, set }) => {
    const parsed = saveSetupSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid setup data", details: parsed.error.errors };
    }

    const data = parsed.data as SaveSetupInput;
    const instance = await findUserInstance(data.instanceId, user.id);

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    // Update instance with setup data
    await db
      .update(instances)
      .set({
        instanceName: data.instanceName,
        timezone: data.timezone,
        aiConfig: data.aiConfig as any,
        features: data.features as any,
        setupCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(instances.id, instance.id));

    // Save channel configurations
    for (const channel of data.channels) {
      const existing = await db.query.channelConfigs.findFirst({
        where: (c, { and: a }) =>
          a(eq(c.instanceId, instance.id), eq(c.type, channel.type)),
      });

      if (existing) {
        await db
          .update(channelConfigs)
          .set({
            enabled: channel.enabled,
            credentials: channel.credentials as any,
            updatedAt: new Date(),
          })
          .where(eq(channelConfigs.id, existing.id));
      } else {
        await db.insert(channelConfigs).values({
          instanceId: instance.id,
          type: channel.type,
          enabled: channel.enabled,
          credentials: channel.credentials as any,
        });
      }
    }

    logger.info("Setup wizard completed", {
      userId: user.id,
      instanceId: instance.id,
      channels: data.channels
        .filter((c: { enabled: boolean }) => c.enabled)
        .map((c: { type: string }) => c.type),
    });

    // Configure OpenClaw with the new settings
    if (instance.url) {
      const gatewayToken = Buffer.from(
        `${instance.id}:${process.env.SESSION_SECRET}`,
      ).toString("base64");

      try {
        await configureOpenClaw(instance.url, {
          instanceId: instance.id,
          userId: user.id,
          gatewayToken,
        });
      } catch (error) {
        logger.warn("Failed to configure OpenClaw", {
          instanceId: instance.id,
          error: (error as Error).message,
        });
      }
    }

    return { success: true };
  })
  // Save channel credentials — instanceId in body
  .post("/channel", async ({ user, body, set }) => {
    const parsed = saveChannelCredentialsSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid channel data", details: parsed.error.errors };
    }

    const { instanceId, type, credentials } = parsed.data;
    const instance = await findUserInstance(instanceId, user.id);

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    const existing = await db.query.channelConfigs.findFirst({
      where: (c, { and: a }) =>
        a(eq(c.instanceId, instance.id), eq(c.type, type)),
    });

    if (existing) {
      await db
        .update(channelConfigs)
        .set({
          enabled: true,
          credentials: credentials as any,
          updatedAt: new Date(),
        })
        .where(eq(channelConfigs.id, existing.id));
    } else {
      await db.insert(channelConfigs).values({
        instanceId: instance.id,
        type,
        enabled: true,
        credentials: credentials as any,
      });
    }

    logger.info("Channel credentials saved", {
      userId: user.id,
      instanceId: instance.id,
      channelType: type,
    });

    return { success: true };
  })
  // Delete channel — instanceId in query param
  .delete("/channel/:type", async ({ user, params, query, set }) => {
    const instanceId = query.instanceId as string;
    if (!instanceId) {
      set.status = 400;
      return { error: "instanceId query parameter is required" };
    }

    const instance = await findUserInstance(instanceId, user.id);

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    await db
      .delete(channelConfigs)
      .where(
        and(
          eq(channelConfigs.instanceId, instance.id),
          eq(channelConfigs.type, params.type),
        ),
      );

    logger.info("Channel configuration deleted", {
      userId: user.id,
      instanceId: instance.id,
      channelType: params.type,
    });

    return { success: true };
  });
```

**Key changes from original:**
- `/state` GET: reads `instanceId` from `query.instanceId` instead of finding by userId
- `/save` POST: reads `instanceId` from `body.instanceId` (validated by schema)
- `/channel` POST: reads `instanceId` from `body.instanceId` (validated by schema)
- `/channel/:type` DELETE: reads `instanceId` from `query.instanceId`
- All lookups use `findUserInstance(instanceId, userId)` to verify ownership
- Delete channel now deletes by instanceId + type (not all channels for instance)

**Step 2: Verify**

Run: `bun run typecheck`

**Step 3: Commit**

```bash
git add packages/api/src/routes/setup.ts
git commit -m "feat: setup routes now require instanceId for multi-instance"
```

---

### Task 7: Update Admin Routes for Multi-Instance Relations

**Files:**
- Modify: `packages/api/src/routes/admin.ts`

The schema relation changed from `instance` (singular) to `instances` (plural). Admin routes use `with: { instance: true }` which will break.

**Step 1: Update /admin/users endpoint**

In `packages/api/src/routes/admin.ts`, find lines 91-100:

```ts
// CURRENT:
    const userList = await db.query.users.findMany({
      where: search ? sql`email ILIKE ${`%${search}%`}` : undefined,
      limit,
      offset,
      orderBy: [desc(users.createdAt)],
      with: {
        subscription: true,
        instance: true,
      },
    });
```

Change to:

```ts
    const userList = await db.query.users.findMany({
      where: search ? sql`email ILIKE ${`%${search}%`}` : undefined,
      limit,
      offset,
      orderBy: [desc(users.createdAt)],
      with: {
        subscription: true,
        instances: true,
      },
    });
```

**Step 2: Update the user list mapping**

Find lines 110-123:

```ts
// CURRENT:
    return {
      users: userList.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        subscription: u.subscription ? {
          plan: u.subscription.plan,
          status: u.subscription.status,
        } : null,
        instance: u.instance ? {
          status: u.instance.status,
          url: u.instance.url,
        } : null,
      })),
```

Change to:

```ts
    return {
      users: userList.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        subscription: u.subscription ? {
          plan: u.subscription.plan,
          status: u.subscription.status,
        } : null,
        instances: u.instances.map(i => ({
          id: i.id,
          status: i.status,
          url: i.url,
        })),
        instanceCount: u.instances.length,
      })),
```

**Step 3: Update /admin/users/:id endpoint**

Find lines 201-245 (the GET `/users/:id` handler). Change `with: { instance: ... }` to `with: { instances: ... }`:

```ts
// CURRENT (lines 206-213):
      with: {
        subscription: true,
        instance: {
          with: {
            channelConfigs: true,
          },
        },
      },
```

Change to:

```ts
      with: {
        subscription: true,
        instances: {
          with: {
            channelConfigs: true,
          },
        },
      },
```

And update the return mapping (lines 222-245):

```ts
// CURRENT:
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      subscription: user.subscription ? {
        id: user.subscription.id,
        plan: user.subscription.plan,
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString(),
      } : null,
      instance: user.instance ? {
        id: user.instance.id,
        status: user.instance.status,
        url: user.instance.url,
        customDomain: user.instance.customDomain,
        setupCompleted: user.instance.setupCompleted,
        channelConfigs: user.instance.channelConfigs?.map(c => ({
          type: c.type,
          enabled: c.enabled,
        })),
      } : null,
    };
```

Change to:

```ts
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      subscription: user.subscription ? {
        id: user.subscription.id,
        plan: user.subscription.plan,
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString(),
      } : null,
      instances: user.instances.map(i => ({
        id: i.id,
        status: i.status,
        url: i.url,
        customDomain: i.customDomain,
        setupCompleted: i.setupCompleted,
        channelConfigs: i.channelConfigs?.map(c => ({
          type: c.type,
          enabled: c.enabled,
        })),
      })),
    };
```

**Step 4: Verify**

Run: `bun run typecheck`
Expected: No errors from admin.ts

**Step 5: Commit**

```bash
git add packages/api/src/routes/admin.ts
git commit -m "feat: update admin routes for multi-instance relations"
```

---

### Task 8: Update Frontend API Client

**Files:**
- Modify: `packages/web/src/lib/api.ts`

**Step 1: Rewrite the entire file**

Replace the entire content of `packages/web/src/lib/api.ts` with:

```ts
import type { MeResponse, InstanceResponse, Plan, SetupWizardState } from "@sparkclaw/shared/types";
import type { SaveSetupInput } from "@sparkclaw/shared/schemas";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function sendOtp(email: string) {
  return request<{ ok: boolean }>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, code: string) {
  return request<{ ok: boolean; redirect: string }>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function getMe() {
  return request<MeResponse>("/api/me");
}

// ── Instances ─────────────────────────────────────────────────────────────────

export async function getInstances() {
  return request<{ instances: InstanceResponse[] }>("/api/instances");
}

export async function getInstanceById(id: string) {
  return request<InstanceResponse>(`/api/instances/${id}`);
}

export async function createInstance(instanceName?: string) {
  return request<{ success: boolean; message: string }>("/api/instances", {
    method: "POST",
    body: JSON.stringify({ instanceName }),
  });
}

export async function deleteInstance(id: string) {
  return request<{ success: boolean }>(`/api/instances/${id}`, {
    method: "DELETE",
  });
}

/** @deprecated Use getInstances() instead */
export async function getInstance() {
  return request<InstanceResponse | { instance: null }>("/api/instance");
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export async function createCheckout(plan: Plan) {
  return request<{ url: string }>("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function getSetupState(instanceId: string) {
  return request<{ state: SetupWizardState | null }>(`/api/setup/state?instanceId=${instanceId}`);
}

export async function saveSetup(data: SaveSetupInput) {
  return request<{ success: boolean }>("/api/setup/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function checkAdmin() {
  return request<{ isAdmin: boolean; user: { id: string; email: string } | null }>("/api/admin/check");
}

export async function getAdminStats() {
  return request<{
    users: number;
    instances: number;
    subscriptions: number;
    instancesByStatus: Record<string, number>;
    subscriptionsByPlan: Record<string, number>;
    recentSignups: number;
  }>("/api/admin/stats");
}

export async function getAdminUsers(page: number = 1, search: string = "") {
  return request<{
    users: Array<{
      id: string;
      email: string;
      role: string;
      createdAt: string;
      subscription: { plan: string; status: string } | null;
      instances: Array<{ id: string; status: string; url: string | null }>;
      instanceCount: number;
    }>;
    pagination: { page: number; totalPages: number; total: number };
  }>(`/api/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
}

export async function getAdminInstances(page: number = 1, status?: string) {
  return request<{
    instances: Array<{
      id: string;
      url: string | null;
      customDomain: string | null;
      status: string;
      domainStatus: string;
      setupCompleted: boolean;
      createdAt: string;
      user: { email: string };
      subscription: { plan: string };
    }>;
    pagination: { page: number; totalPages: number; total: number };
  }>(`/api/admin/instances?page=${page}${status ? `&status=${status}` : ""}`);
}
```

**Key changes:**
- Added: `getInstances()`, `getInstanceById(id)`, `createInstance(name?)`, `deleteInstance(id)`
- Changed: `getSetupState()` now requires `instanceId` param
- Changed: `getAdminUsers` return type — `instance` → `instances` array + `instanceCount`
- Kept: `getInstance()` for backward compat (marked deprecated)

**Step 2: Verify**

Run: `cd packages/web && bun run check`
Expected: Errors in dashboard and setup pages (we fix in next tasks)

**Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat: update frontend API client for multi-instance"
```

---

### Task 9: Create Instance Store

**Files:**
- Create: `packages/web/src/lib/stores/instance.ts`

**Step 1: Create the stores directory and file**

```bash
mkdir -p packages/web/src/lib/stores
```

Create `packages/web/src/lib/stores/instance.ts`:

```ts
import { writable } from "svelte/store";
import type { InstanceResponse } from "@sparkclaw/shared/types";

function createSelectedInstanceStore() {
  const stored = typeof localStorage !== "undefined"
    ? localStorage.getItem("sparkclaw_selected_instance")
    : null;

  const { subscribe, set, update } = writable<string | null>(stored);

  return {
    subscribe,
    set(id: string | null) {
      if (typeof localStorage !== "undefined") {
        if (id) {
          localStorage.setItem("sparkclaw_selected_instance", id);
        } else {
          localStorage.removeItem("sparkclaw_selected_instance");
        }
      }
      set(id);
    },
    update,
  };
}

export const selectedInstanceId = createSelectedInstanceStore();
export const userInstances = writable<InstanceResponse[]>([]);
```

**Step 2: Commit**

```bash
git add packages/web/src/lib/stores/instance.ts
git commit -m "feat: add Svelte stores for instance selection"
```

---

### Task 10: Rewrite Dashboard for Multi-Instance

**Files:**
- Modify: `packages/web/src/routes/dashboard/+page.svelte`

**Step 1: Rewrite the entire file**

Replace the entire content of `packages/web/src/routes/dashboard/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getMe, getInstances, createInstance, deleteInstance, createCheckout, logout } from "$lib/api";
  import { planSchema } from "@sparkclaw/shared/schemas";
  import type { MeResponse, InstanceResponse } from "@sparkclaw/shared/types";
  import { userInstances, selectedInstanceId } from "$lib/stores/instance";

  let user = $state<MeResponse | null>(null);
  let instances = $state<InstanceResponse[]>([]);
  let loading = $state(true);
  let error = $state("");
  let creating = $state(false);
  let showUpgradeModal = $state(false);
  let deleteConfirmId = $state<string | null>(null);
  let deleting = $state(false);

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

      // Handle ?plan= redirect to checkout
      const rawPlan = page.url.searchParams.get("plan");
      if (rawPlan && !user.subscription) {
        const parsed = planSchema.safeParse(rawPlan);
        if (parsed.success) {
          const { url } = await createCheckout(parsed.data);
          window.location.href = url;
          return;
        }
      }

      if (user.subscription) {
        await refreshInstances();
      }
    } catch {
      goto("/auth");
      return;
    } finally {
      loading = false;
    }
  }

  async function refreshInstances() {
    const result = await getInstances();
    instances = result.instances;
    userInstances.set(instances);

    // Auto-select first instance if none selected
    if (instances.length > 0) {
      selectedInstanceId.subscribe((id) => {
        if (!id || !instances.find((i) => i.id === id)) {
          selectedInstanceId.set(instances[0].id);
        }
      })();
    }

    // Poll if any instance is pending
    const hasPending = instances.some((i) => i.status === "pending");
    if (hasPending && !pollTimer) {
      pollTimer = setInterval(async () => {
        try {
          const r = await getInstances();
          instances = r.instances;
          userInstances.set(instances);
          if (!r.instances.some((i) => i.status === "pending")) {
            clearInterval(pollTimer);
            pollTimer = undefined;
          }
        } catch {
          /* ignore */
        }
      }, 5000);
    } else if (!hasPending && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  async function handleCreateInstance() {
    if (!user) return;
    if (user.instanceCount >= user.instanceLimit) {
      showUpgradeModal = true;
      return;
    }
    creating = true;
    error = "";
    try {
      await createInstance();
      user = await getMe();
      await refreshInstances();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("limit") || msg.includes("UPGRADE")) {
        showUpgradeModal = true;
      } else {
        error = msg;
      }
    } finally {
      creating = false;
    }
  }

  async function handleDeleteInstance(id: string) {
    deleting = true;
    error = "";
    try {
      await deleteInstance(id);
      user = await getMe();
      await refreshInstances();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      deleting = false;
      deleteConfirmId = null;
    }
  }

  async function handleLogout() {
    await logout();
    goto("/");
  }

  function statusColor(status: string) {
    switch (status) {
      case "ready": return "bg-green-500";
      case "pending": return "bg-amber-500";
      case "error": return "bg-red-500";
      default: return "bg-warm-400";
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case "ready": return "Ready";
      case "pending": return "Provisioning";
      case "error": return "Error";
      case "suspended": return "Suspended";
      default: return status;
    }
  }
</script>

<svelte:head>
  <title>Dashboard - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-display text-3xl">Dashboard</h1>
        {#if user}
          <p class="text-warm-500 mt-1">Welcome back, {user.email}</p>
        {/if}
      </div>
      <div class="flex gap-3">
        <a href="/account" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-2 rounded-lg hover:bg-warm-100">Settings</a>
        <button onclick={handleLogout} class="text-sm font-medium text-warm-500 hover:text-warm-900 transition-colors px-3 py-2 rounded-lg hover:bg-warm-100">Log out</button>
      </div>
    </div>

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading your dashboard...</p>
      </div>
    {:else if !user}
      <p class="text-warm-500">Redirecting to login...</p>
    {:else if !user.subscription}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center stagger">
        <div class="w-16 h-16 bg-warm-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 class="font-display text-2xl mb-2">No active subscription</h2>
        <p class="text-warm-500 mb-6">Subscribe to create your OpenClaw instance.</p>
        <a href="/pricing" class="btn-lift inline-block bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors">Choose a Plan</a>
      </div>
    {:else}
      <!-- Plan info bar -->
      <div class="flex items-center justify-between bg-white rounded-2xl border border-warm-200 p-5 mb-6">
        <div class="flex items-center gap-4">
          <div>
            <span class="font-display text-lg capitalize text-terra-500">{user.subscription.plan}</span>
            <span class="text-warm-400 text-sm ml-2">plan</span>
          </div>
          <div class="h-6 w-px bg-warm-200"></div>
          <div class="text-sm text-warm-500">
            {user.instanceCount} / {user.instanceLimit} instances
          </div>
        </div>
        <button
          onclick={handleCreateInstance}
          disabled={creating}
          class="btn-lift bg-terra-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {#if creating}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Creating...
          {:else}
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            New Instance
          {/if}
        </button>
      </div>

      <!-- Instance grid -->
      {#if instances.length === 0}
        <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
          <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-warm-500">Spinning up your first OpenClaw instance...</p>
          <p class="text-warm-400 text-sm mt-1">This usually takes about a minute. Auto-refreshing...</p>
        </div>
      {:else}
        <div class="grid md:grid-cols-2 gap-4 stagger">
          {#each instances as inst (inst.id)}
            <div class="bg-white rounded-2xl border border-warm-200 p-6 card-hover">
              <!-- Instance header -->
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-display text-lg truncate">{inst.instanceName || `Instance ${inst.id.slice(0, 8)}`}</h3>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="w-2.5 h-2.5 rounded-full {statusColor(inst.status)} {inst.status === 'pending' ? 'animate-pulse' : ''}"></span>
                  <span class="text-xs font-semibold {inst.status === 'ready' ? 'text-green-700' : inst.status === 'pending' ? 'text-amber-700' : inst.status === 'error' ? 'text-red-700' : 'text-warm-600'}">{statusLabel(inst.status)}</span>
                </div>
              </div>

              {#if inst.status === "pending"}
                <div class="text-center py-4">
                  <div class="w-6 h-6 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-3"></div>
                  <p class="text-warm-400 text-sm">Provisioning...</p>
                </div>
              {:else if inst.status === "ready"}
                <!-- URL -->
                <div class="bg-warm-50 rounded-xl p-3 border border-warm-100 mb-4">
                  <div class="text-xs text-warm-400 mb-1">URL</div>
                  <a href={inst.url} target="_blank" rel="noopener" class="text-terra-500 text-sm font-medium hover:underline break-all">{inst.customDomain || inst.url}</a>
                  {#if inst.customDomain && inst.domainStatus === "ready"}
                    <div class="text-xs text-warm-400 mt-1 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Custom domain active
                    </div>
                  {:else if inst.customDomain && inst.domainStatus !== "ready"}
                    <div class="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                      Domain: {inst.domainStatus}
                    </div>
                  {/if}
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                  <a href="/setup?instance={inst.id}" class="btn-lift flex-1 bg-terra-500 text-white py-2 rounded-xl font-semibold text-xs text-center hover:bg-terra-600 transition-colors">Setup</a>
                  <a href={inst.url} target="_blank" rel="noopener" class="flex-1 bg-warm-100 text-warm-700 py-2 rounded-xl font-semibold text-xs text-center hover:bg-warm-200 transition-colors border border-warm-200">Console</a>
                  <button onclick={() => deleteConfirmId = inst.id} class="px-3 py-2 rounded-xl text-warm-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-warm-200">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              {:else if inst.status === "error"}
                <div class="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                  <p class="text-red-700 text-sm">Provisioning failed. Contact support.</p>
                </div>
                <button onclick={() => deleteConfirmId = inst.id} class="text-xs text-red-600 hover:underline">Remove</button>
              {:else if inst.status === "suspended"}
                <div class="text-center py-3">
                  <p class="text-warm-500 text-sm mb-3">Subscription canceled. Instance suspended.</p>
                  <a href="/pricing" class="text-xs font-semibold text-terra-500 hover:text-terra-600">Re-subscribe</a>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Quick actions -->
      <div class="mt-8">
        <h2 class="font-display text-xl mb-4">Quick start</h2>
        <div class="grid md:grid-cols-3 gap-4 stagger">
          <a href="/docs" class="card-hover bg-white rounded-xl border border-warm-200 p-5 block">
            <div class="text-2xl mb-2">&#x1f4ac;</div>
            <h3 class="font-semibold text-sm mb-1">Connect Telegram</h3>
            <p class="text-warm-500 text-xs">Set up your first channel in 2 minutes</p>
          </a>
          <a href="/docs" class="card-hover bg-white rounded-xl border border-warm-200 p-5 block">
            <div class="text-2xl mb-2">&#x1f916;</div>
            <h3 class="font-semibold text-sm mb-1">Configure LLM</h3>
            <p class="text-warm-500 text-xs">Choose your AI model and persona</p>
          </a>
          <a href="/docs" class="card-hover bg-white rounded-xl border border-warm-200 p-5 block">
            <div class="text-2xl mb-2">&#x1f4d6;</div>
            <h3 class="font-semibold text-sm mb-1">Read the docs</h3>
            <p class="text-warm-500 text-xs">Full guide to get the most from OpenClaw</p>
          </a>
        </div>
      </div>
    {/if}

    <!-- Delete Confirmation Modal -->
    {#if deleteConfirmId}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="font-display text-xl mb-2">Delete Instance?</h3>
          <p class="text-warm-500 text-sm mb-6">This will permanently delete the instance and all its channel configurations. This cannot be undone.</p>
          <div class="flex gap-3">
            <button onclick={() => deleteConfirmId = null} class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors">Cancel</button>
            <button
              onclick={() => deleteConfirmId && handleDeleteInstance(deleteConfirmId)}
              disabled={deleting}
              class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Upgrade Modal -->
    {#if showUpgradeModal}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="font-display text-xl mb-2">Instance Limit Reached</h3>
          <p class="text-warm-500 text-sm mb-2">
            Your <span class="font-semibold capitalize">{user?.subscription?.plan}</span> plan allows up to <span class="font-semibold">{user?.instanceLimit}</span> instance{user?.instanceLimit === 1 ? '' : 's'}.
          </p>
          <p class="text-warm-500 text-sm mb-6">Upgrade your plan to create more instances.</p>
          <div class="flex gap-3">
            <button onclick={() => showUpgradeModal = false} class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors">Cancel</button>
            <a href="/pricing" class="flex-1 btn-lift py-2.5 rounded-xl font-semibold text-sm bg-terra-500 text-white text-center hover:bg-terra-600 transition-colors">Upgrade Plan</a>
          </div>
        </div>
      </div>
    {/if}

    <!-- Error toast -->
    {#if error}
      <div class="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm shadow-lg animate-fade-up z-50">
        {error}
      </div>
    {/if}
  </div>
</section>
```

**Step 2: Verify**

Run: `cd packages/web && bun run check`

**Step 3: Commit**

```bash
git add packages/web/src/routes/dashboard/+page.svelte
git commit -m "feat: dashboard with multi-instance list, create, delete, and upgrade modal"
```

---

### Task 11: Add Instance Switcher to Navbar

**Files:**
- Modify: `packages/web/src/lib/components/Navbar.svelte`

**Step 1: Rewrite the entire file**

Replace the entire content of `packages/web/src/lib/components/Navbar.svelte` with:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { userInstances, selectedInstanceId } from '$lib/stores/instance';

  let mobileOpen = $state(false);
  let switcherOpen = $state(false);

  const isActive = (path: string) => page.url.pathname === path;
  const isAppPage = $derived(
    page.url.pathname.startsWith('/dashboard') ||
    page.url.pathname.startsWith('/setup') ||
    page.url.pathname.startsWith('/account')
  );

  let instances: typeof $userInstances = [];
  let currentId: string | null = null;

  userInstances.subscribe((v) => (instances = v));
  selectedInstanceId.subscribe((v) => (currentId = v));

  const currentInstance = $derived(instances.find((i) => i.id === currentId));

  function selectInstance(id: string) {
    selectedInstanceId.set(id);
    switcherOpen = false;
  }

  function statusDot(status: string) {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'pending': return 'bg-amber-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-warm-400';
    }
  }
</script>

<nav class="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-warm-50/80 border-b border-warm-200">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a href="/" class="flex items-center gap-2.5 group">
        <div class="w-8 h-8 bg-terra-500 rounded-lg flex items-center justify-center group-hover:rotate-6 transition-transform">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <span class="font-display text-xl text-warm-900">SparkClaw</span>
      </a>

      <!-- Instance Switcher (only on app pages with instances) -->
      {#if isAppPage && instances.length > 0}
        <div class="hidden md:block relative">
          <button
            onclick={() => switcherOpen = !switcherOpen}
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-warm-200 hover:bg-warm-100 transition-colors text-sm"
          >
            <span class="w-2 h-2 rounded-full {currentInstance ? statusDot(currentInstance.status) : 'bg-warm-300'}"></span>
            <span class="font-medium text-warm-700 max-w-[140px] truncate">
              {currentInstance?.instanceName || `Instance ${currentId?.slice(0, 8) ?? '...'}`}
            </span>
            <svg class="w-4 h-4 text-warm-400 transition-transform {switcherOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>

          {#if switcherOpen}
            <!-- Backdrop -->
            <button class="fixed inset-0 z-40" onclick={() => switcherOpen = false} aria-label="Close"></button>
            <!-- Dropdown -->
            <div class="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-warm-200 shadow-lg z-50 py-1">
              {#each instances as inst (inst.id)}
                <button
                  onclick={() => selectInstance(inst.id)}
                  class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50 transition-colors text-left {inst.id === currentId ? 'bg-warm-50' : ''}"
                >
                  <span class="w-2 h-2 rounded-full shrink-0 {statusDot(inst.status)}"></span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-warm-800 truncate">{inst.instanceName || `Instance ${inst.id.slice(0, 8)}`}</div>
                    {#if inst.customDomain}
                      <div class="text-xs text-warm-400 truncate">{inst.customDomain}</div>
                    {/if}
                  </div>
                  {#if inst.id === currentId}
                    <svg class="w-4 h-4 text-terra-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  {/if}
                </button>
              {/each}
              <div class="border-t border-warm-100 mt-1 pt-1">
                <a href="/dashboard" class="flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50 transition-colors text-sm text-terra-600 font-medium" onclick={() => switcherOpen = false}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Manage Instances
                </a>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="hidden md:flex items-center gap-8 text-sm font-medium text-warm-600">
      <a href="/pricing" class="hover:text-warm-900 transition-colors" class:text-warm-900={isActive('/pricing')}>Pricing</a>
      <a href="/docs" class="hover:text-warm-900 transition-colors" class:text-warm-900={isActive('/docs')}>Docs</a>
    </div>

    <div class="hidden md:flex items-center gap-3">
      {#if isAppPage}
        <a href="/dashboard" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5" class:text-warm-900={isActive('/dashboard')}>Dashboard</a>
        <a href="/account" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5" class:text-warm-900={isActive('/account')}>Account</a>
      {:else}
        <a href="/auth" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5">Log in</a>
        <a href="/pricing" class="text-sm font-semibold bg-warm-900 text-warm-50 px-4 py-2 rounded-lg hover:bg-warm-800 transition-colors">Get Started</a>
      {/if}
    </div>

    <!-- Mobile hamburger -->
    <button class="md:hidden p-2 text-warm-600" onclick={() => mobileOpen = !mobileOpen} aria-label="Menu">
      {#if mobileOpen}
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      {:else}
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      {/if}
    </button>
  </div>

  <!-- Mobile menu -->
  {#if mobileOpen}
    <div class="md:hidden border-t border-warm-200 bg-warm-50 px-6 py-4 space-y-3">
      <!-- Mobile instance switcher -->
      {#if isAppPage && instances.length > 0}
        <div class="pb-3 border-b border-warm-200">
          <div class="text-xs text-warm-400 font-medium uppercase tracking-wider mb-2">Instance</div>
          {#each instances as inst (inst.id)}
            <button
              onclick={() => { selectedInstanceId.set(inst.id); mobileOpen = false; }}
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left {inst.id === currentId ? 'bg-terra-50 text-terra-700' : 'text-warm-700 hover:bg-warm-100'}"
            >
              <span class="w-2 h-2 rounded-full {statusDot(inst.status)}"></span>
              <span class="text-sm font-medium truncate">{inst.instanceName || `Instance ${inst.id.slice(0, 8)}`}</span>
            </button>
          {/each}
        </div>
      {/if}

      <a href="/pricing" class="block text-sm font-medium text-warm-700 hover:text-warm-900" onclick={() => mobileOpen = false}>Pricing</a>
      <a href="/docs" class="block text-sm font-medium text-warm-700 hover:text-warm-900" onclick={() => mobileOpen = false}>Docs</a>
      <hr class="border-warm-200" />
      {#if isAppPage}
        <a href="/dashboard" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Dashboard</a>
        <a href="/account" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Account</a>
      {:else}
        <a href="/auth" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Log in</a>
        <a href="/pricing" class="block text-sm font-semibold bg-warm-900 text-warm-50 px-4 py-2 rounded-lg text-center" onclick={() => mobileOpen = false}>Get Started</a>
      {/if}
    </div>
  {/if}
</nav>
```

**Key features:**
- Instance switcher dropdown shows on `/dashboard`, `/setup`, `/account` pages when instances exist
- Shows instance name + status dot + domain
- Checkmark on currently selected instance
- "Manage Instances" link at bottom goes to dashboard
- Mobile menu also has instance switcher
- When on public pages, shows normal Log in / Get Started buttons

**Step 2: Verify**

Run: `cd packages/web && bun run check`

**Step 3: Commit**

```bash
git add packages/web/src/lib/components/Navbar.svelte
git commit -m "feat: add instance switcher dropdown to navbar"
```

---

### Task 12: Update Setup Wizard to Use instanceId from URL

**Files:**
- Modify: `packages/web/src/routes/setup/+page.svelte`

**Step 1: Update the script section**

In `packages/web/src/routes/setup/+page.svelte`, make these changes to the `<script>` block:

1. Add `page` import (already has `goto`):

```ts
import { page } from "$app/state";
```

2. Add instanceId extraction and update onMount. Replace lines 75-94 (the `onMount` block):

```ts
// CURRENT:
  onMount(async () => {
    try {
      const result = await getSetupState();
      if (result.wizardState) {
        // ...
      }
    } catch {
      goto("/auth");
    } finally {
      loading = false;
    }
  });
```

Change to:

```ts
  const instanceId = page.url.searchParams.get("instance");

  onMount(async () => {
    if (!instanceId) {
      goto("/dashboard");
      return;
    }
    try {
      const result = await getSetupState(instanceId);
      if (result.state) {
        wizardState = result.state;
        step = result.state.step;
        if (result.state.setupData) {
          instanceName = result.state.setupData.instanceName ?? "";
          selectedChannels = result.state.setupData.channels ?? [];
          aiConfig = result.state.setupData.aiConfig ?? aiConfig;
          features = result.state.setupData.features ?? features;
          customPrompt = result.state.setupData.aiConfig?.customPrompt ?? "";
        }
      }
    } catch {
      goto("/auth");
    } finally {
      loading = false;
    }
  });
```

Note: the `getSetupState` import changed — it now takes `instanceId`. Check the import: it should be `import { getSetupState, saveSetup } from "$lib/api";` (unchanged).

3. Update `handleSave` to include instanceId. Replace lines 109-130:

```ts
// CURRENT:
  async function handleSave() {
    saving = true;
    errorMsg = "";

    try {
      await saveSetup({
        instanceName: instanceName || undefined,
        channels: selectedChannels,
        aiConfig: {
          ...aiConfig,
          customPrompt: aiConfig.persona === "custom" ? customPrompt : undefined,
        },
        features,
      });

      goto("/dashboard?setup=complete");
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      saving = false;
    }
  }
```

Change to:

```ts
  async function handleSave() {
    if (!instanceId) return;
    saving = true;
    errorMsg = "";

    try {
      await saveSetup({
        instanceId,
        instanceName: instanceName || undefined,
        channels: selectedChannels,
        aiConfig: {
          ...aiConfig,
          customPrompt: aiConfig.persona === "custom" ? customPrompt : undefined,
        },
        features,
      });

      goto("/dashboard?setup=complete");
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      saving = false;
    }
  }
```

4. Also update the `getSetupState` call — note the function signature changed. The old code accessed `result.wizardState` but the API returns `result.state`. Check the current code — it already uses `result.state` in the `getSetupState` return type. Actually looking at the current code again at line 78: `if (result.wizardState)` — but the API returns `{ state: ... }`. Let me check... The current `getSetupState` in api.ts returns `{ state: SetupWizardState | null }`. But the setup page accesses `result.wizardState` and `result.wizardState.step`. This looks like a bug in the current code — but it works somehow. After our changes, the property is still `state`, so update accordingly:

In the onMount, the code already references the correct property — actually looking more carefully at the current setup page code (line 78-87):

```ts
      const result = await getSetupState();
      if (result.wizardState) {
        wizardState = result.wizardState;
```

But `getSetupState` returns `{ state: ... }` not `{ wizardState: ... }`. Since the old code still "worked" (likely `result.wizardState` was undefined and the wizard showed default state), our new code should fix this. Change `result.wizardState` to `result.state`:

```ts
      const result = await getSetupState(instanceId);
      if (result.state) {
        wizardState = result.state;
        step = result.state.step;
        if (result.state.setupData) {
          instanceName = result.state.setupData.instanceName ?? "";
          selectedChannels = result.state.setupData.channels ?? [];
          aiConfig = result.state.setupData.aiConfig ?? aiConfig;
          features = result.state.setupData.features ?? features;
          customPrompt = result.state.setupData.aiConfig?.customPrompt ?? "";
        }
      }
```

**Step 2: Verify**

Run: `cd packages/web && bun run check`

**Step 3: Commit**

```bash
git add packages/web/src/routes/setup/+page.svelte
git commit -m "feat: setup wizard reads instanceId from URL query param"
```

---

### Task 13: Update Pricing Pages with Instance Counts

**Files:**
- Modify: `packages/web/src/routes/+page.svelte`
- Modify: `packages/web/src/routes/pricing/+page.svelte`

**Step 1: Update home page plans**

In `packages/web/src/routes/+page.svelte`, find lines 4-8 (the plans array):

```ts
// CURRENT:
  const plans: { key: Plan; name: string; price: number; features: string[] }[] = [
    { key: "starter", name: "Starter", price: 19, features: ["1 OpenClaw instance", "All 25+ channels", "Community support"] },
    { key: "pro", name: "Pro", price: 39, features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Custom domain (soon)"] },
    { key: "scale", name: "Scale", price: 79, features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Higher resources", "Custom domain (soon)"] },
  ];
```

Change to:

```ts
  const plans: { key: Plan; name: string; price: number; features: string[] }[] = [
    { key: "starter", name: "Starter", price: 19, features: ["1 OpenClaw instance", "All 25+ channels", "Community support"] },
    { key: "pro", name: "Pro", price: 39, features: ["Up to 3 instances", "All 25+ channels", "Priority support", "Custom domain (soon)"] },
    { key: "scale", name: "Scale", price: 79, features: ["Up to 10 instances", "All 25+ channels", "Priority support", "Higher resources", "Custom domain (soon)"] },
  ];
```

**Step 2: Update pricing page**

In `packages/web/src/routes/pricing/+page.svelte`, find lines 7-20 (the plans array):

```ts
// CURRENT:
  const plans: { key: Plan; name: string; price: number; tagline: string; features: string[] }[] = [
    {
      key: "starter", name: "Starter", price: 19, tagline: "For trying things out",
      features: ["1 OpenClaw instance", "All 25+ channels", "Prism LLM gateway", "Community support"],
    },
    {
      key: "pro", name: "Pro", price: 39, tagline: "For creators and indie devs",
      features: ["Everything in Starter", "Priority support", "Custom domain (soon)", "Advanced analytics"],
    },
    {
      key: "scale", name: "Scale", price: 79, tagline: "For agencies and growing teams",
      features: ["Everything in Pro", "Higher resources", "Custom domain (soon)", "Dedicated support"],
    },
  ];
```

Change to:

```ts
  const plans: { key: Plan; name: string; price: number; tagline: string; features: string[] }[] = [
    {
      key: "starter", name: "Starter", price: 19, tagline: "For trying things out",
      features: ["1 OpenClaw instance", "All 25+ channels", "Prism LLM gateway", "Community support"],
    },
    {
      key: "pro", name: "Pro", price: 39, tagline: "For creators and indie devs",
      features: ["Up to 3 instances", "Everything in Starter", "Priority support", "Custom domain (soon)"],
    },
    {
      key: "scale", name: "Scale", price: 79, tagline: "For agencies and growing teams",
      features: ["Up to 10 instances", "Everything in Pro", "Higher resources", "Dedicated support"],
    },
  ];
```

**Step 3: Verify**

Run: `cd packages/web && bun run check`

**Step 4: Commit**

```bash
git add packages/web/src/routes/+page.svelte packages/web/src/routes/pricing/+page.svelte
git commit -m "feat: update pricing pages with multi-instance limits"
```

---

### Task 14: Update Queue to Support Multiple Instances per Subscription

**Files:**
- Modify: `packages/api/src/services/queue.ts`

**Step 1: Fix jobId deduplication**

The current queue uses `jobId: \`provision-${subscriptionId}\`` which would prevent creating a second instance under the same subscription. Change to use a random ID.

In `packages/api/src/services/queue.ts`, find lines 99-104:

```ts
// CURRENT:
  const job = await queue.add("provision-instance", {
    userId,
    subscriptionId,
  }, {
    jobId: `provision-${subscriptionId}`, // Deduplicate by subscription
  });
```

Change to:

```ts
  const job = await queue.add("provision-instance", {
    userId,
    subscriptionId,
  });
```

(Remove the `jobId` option entirely so BullMQ generates a unique ID per job.)

**Step 2: Verify**

Run: `bun run typecheck`

**Step 3: Commit**

```bash
git add packages/api/src/services/queue.ts
git commit -m "fix: allow multiple provisioning jobs per subscription"
```

---

### Task 15: Build and Full Verification

**Step 1: Type check all packages**

```bash
bun run typecheck
```

Fix any errors.

**Step 2: Frontend check**

```bash
cd packages/web && bun run check
```

Fix any Svelte component errors.

**Step 3: Build all packages**

```bash
cd /Users/wora/Coding/WiseSpark/SparkClaw
bun run build
```

Fix any build errors.

**Step 4: Run tests**

```bash
bun test --recursive
```

Fix any test failures.

**Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve build and type errors for multi-instance support"
```

**Step 6: Push**

```bash
git push origin main
```

---

## File Change Summary

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `packages/shared/src/constants.ts` | Modify | Add `PLAN_INSTANCE_LIMITS` |
| 2 | `packages/shared/src/types.ts` | Modify | Add `instanceLimit`, `instanceCount` to `MeResponse`; add `instanceName` to `InstanceResponse` |
| 3 | `packages/shared/src/db/schema.ts` | Modify | Remove `.unique()` on `subscriptionId`, change `uniqueIndex` to `index`, change relations to `many()` |
| 4 | `packages/shared/src/schemas.ts` | Modify | Add `createInstanceSchema`, add `instanceId` to setup schemas |
| 5 | `packages/api/src/routes/api.ts` | Rewrite | Add GET/POST/DELETE `/instances` endpoints |
| 6 | `packages/api/src/routes/setup.ts` | Rewrite | All endpoints require `instanceId` |
| 7 | `packages/api/src/routes/admin.ts` | Modify | Change `instance` → `instances` in queries and responses |
| 8 | `packages/api/src/services/queue.ts` | Modify | Remove `jobId` dedup by subscriptionId |
| 9 | `packages/web/src/lib/api.ts` | Rewrite | Add multi-instance functions, update setup/admin types |
| 10 | `packages/web/src/lib/stores/instance.ts` | Create | Svelte stores for instance selection |
| 11 | `packages/web/src/routes/dashboard/+page.svelte` | Rewrite | Instance grid, create, delete, upgrade modal |
| 12 | `packages/web/src/lib/components/Navbar.svelte` | Rewrite | Instance switcher dropdown |
| 13 | `packages/web/src/routes/setup/+page.svelte` | Modify | Read `instanceId` from URL, pass to API calls |
| 14 | `packages/web/src/routes/+page.svelte` | Modify | Update plan feature text |
| 15 | `packages/web/src/routes/pricing/+page.svelte` | Modify | Update plan feature text |
| 16 | `drizzle/migrations/0002_*.sql` | Generated | Migration for schema changes |
