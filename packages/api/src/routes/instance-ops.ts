import { Elysia } from "elysia";
import { verifySession } from "../services/session.js";
import { db } from "@sparkclaw/shared/db";
import { instances, orgMembers } from "@sparkclaw/shared/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import {
  isMCConfigured,
  createMCWorkspace,
  fetchMCCosts,
  fetchMCCostTrends,
  fetchMCAgentHealth,
  fetchMCSecurityAudit,
  fetchMCMemory,
} from "../services/mission-control.js";
import type { OpsPeriod, OpsUnavailableResponse } from "@sparkclaw/shared/types";

const UNAVAILABLE: OpsUnavailableResponse = { available: false };
const VALID_PERIODS = new Set<OpsPeriod>(["24h", "7d", "30d"]);

function validatePeriod(raw: string | undefined): OpsPeriod {
  if (raw && VALID_PERIODS.has(raw as OpsPeriod)) return raw as OpsPeriod;
  return "24h";
}

// No CSRF middleware — all routes are GET-only (read operations)
export const instanceOpsRoutes = new Elysia({ prefix: "/api/instances" })

  // ── Auth + instance resolution ─────────────────────────────────
  .resolve(async ({ cookie, set, params }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }

    const user = await verifySession(token);
    if (!user) {
      set.status = 401;
      throw new Error("Invalid session");
    }

    const id = (params as { id?: string }).id;
    if (!id) {
      set.status = 400;
      throw new Error("Instance ID required");
    }

    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, id),
    });

    if (!instance) {
      set.status = 404;
      throw new Error("Instance not found");
    }

    // Check direct ownership or org membership
    if (instance.userId !== user.id) {
      // Check if user is in the same org as the instance owner
      const ownerOrgs = await db.query.orgMembers.findMany({
        where: eq(orgMembers.userId, instance.userId),
      });
      const ownerOrgIds = ownerOrgs.map((o) => o.orgId);

      let hasAccess = false;
      if (ownerOrgIds.length > 0) {
        const userOrgs = await db.query.orgMembers.findMany({
          where: eq(orgMembers.userId, user.id),
        });
        hasAccess = userOrgs.some((o) => ownerOrgIds.includes(o.orgId));
      }

      if (!hasAccess) {
        set.status = 404;
        throw new Error("Instance not found");
      }
    }

    return { user, instance };
  })

  // ── Lazy workspace creation helper ─────────────────────────────
  .derive(({ instance }) => {
    return {
      getWorkspaceId: async (): Promise<string | null> => {
        if (instance.mcWorkspaceId) return instance.mcWorkspaceId;

        if (!isMCConfigured()) return null;

        // Lazy-create workspace
        const workspaceId = await createMCWorkspace(
          instance.id,
          instance.instanceName || instance.id,
        );

        if (workspaceId) {
          await db
            .update(instances)
            .set({ mcWorkspaceId: workspaceId, updatedAt: new Date() })
            .where(eq(instances.id, instance.id));
        }

        return workspaceId;
      },
    };
  })

  // ── Routes ─────────────────────────────────────────────────────

  .get("/:id/ops/costs", async ({ getWorkspaceId, set, query }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    const period = validatePeriod((query as { period?: string }).period);

    try {
      return await fetchMCCosts(workspaceId, period);
    } catch (error) {
      logger.error("Failed to fetch MC costs", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/costs/trends", async ({ getWorkspaceId, set, query }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    const period = validatePeriod((query as { period?: string }).period);

    try {
      return await fetchMCCostTrends(workspaceId, period);
    } catch (error) {
      logger.error("Failed to fetch MC cost trends", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/health", async ({ getWorkspaceId, set }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    try {
      return await fetchMCAgentHealth(workspaceId);
    } catch (error) {
      logger.error("Failed to fetch MC agent health", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/security", async ({ getWorkspaceId, set }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    try {
      return await fetchMCSecurityAudit(workspaceId);
    } catch (error) {
      logger.error("Failed to fetch MC security audit", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/memory", async ({ getWorkspaceId, set }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    try {
      return await fetchMCMemory(workspaceId);
    } catch (error) {
      logger.error("Failed to fetch MC memory", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  });
