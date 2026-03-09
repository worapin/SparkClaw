# Multi-Instance Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create multiple OpenClaw instances, limited by their subscription plan (Starter: 1, Pro: 3, Scale: 10).

**Architecture:** Remove 1:1 unique constraints between users/subscriptions and instances. Add plan limit constants. Refactor API from single-instance endpoints to multi-instance CRUD. Update dashboard with instance list + navbar switcher.

**Tech Stack:** SvelteKit 5, Elysia (Bun), Drizzle ORM, PostgreSQL, Tailwind CSS

---

### Task 1: Add Plan Instance Limits to Constants

**Files:**
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add PLAN_INSTANCE_LIMITS constant**

Add to the end of `packages/shared/src/constants.ts`:

```ts
import type { Plan } from "./types.js";

export const PLAN_INSTANCE_LIMITS: Record<Plan, number> = {
  starter: 1,
  pro: 3,
  scale: 10,
};
```

Note: The `Plan` import already exists in the file via `getStripePriceId`. Move the import to the top if needed or add to existing import.

**Step 2: Update MeResponse type to include instanceLimit and instanceCount**

In `packages/shared/src/types.ts`, update the `MeResponse` interface:

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

**Step 3: Update InstanceResponse to include instanceName**

In `packages/shared/src/types.ts`, update `InstanceResponse`:

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

**Step 4: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts
git commit -m "feat: add plan instance limits and update response types"
```

---

### Task 2: Database Schema — Remove Unique Constraints

**Files:**
- Modify: `packages/shared/src/db/schema.ts`

**Step 1: Remove unique() from instances.subscriptionId**

In `packages/shared/src/db/schema.ts`, line 116-119, change:

```ts
// FROM:
subscriptionId: uuid("subscription_id")
  .notNull()
  .unique()
  .references(() => subscriptions.id),

// TO:
subscriptionId: uuid("subscription_id")
  .notNull()
  .references(() => subscriptions.id),
```

**Step 2: Change uniqueIndex to regular index for subscriptionId**

In the same file, line 161, change:

```ts
// FROM:
uniqueIndex("instances_subscription_id_idx").on(table.subscriptionId),

// TO:
index("instances_subscription_id_idx").on(table.subscriptionId),
```

**Step 3: Update relations — users.instance from one() to many()**

In `packages/shared/src/db/schema.ts`, line 25-30, change:

```ts
// FROM:
export const usersRelations = relations(users, ({ many, one }) => ({
  otpCodes: many(otpCodes),
  sessions: many(sessions),
  subscription: one(subscriptions),
  instance: one(instances),
}));

// TO:
export const usersRelations = relations(users, ({ many, one }) => ({
  otpCodes: many(otpCodes),
  sessions: many(sessions),
  subscription: one(subscriptions),
  instances: many(instances),
}));
```

**Step 4: Update subscriptionsRelations — instance from one() to many()**

In `packages/shared/src/db/schema.ts`, line 102-105, change:

```ts
// FROM:
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  instance: one(instances),
}));

