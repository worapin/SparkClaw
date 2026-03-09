import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { db, auditLogs, users } from "@sparkclaw/shared/db";
import { eq, desc, sql, and } from "drizzle-orm";

export const adminAuditRoutes = new Elysia({ prefix: "/api/admin" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }
    const user = await verifySession(token);
    if (!user || user.role !== "admin") {
      set.status = 403;
      throw new Error("Forbidden");
    }
    return { user };
  })
  .get("/audit", async ({ query }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const action = query.action as string | undefined;

    const conditions = action ? eq(auditLogs.action, action) : undefined;

    const [logs, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          metadata: auditLogs.metadata,
          ip: auditLogs.ip,
          instanceId: auditLogs.instanceId,
          createdAt: auditLogs.createdAt,
          userId: auditLogs.userId,
          userEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(conditions)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(conditions),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        metadata: l.metadata,
        ip: l.ip,
        instanceId: l.instanceId,
        user: { id: l.userId, email: l.userEmail ?? "unknown" },
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    };
  });
