import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { createScheduledJobSchema, updateScheduledJobSchema } from "@sparkclaw/shared/schemas";
import type { ScheduledJobResponse, ScheduledTaskType } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { logAudit } from "../services/audit.js";
import { logger } from "../lib/logger.js";
import { db, scheduledJobs, instances } from "@sparkclaw/shared/db";
import { eq, and, desc } from "drizzle-orm";

function toJobResponse(job: {
  id: string;
  instanceId: string;
  name: string;
  cronExpression: string;
  taskType: string;
  config: Record<string, unknown> | null;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
}): ScheduledJobResponse {
  return {
    id: job.id,
    instanceId: job.instanceId,
    name: job.name,
    cronExpression: job.cronExpression,
    taskType: job.taskType as ScheduledTaskType,
    config: job.config,
    enabled: job.enabled,
    lastRunAt: job.lastRunAt?.toISOString() ?? null,
    nextRunAt: job.nextRunAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  };
}

async function verifyInstanceOwnership(instanceId: string, userId: string) {
  const instance = await db.query.instances.findFirst({
    where: and(eq(instances.id, instanceId), eq(instances.userId, userId)),
  });
  return instance;
}

export const scheduledJobsRoutes = new Elysia({ prefix: "/api/jobs" })
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
  // ── GET /api/jobs ───────────────────────────────────────────────────────────
  .get("/", async ({ user, query }) => {
    const instanceId = query.instanceId as string | undefined;

    if (instanceId) {
      // Verify ownership of the specific instance
      const instance = await verifyInstanceOwnership(instanceId, user.id);
      if (!instance) {
        return { jobs: [] };
      }

      const jobs = await db.query.scheduledJobs.findMany({
        where: eq(scheduledJobs.instanceId, instanceId),
        orderBy: [desc(scheduledJobs.createdAt)],
      });

      return { jobs: jobs.map(toJobResponse) };
    }

    // Get all jobs for user's instances
    const userInstances = await db.query.instances.findMany({
      where: eq(instances.userId, user.id),
    });

    if (userInstances.length === 0) {
      return { jobs: [] };
    }

    const allJobs: ScheduledJobResponse[] = [];
    for (const inst of userInstances) {
      const jobs = await db.query.scheduledJobs.findMany({
        where: eq(scheduledJobs.instanceId, inst.id),
        orderBy: [desc(scheduledJobs.createdAt)],
      });
      allJobs.push(...jobs.map(toJobResponse));
    }

    return { jobs: allJobs };
  })
  // ── POST /api/jobs ──────────────────────────────────────────────────────────
  .post("/", async ({ user, body, set }) => {
    const parsed = createScheduledJobSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    const { instanceId, name, cronExpression, taskType, config } = parsed.data;

    const instance = await verifyInstanceOwnership(instanceId, user.id);
    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    const [job] = await db
      .insert(scheduledJobs)
      .values({
        instanceId,
        name,
        cronExpression,
        taskType,
        config: config ?? null,
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "scheduled_job_created",
      instanceId,
      metadata: { jobId: job.id, name, taskType },
    });

    logger.info("Scheduled job created", { userId: user.id, jobId: job.id, instanceId });

    return toJobResponse(job);
  })
  // ── PATCH /api/jobs/:id ─────────────────────────────────────────────────────
  .patch("/:id", async ({ user, params, body, set }) => {
    const parsed = updateScheduledJobSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    // Find the job and verify instance ownership
    const job = await db.query.scheduledJobs.findFirst({
      where: eq(scheduledJobs.id, params.id),
      with: { instance: true },
    });

    if (!job || job.instance.userId !== user.id) {
      set.status = 404;
      return { error: "Job not found" };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.cronExpression !== undefined) updateData.cronExpression = parsed.data.cronExpression;
    if (parsed.data.config !== undefined) updateData.config = parsed.data.config;
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;

    const [updated] = await db
      .update(scheduledJobs)
      .set(updateData)
      .where(eq(scheduledJobs.id, params.id))
      .returning();

    await logAudit({
      userId: user.id,
      action: "scheduled_job_updated",
      instanceId: job.instanceId,
      metadata: { jobId: params.id, changes: parsed.data },
    });

    logger.info("Scheduled job updated", { userId: user.id, jobId: params.id });

    return toJobResponse(updated);
  })
  // ── DELETE /api/jobs/:id ────────────────────────────────────────────────────
  .delete("/:id", async ({ user, params, set }) => {
    // Find the job and verify instance ownership
    const job = await db.query.scheduledJobs.findFirst({
      where: eq(scheduledJobs.id, params.id),
      with: { instance: true },
    });

    if (!job || job.instance.userId !== user.id) {
      set.status = 404;
      return { error: "Job not found" };
    }

    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, params.id));

    await logAudit({
      userId: user.id,
      action: "scheduled_job_deleted",
      instanceId: job.instanceId,
      metadata: { jobId: params.id, name: job.name },
    });

    logger.info("Scheduled job deleted", { userId: user.id, jobId: params.id });

    return { success: true };
  });
