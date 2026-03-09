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
import { totpSecrets } from "@sparkclaw/shared/db";
import { logAudit } from "../services/audit.js";

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

    const [userInstances, totp] = await Promise.all([
      db.query.instances.findMany({ where: eq(instances.userId, user.id) }),
      db.query.totpSecrets.findFirst({ where: eq(totpSecrets.userId, user.id) }),
    ]);

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
      totpEnabled: totp?.enabled ?? false,
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
    logAudit({ userId: user.id, action: "instance_created", metadata: { plan, count: existing.length + 1 } });

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
    logAudit({ userId: user.id, action: "instance_deleted", instanceId: params.id });

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
