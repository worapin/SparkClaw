import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { createApiKeySchema } from "@sparkclaw/shared/schemas";
import type { ApiKeyResponse } from "@sparkclaw/shared/types";
import { db, apiKeys } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { generateApiKey } from "../lib/crypto.js";
import { logAudit } from "../services/audit.js";
import { logger } from "../lib/logger.js";

export const apiKeysRoutes = new Elysia({ prefix: "/api/keys" })
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
  // List user's API keys
  .get("/", async ({ user }) => {
    const keys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));

    const response: ApiKeyResponse[] = keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes as ApiKeyResponse["scopes"],
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    }));

    return response;
  })
  // Create new API key
  .post("/", async ({ user, body, set }) => {
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.flatten() };
    }

    const { name, scopes, expiresInDays } = parsed.data;
    const { key, prefix, hash } = generateApiKey();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [created] = await db
      .insert(apiKeys)
      .values({
        userId: user.id,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes,
        expiresAt,
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "api_key_created",
      metadata: { apiKeyId: created.id, name, scopes },
    });

    logger.info("API key created", { userId: user.id, apiKeyId: created.id });

    return {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      lastUsedAt: null,
      expiresAt: created.expiresAt?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
      key, // Only returned on creation
    };
  })
  // Delete API key
  .delete("/:id", async ({ user, params, set }) => {
    const existing = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, params.id), eq(apiKeys.userId, user.id)));

    if (existing.length === 0) {
      set.status = 404;
      return { error: "API key not found" };
    }

    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, params.id), eq(apiKeys.userId, user.id)));

    await logAudit({
      userId: user.id,
      action: "api_key_deleted",
      metadata: { apiKeyId: params.id, name: existing[0].name },
    });

    logger.info("API key deleted", { userId: user.id, apiKeyId: params.id });

    return { success: true };
  });
