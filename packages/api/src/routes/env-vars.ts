import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { createEnvVarSchema, updateEnvVarSchema } from "@sparkclaw/shared/schemas";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { logAudit } from "../services/audit.js";
import { db, instances, envVars } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";

export const envVarsRoutes = new Elysia({ prefix: "/api/env-vars" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) { set.status = 401; throw new Error("Not authenticated"); }
    const user = await verifySession(token);
    if (!user) { set.status = 401; throw new Error("Invalid session"); }
    return { user };
  })
  // GET /api/env-vars?instanceId=xxx
  .get("/", async ({ user, query, set }) => {
    const instanceId = query.instanceId as string;
    if (!instanceId) { set.status = 400; return { error: "instanceId required" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }

    const vars = await db.query.envVars.findMany({
      where: eq(envVars.instanceId, instanceId),
      orderBy: (envVars, { asc }) => [asc(envVars.key)],
    });

    return {
      vars: vars.map(v => ({
        id: v.id,
        key: v.key,
        value: v.isSecret ? "••••••••" : decrypt(v.encryptedValue),
        isSecret: v.isSecret,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    };
  })
  // POST /api/env-vars
  .post("/", async ({ user, body, set }) => {
    const parsed = createEnvVarSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: "Invalid input", details: parsed.error.errors }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, parsed.data.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }

    const encrypted = encrypt(parsed.data.value);

    const [created] = await db.insert(envVars).values({
      instanceId: parsed.data.instanceId,
      key: parsed.data.key,
      encryptedValue: encrypted,
      isSecret: parsed.data.isSecret,
    }).returning();

    logAudit({ userId: user.id, action: "env_var_created" as any, instanceId: parsed.data.instanceId, metadata: { key: parsed.data.key } });

    return { success: true, id: created.id };
  })
  // PATCH /api/env-vars/:id
  .patch("/:id", async ({ user, params, body, set }) => {
    const parsed = updateEnvVarSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: "Invalid input" }; }

    const envVar = await db.query.envVars.findFirst({ where: eq(envVars.id, params.id) });
    if (!envVar) { set.status = 404; return { error: "Env var not found" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, envVar.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 403; return { error: "Forbidden" }; }

    const encrypted = encrypt(parsed.data.value);
    await db.update(envVars).set({ encryptedValue: encrypted, updatedAt: new Date() }).where(eq(envVars.id, params.id));

    logAudit({ userId: user.id, action: "env_var_updated" as any, instanceId: envVar.instanceId, metadata: { key: envVar.key } });
    return { success: true };
  })
  // DELETE /api/env-vars/:id
  .delete("/:id", async ({ user, params, set }) => {
    const envVar = await db.query.envVars.findFirst({ where: eq(envVars.id, params.id) });
    if (!envVar) { set.status = 404; return { error: "Env var not found" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, envVar.instanceId), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 403; return { error: "Forbidden" }; }

    await db.delete(envVars).where(eq(envVars.id, params.id));

    logAudit({ userId: user.id, action: "env_var_deleted" as any, instanceId: envVar.instanceId, metadata: { key: envVar.key } });
    return { success: true };
  });