// TO:
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  instances: many(instances),
}));
```

**Step 5: Generate and review migration**

```bash
cd /Users/wora/Coding/WiseSpark/SparkClaw
npx drizzle-kit generate
```

Review the generated SQL migration. It should drop the unique index on `instances.subscription_id` and create a regular index.

**Step 6: Commit**

```bash
git add packages/shared/src/db/schema.ts drizzle/
git commit -m "feat: remove unique constraints for multi-instance support"
```

---

### Task 3: API — Multi-Instance Endpoints

**Files:**
- Modify: `packages/api/src/routes/api.ts`
- Modify: `packages/shared/src/schemas.ts` (add createInstanceSchema)

**Step 1: Add createInstanceSchema to schemas**

In `packages/shared/src/schemas.ts`, add after `createCheckoutSchema`:

```ts
export const createInstanceSchema = z.object({
  instanceName: z.string().max(100).optional(),
});
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
```

**Step 2: Rewrite api.ts with multi-instance endpoints**

Replace the `/instance` GET endpoint and add new endpoints in `packages/api/src/routes/api.ts`:

```ts
import { Elysia } from "elysia";
import { createCheckoutSchema, createInstanceSchema } from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME, PLAN_INSTANCE_LIMITS } from "@sparkclaw/shared/constants";
import type { MeResponse, InstanceResponse, User, DomainStatus, Plan } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { createCheckoutSession } from "../services/stripe.js";
import { verifySession } from "../services/session.js";
import { db, subscriptions, instances } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { addProvisioningJob } from "../services/queue.js";

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
  // List all instances for the user
  .get("/instances", async ({ user }) => {
    const results = await db.query.instances.findMany({
      where: eq(instances.userId, user.id),
      with: { subscription: true },
      orderBy: (instances, { desc }) => [desc(instances.createdAt)],
    });

    const response: InstanceResponse[] = results.map((result) => ({
      id: result.id,
      instanceName: result.instanceName,
      status: result.status as InstanceResponse["status"],
      url: result.url,
      customDomain: result.customDomain,
      domainStatus: (result.domainStatus as DomainStatus) ?? "pending",
      plan: result.subscription.plan as InstanceResponse["plan"],
      subscriptionStatus: result.subscription.status as InstanceResponse["subscriptionStatus"],
      createdAt: result.createdAt.toISOString(),
    }));

    return { instances: response };
  })
  // Get single instance by ID
  .get("/instances/:id", async ({ user, params, set }) => {
    const result = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
      with: { subscription: true },
    });

    if (!result) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    const response: InstanceResponse = {
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

    return response;
  })
  // Create new instance (checks plan limit)
  .post("/instances", async ({ user, body, set }) => {
    const parsed = createInstanceSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    // Check subscription
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    if (!sub || sub.status !== "active") {
      set.status = 403;
      return { error: "Active subscription required" };
    }

    // Check instance limit
    const plan = sub.plan as Plan;
    const limit = PLAN_INSTANCE_LIMITS[plan] ?? 1;
    const existingInstances = await db.query.instances.findMany({
      where: eq(instances.userId, user.id),
    });

    if (existingInstances.length >= limit) {
      set.status = 403;
      return { error: "Instance limit reached", code: "UPGRADE_REQUIRED", limit, current: existingInstances.length };
    }

    // Queue provisioning
    await addProvisioningJob(user.id, sub.id);

    return { success: true, message: "Instance provisioning started" };
  })
  // Delete instance
  .delete("/instances/:id", async ({ user, params, set }) => {
    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
    });

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    // TODO: Delete Railway service via API when Railway deletion is implemented
    // For now, just delete from DB (cascade deletes channel_configs)
    await db.delete(instances).where(eq(instances.id, params.id));

    return { success: true };
  })
  // Keep old endpoint for backward compatibility during migration
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
      instanceName: result.instanceName,
      status: result.status as InstanceResponse["status"],
      url: result.url,
      customDomain: result.customDomain,
      domainStatus: (result.domainStatus as DomainStatus) ?? "pending",
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
git add packages/api/src/routes/api.ts packages/shared/src/schemas.ts
git commit -m "feat: add multi-instance API endpoints"
```

---

### Task 4: API — Update Setup Routes for Instance ID

**Files:**
- Modify: `packages/api/src/routes/setup.ts`
- Modify: `packages/shared/src/schemas.ts`

**Step 1: Update saveSetupSchema to include instanceId**

In `packages/shared/src/schemas.ts`, update `saveSetupSchema`:

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

Update `saveChannelCredentialsSchema`:

```ts
export const saveChannelCredentialsSchema = z.object({
  instanceId: z.string().uuid(),
  type: channelTypeSchema,
  credentials: z.record(z.string()),
});
```

**Step 2: Rewrite setup.ts to use instanceId**

The key change: instead of `findFirst where userId`, use `findFirst where instanceId AND userId` (to verify ownership).

In `packages/api/src/routes/setup.ts`:

- `/state` endpoint: accept `?instanceId=` query param
- `/save` endpoint: read `instanceId` from body
- `/channel` endpoint: read `instanceId` from body
- `/channel/:type` DELETE: accept `?instanceId=` query param

For each, replace:
```ts
const instance = await db.query.instances.findFirst({
  where: eq(instances.userId, user.id),
});
```

With:
```ts
const instance = await db.query.instances.findFirst({
  where: and(eq(instances.id, instanceId), eq(instances.userId, user.id)),
});
```

Import `and` from `drizzle-orm`.

**Step 3: Commit**

```bash
git add packages/api/src/routes/setup.ts packages/shared/src/schemas.ts
git commit -m "feat: update setup routes to use instanceId parameter"
```

---

### Task 5: Frontend API Client — Update for Multi-Instance

**Files:**
- Modify: `packages/web/src/lib/api.ts`

**Step 1: Update API functions**

Replace `getInstance()` with multi-instance functions:

```ts
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
```

Keep `getInstance()` for backward compat but mark deprecated:

```ts
/** @deprecated Use getInstances() instead */
export async function getInstance() {
  return request<InstanceResponse | { instance: null }>("/api/instance");
}
```

Update `getSetupState` to accept instanceId:

```ts
export async function getSetupState(instanceId: string) {
  return request<{ state: SetupWizardState | null }>(`/api/setup/state?instanceId=${instanceId}`);
}

