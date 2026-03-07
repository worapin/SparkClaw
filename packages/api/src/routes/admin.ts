import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import type { User, UserRole } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { db, users, instances, subscriptions } from "@sparkclaw/shared/db";
import { eq, sql, count, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// Admin email whitelist (configure via env)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

// Check if user is admin
function isAdmin(user: User): boolean {
  return user.role === "admin" || ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// Admin middleware - inline version to avoid type issues
const checkAdmin = async (cookie: Record<string, { value?: unknown }>) => {
  const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const user = await verifySession(token);
  if (!user) {
    throw new Error("Invalid or expired session");
  }

  if (!isAdmin(user)) {
    throw new Error("Admin access required");
  }

  return user;
};

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(csrfMiddleware)
  // Get admin dashboard stats
  .get("/stats", async ({ cookie, set }) => {
    const admin = await checkAdmin(cookie);
    
    // Get counts
    const [userCount] = await db.select({ count: count() }).from(users);
    const [instanceCount] = await db.select({ count: count() }).from(instances);
    const [subscriptionCount] = await db.select({ count: count() }).from(subscriptions);
    
    // Get instances by status
    const instancesByStatus = await db
      .select({
        status: instances.status,
        count: count(),
      })
      .from(instances)
      .groupBy(instances.status);
    
    // Get subscriptions by plan
    const subscriptionsByPlan = await db
      .select({
        plan: subscriptions.plan,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan);
    
    // Recent signups (last 7 days)
    const recentSignups = await db
      .select({ count: count() })
      .from(users)
      .where(sql`created_at > NOW() - INTERVAL '7 days'`);

    logger.info("Admin stats retrieved", { adminId: admin.id });

    return {
      users: userCount.count,
      instances: instanceCount.count,
      subscriptions: subscriptionCount.count,
      instancesByStatus: Object.fromEntries(instancesByStatus.map(s => [s.status, s.count])),
      subscriptionsByPlan: Object.fromEntries(subscriptionsByPlan.map(s => [s.plan, s.count])),
      recentSignups: recentSignups[0]?.count ?? 0,
    };
  })
  // List users
  .get("/users", async ({ cookie, set, query }) => {
    const admin = await checkAdmin(cookie);
    const page = parseInt(query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = query.search as string || "";

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

    const [totalCount] = await db
      .select({ count: count() })
      .from(users)
      .where(search ? sql`email ILIKE ${`%${search}%`}` : undefined);

    logger.info("Admin listed users", { adminId: admin.id, page, search });

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
      pagination: {
        page,
        totalPages: Math.ceil(totalCount.count / limit),
        total: totalCount.count,
      },
    };
  })
  // List instances
  .get("/instances", async ({ cookie, set, query }) => {
    const admin = await checkAdmin(cookie);
    const page = parseInt(query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const status = query.status as string;

    const instanceList = await db.query.instances.findMany({
      where: status ? eq(instances.status, status) : undefined,
      limit,
      offset,
      orderBy: [desc(instances.createdAt)],
      with: {
        user: true,
        subscription: true,
      },
    });

    const [totalCount] = await db
      .select({ count: count() })
      .from(instances)
      .where(status ? eq(instances.status, status) : undefined);

    logger.info("Admin listed instances", { adminId: admin.id, page, status });

    return {
      instances: instanceList.map(i => ({
        id: i.id,
        url: i.url,
        customDomain: i.customDomain,
        status: i.status,
        domainStatus: i.domainStatus,
        setupCompleted: i.setupCompleted,
        createdAt: i.createdAt.toISOString(),
        user: {
          email: i.user.email,
        },
        subscription: {
          plan: i.subscription.plan,
        },
      })),
      pagination: {
        page,
        totalPages: Math.ceil(totalCount.count / limit),
        total: totalCount.count,
      },
    };
  })
  // Update user role
  .patch("/users/:id/role", async ({ cookie, set, params, body }) => {
    const admin = await checkAdmin(cookie);
    const userId = params.id;
    const { role } = body as { role: UserRole };

    if (!["user", "admin"].includes(role)) {
      set.status = 400;
      return { error: "Invalid role" };
    }

    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));

    logger.info("Admin updated user role", { adminId: admin.id, userId, newRole: role });

    return { success: true };
  })
  // Get user details
  .get("/users/:id", async ({ cookie, set, params }) => {
    const admin = await checkAdmin(cookie);
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, params.id),
      with: {
        subscription: true,
        instance: {
          with: {
            channelConfigs: true,
          },
        },
      },
    });

    if (!user) {
      set.status = 404;
      return { error: "User not found" };
    }

    logger.info("Admin viewed user details", { adminId: admin.id, userId: params.id });

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
  })
  // Check if current user is admin
  .get("/check", async ({ cookie, set }) => {
    try {
      const user = await checkAdmin(cookie);
      return { isAdmin: true, user: { id: user.id, email: user.email } };
    } catch {
      return { isAdmin: false, user: null };
    }
  });
