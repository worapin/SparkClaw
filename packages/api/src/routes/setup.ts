import { Elysia } from "elysia";
import { 
  saveSetupSchema, 
  saveChannelCredentialsSchema
} from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import type { SetupWizardState } from "@sparkclaw/shared/types";
import type { SaveSetupInput } from "@sparkclaw/shared/schemas";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { db, instances, channelConfigs } from "@sparkclaw/shared/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { configureOpenClaw } from "../services/openclaw.js";

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
  // Get setup wizard state
  .get("/state", async ({ user }) => {
    const instance = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
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
        aiConfig: instance.aiConfig as any ?? {
          model: "auto",
          persona: "friendly",
          language: "auto",
          temperature: 0.7,
          maxTokens: 4000,
        },
        features: instance.features as any ?? {
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
  // Save setup wizard data
  .post("/save", async ({ user, body, set }) => {
    const parsed = saveSetupSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid setup data", details: parsed.error.errors };
    }

    const data = parsed.data as SaveSetupInput;

    const instance = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
    });

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
        where: (c, { and }) => 
          and(eq(c.instanceId, instance.id), eq(c.type, channel.type)),
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
      channels: data.channels.filter((c: { enabled: boolean }) => c.enabled).map((c: { type: string }) => c.type),
    });

    // Configure OpenClaw with the new settings
    if (instance.url) {
      const gatewayToken = Buffer.from(`${instance.id}:${process.env.SESSION_SECRET}`).toString("base64");
      
      try {
        await configureOpenClaw(instance.url, {
          instanceId: instance.id,
          userId: user.id,
          gatewayToken,
        });
      } catch (error) {
        logger.warn("Failed to configure OpenClaw", { 
          instanceId: instance.id, 
          error: (error as Error).message 
        });
        // Continue - instance is still usable
      }
    }

    return { success: true };
  })
  // Save channel credentials (separate endpoint for security)
  .post("/channel", async ({ user, body, set }) => {
    const parsed = saveChannelCredentialsSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid channel data", details: parsed.error.errors };
    }

    const { type, credentials } = parsed.data;

    const instance = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
    });

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    // Upsert channel config
    const existing = await db.query.channelConfigs.findFirst({
      where: (c, { and }) => 
        and(eq(c.instanceId, instance.id), eq(c.type, type)),
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
  // Delete channel configuration
  .delete("/channel/:type", async ({ user, params, set }) => {
    const instance = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
    });

    if (!instance) {
      set.status = 404;
      return { error: "Instance not found" };
    }

    await db
      .delete(channelConfigs)
      .where(eq(channelConfigs.instanceId, instance.id));

    logger.info("Channel configuration deleted", { 
      userId: user.id, 
      instanceId: instance.id,
      channelType: params.type,
    });

    return { success: true };
  });
