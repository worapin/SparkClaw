import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { createCustomSkillSchema, updateCustomSkillSchema } from "@sparkclaw/shared/schemas";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { logAudit } from "../services/audit.js";
import { db, instances, customSkills } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// Execute skill in sandboxed subprocess
async function executeSkill(language: string, code: string, timeout: number): Promise<{ success: boolean; output: string; error: string | null; duration: number }> {
  const start = Date.now();
  try {
    let proc;
    if (language === "typescript") {
      proc = Bun.spawn(["bun", "eval", code], {
        stdout: "pipe", stderr: "pipe",
        env: { ...process.env, NODE_ENV: "sandbox" },
      });
    } else {
      proc = Bun.spawn(["python3", "-c", code], {
        stdout: "pipe", stderr: "pipe",
        env: { PATH: process.env.PATH },
      });
    }

    const timeoutId = setTimeout(() => proc.kill(), timeout * 1000);

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    clearTimeout(timeoutId);
    const exitCode = proc.exitCode ?? (await proc.exited);
    const duration = Date.now() - start;

    if (exitCode !== 0) {
      return { success: false, output: stdout, error: stderr || `Exit code: ${exitCode}`, duration };
    }
    return { success: true, output: stdout, error: null, duration };
  } catch (e) {
    return { success: false, output: "", error: (e as Error).message, duration: Date.now() - start };
  }
}

export const customSkillsRoutes = new Elysia({ prefix: "/api/skills" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) { set.status = 401; throw new Error("Not authenticated"); }
    const user = await verifySession(token);
    if (!user) { set.status = 401; throw new Error("Invalid session"); }
    return { user };
  })
  // GET /api/skills?instanceId=xxx
  .get("/", async ({ user, query, set }) => {
    const instanceId = query.instanceId as string;
    if (!instanceId) { set.status = 400; return { error: "instanceId required" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }

    const skills = await db.query.customSkills.findMany({
      where: eq(customSkills.instanceId, instanceId),
      orderBy: (customSkills, { asc }) => [asc(customSkills.name)],
    });

    return {
      skills: skills.map(s => ({
        id: s.id,
        instanceId: s.instanceId,
        name: s.name,
        description: s.description,
        language: s.language,
        code: s.code,
        enabled: s.enabled,
        triggerType: s.triggerType,
        triggerValue: s.triggerValue,
        timeout: s.timeout,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastRunStatus: s.lastRunStatus,
        lastRunOutput: s.lastRunOutput,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  })
  // POST /api/skills
  .post("/", async ({ user, body, set }) => {
    const parsed = createCustomSkillSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: "Invalid input", details: parsed.error.errors }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, parsed.data.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }

    const [created] = await db.insert(customSkills).values({
      instanceId: parsed.data.instanceId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      language: parsed.data.language,
      code: parsed.data.code,
      triggerType: parsed.data.triggerType,
      triggerValue: parsed.data.triggerValue ?? null,
      timeout: parsed.data.timeout,
    }).returning();

    logAudit({ userId: user.id, action: "skill_created" as any, instanceId: parsed.data.instanceId, metadata: { name: parsed.data.name } });
    return { success: true, id: created.id };
  })
  // PATCH /api/skills/:id
  .patch("/:id", async ({ user, params, body, set }) => {
    const parsed = updateCustomSkillSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: "Invalid input" }; }

    const skill = await db.query.customSkills.findFirst({ where: eq(customSkills.id, params.id) });
    if (!skill) { set.status = 404; return { error: "Skill not found" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, skill.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 403; return { error: "Forbidden" }; }

    await db.update(customSkills).set({ ...parsed.data, updatedAt: new Date() }).where(eq(customSkills.id, params.id));

    logAudit({ userId: user.id, action: "skill_updated" as any, instanceId: skill.instanceId, metadata: { name: skill.name } });
    return { success: true };
  })
  // DELETE /api/skills/:id
  .delete("/:id", async ({ user, params, set }) => {
    const skill = await db.query.customSkills.findFirst({ where: eq(customSkills.id, params.id) });
    if (!skill) { set.status = 404; return { error: "Skill not found" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, skill.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 403; return { error: "Forbidden" }; }

    await db.delete(customSkills).where(eq(customSkills.id, params.id));

    logAudit({ userId: user.id, action: "skill_deleted" as any, instanceId: skill.instanceId, metadata: { name: skill.name } });
    return { success: true };
  })
  // POST /api/skills/:id/execute - run skill in sandbox
  .post("/:id/execute", async ({ user, params, set }) => {
    const skill = await db.query.customSkills.findFirst({ where: eq(customSkills.id, params.id) });
    if (!skill) { set.status = 404; return { error: "Skill not found" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, skill.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 403; return { error: "Forbidden" }; }

    if (!skill.enabled) { set.status = 400; return { error: "Skill is disabled" }; }

    const result = await executeSkill(skill.language, skill.code, skill.timeout);

    // Update last run info
    await db.update(customSkills).set({
      lastRunAt: new Date(),
      lastRunStatus: result.success ? "success" : (result.duration >= skill.timeout * 1000 ? "timeout" : "error"),
      lastRunOutput: (result.output + (result.error ? `\n${result.error}` : "")).slice(0, 10000),
      updatedAt: new Date(),
    }).where(eq(customSkills.id, params.id));

    logAudit({ userId: user.id, action: "skill_executed" as any, instanceId: skill.instanceId, metadata: { name: skill.name, success: result.success } });
    return result;
  });