export async function saveSetup(data: SaveSetupInput) {
  return request<{ success: boolean }>("/api/setup/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

**Step 2: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat: update frontend API client for multi-instance"
```

---

### Task 6: Frontend — Dashboard Instance List

**Files:**
- Modify: `packages/web/src/routes/dashboard/+page.svelte`

**Step 1: Rewrite dashboard for multi-instance**

Key changes:
- Replace single `instance` state with `instances: InstanceResponse[]`
- Show instance cards in a grid
- Add "New Instance" button
- Show upgrade modal when at limit
- Poll only instances with status "pending"

Replace the `<script>` section:

```ts
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { getMe, getInstances, createInstance, createCheckout, logout } from "$lib/api";
import { planSchema } from "@sparkclaw/shared/schemas";
import type { MeResponse, InstanceResponse } from "@sparkclaw/shared/types";

let user = $state<MeResponse | null>(null);
let instances = $state<InstanceResponse[]>([]);
let loading = $state(true);
let error = $state("");
let creating = $state(false);
let showUpgradeModal = $state(false);
let pollTimer: ReturnType<typeof setInterval> | undefined;

onMount(() => {
  loadDashboard();
  return () => { if (pollTimer) clearInterval(pollTimer); };
});

async function loadDashboard() {
  try {
    user = await getMe();
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

  const hasPending = instances.some(i => i.status === "pending");
  if (hasPending && !pollTimer) {
    pollTimer = setInterval(async () => {
      try {
        const r = await getInstances();
        instances = r.instances;
        if (!r.instances.some(i => i.status === "pending")) {
          clearInterval(pollTimer);
          pollTimer = undefined;
        }
      } catch { /* ignore */ }
    }, 5000);
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
    await refreshInstances();
    if (user) user.instanceCount++;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("UPGRADE_REQUIRED") || msg.includes("limit")) {
      showUpgradeModal = true;
    } else {
      error = msg;
    }
  } finally {
    creating = false;
  }
}

async function handleLogout() {
  await logout();
  goto("/");
}
```

For the template, replace the instance card section (the `{:else}` block after `{:else if !user.subscription}`) with a grid of instance cards and a "New Instance" button. Each card shows: instanceName (or "Instance {id.slice(0,8)}"), status badge, URL, and buttons for setup/console. At the bottom, add the upgrade modal.

**Step 2: Commit**

```bash
git add packages/web/src/routes/dashboard/+page.svelte
git commit -m "feat: dashboard multi-instance list with create and upgrade modal"
```

---

### Task 7: Frontend — Navbar Instance Switcher

**Files:**
- Modify: `packages/web/src/lib/components/Navbar.svelte`

**Step 1: Add instance switcher to Navbar**

The Navbar currently shows only public nav links. For authenticated users on dashboard/setup pages, add an instance switcher dropdown.

The switcher should:
- Only show when user is on `/dashboard`, `/setup`, or `/account` paths
- Store selected instance ID in localStorage key `sparkclaw_selected_instance`
- Show instance name + status dot
- Dropdown lists all instances
- "New Instance" link at bottom of dropdown

Since Navbar doesn't currently fetch user data, the simplest approach is to make the switcher a separate component that the dashboard passes data to, OR use a Svelte store.

Create a new store file `packages/web/src/lib/stores/instance.ts`:

```ts
import { writable } from "svelte/store";
import type { InstanceResponse } from "@sparkclaw/shared/types";

export const selectedInstanceId = writable<string | null>(
  typeof localStorage !== "undefined" ? localStorage.getItem("sparkclaw_selected_instance") : null
);

export const userInstances = writable<InstanceResponse[]>([]);

selectedInstanceId.subscribe((id) => {
  if (typeof localStorage !== "undefined" && id) {
    localStorage.setItem("sparkclaw_selected_instance", id);
  }
});
```

Then in Navbar, import the stores and conditionally render the switcher dropdown.

**Step 2: Commit**

```bash
git add packages/web/src/lib/stores/instance.ts packages/web/src/lib/components/Navbar.svelte
git commit -m "feat: add instance switcher to navbar with Svelte store"
```

---

### Task 8: Frontend — Update Setup Wizard for Instance ID

**Files:**
- Modify: `packages/web/src/routes/setup/+page.svelte`

**Step 1: Read instanceId from URL query param**

The setup wizard should read `?instance=<id>` from the URL and pass it to all API calls.

In the `<script>` section, add:

```ts
import { page } from "$app/state";

// Get instanceId from URL
const instanceId = page.url.searchParams.get("instance");

onMount(async () => {
  if (!instanceId) {
    goto("/dashboard");
    return;
  }
  try {
    const result = await getSetupState(instanceId);
    // ... rest of setup
  } catch {
    goto("/auth");
  } finally {
    loading = false;
  }
});
```

Update `handleSave` to include `instanceId` in the body:

```ts
await saveSetup({
  instanceId: instanceId!,
  instanceName: instanceName || undefined,
  channels: selectedChannels,
  aiConfig: { ... },
  features,
});
```

**Step 2: Commit**

```bash
git add packages/web/src/routes/setup/+page.svelte
git commit -m "feat: setup wizard uses instanceId from URL param"
```

---

### Task 9: Frontend — Update Pricing Page Instance Counts

**Files:**
- Modify: `packages/web/src/routes/+page.svelte` (home page pricing display)
- Modify: `packages/web/src/routes/pricing/+page.svelte`

**Step 1: Update instance counts in plan features**

In `packages/web/src/routes/+page.svelte`, line 5-8, update the plans array:

```ts
const plans = [
  { key: "starter", name: "Starter", price: 19, features: ["1 OpenClaw instance", "All 25+ channels", "Community support"] },
  { key: "pro", name: "Pro", price: 39, features: ["Up to 3 instances", "All 25+ channels", "Priority support", "Custom domain (soon)"] },
  { key: "scale", name: "Scale", price: 79, features: ["Up to 10 instances", "All 25+ channels", "Priority support", "Higher resources", "Custom domain (soon)"] },
];
```

Similarly update `packages/web/src/routes/pricing/+page.svelte` if it has a separate plans definition.

**Step 2: Commit**

```bash
git add packages/web/src/routes/+page.svelte packages/web/src/routes/pricing/+page.svelte
git commit -m "feat: update pricing pages with multi-instance limits"
```

---

### Task 10: Build and Verify

**Step 1: Type check**

```bash
cd /Users/wora/Coding/WiseSpark/SparkClaw
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/api/tsconfig.json
cd packages/web && npx svelte-check
```

Fix any type errors that arise from the changes.

**Step 2: Build frontend**

```bash
cd /Users/wora/Coding/WiseSpark/SparkClaw/packages/web
npm run build
```

**Step 3: Run existing tests**

```bash
cd /Users/wora/Coding/WiseSpark/SparkClaw
bun test
```

Fix any failures.

**Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues for multi-instance"
```

---

## Execution Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Plan limits constants + types | constants.ts, types.ts |
| 2 | DB schema remove unique constraints | schema.ts, migration |
| 3 | Multi-instance API endpoints | api.ts, schemas.ts |
| 4 | Setup routes use instanceId | setup.ts, schemas.ts |
| 5 | Frontend API client update | api.ts |
| 6 | Dashboard instance list + create | dashboard/+page.svelte |
| 7 | Navbar instance switcher | Navbar.svelte, stores/instance.ts |
| 8 | Setup wizard instanceId param | setup/+page.svelte |
| 9 | Pricing page update | +page.svelte, pricing/+page.svelte |
| 10 | Build verification | All |
