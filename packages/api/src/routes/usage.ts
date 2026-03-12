import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import type { UsageSummary, UsageType } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { db, usageRecords, instances } from "@sparkclaw/shared/db";
import { eq, and, desc, sql } from "drizzle-orm";

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPastPeriods(months: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return periods;
}

function buildUsageSummary(
  period: string,
  records: Array<{
    type: string;
    quantity: number;
    instanceId: string | null;
    instance: { instanceName: string | null } | null;
  }>,
): UsageSummary {
  const items = records.map((r) => ({
    type: r.type as UsageType,
    quantity: r.quantity,
    instanceId: r.instanceId,
    instanceName: r.instance?.instanceName ?? null,
  }));

  const totals = {} as Record<UsageType, number>;
  for (const item of items) {
    totals[item.type] = (totals[item.type] ?? 0) + item.quantity;
  }

  return { period, items, totals };
}

export const usageRoutes = new Elysia({ prefix: "/api/usage" })
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
  // ── GET /api/usage ──────────────────────────────────────────────────────────
  .get("/", async ({ user, query, set }) => {
    const requestedPeriod = query.period as string | undefined;
    if (requestedPeriod && !/^\d{4}-\d{2}$/.test(requestedPeriod)) {
      set.status = 400;
      return { error: "Invalid period format. Use YYYY-MM" };
    }
    const period = requestedPeriod ?? getCurrentPeriod();

    const records = await db.query.usageRecords.findMany({
      where: and(
        eq(usageRecords.userId, user.id),
        eq(usageRecords.period, period),
      ),
      with: { instance: true },
    });

    return buildUsageSummary(period, records);
  })
  // ── GET /api/usage/history ──────────────────────────────────────────────────
  .get("/history", async ({ user, query }) => {
    const months = Math.min(Math.max(parseInt(query.months as string) || 6, 1), 24);
    const periods = getPastPeriods(months);

    const records = await db.query.usageRecords.findMany({
      where: and(
        eq(usageRecords.userId, user.id),
        sql`${usageRecords.period} = ANY(${periods})`,
      ),
      with: { instance: true },
      orderBy: [desc(usageRecords.period)],
    });

    // Group by period
    const grouped = new Map<string, typeof records>();
    for (const record of records) {
      const existing = grouped.get(record.period) ?? [];
      existing.push(record);
      grouped.set(record.period, existing);
    }

    const history: UsageSummary[] = periods.map((p) =>
      buildUsageSummary(p, grouped.get(p) ?? []),
    );

    return { history };
  });
