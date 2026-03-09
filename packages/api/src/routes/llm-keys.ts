import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { createLlmKeySchema } from "@sparkclaw/shared/schemas";
import type { LlmKeyResponse } from "@sparkclaw/shared/types";
import { db, llmKeys } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { encrypt } from "../lib/crypto.js";
import { logAudit } from "../services/audit.js";
import { logger } from "../lib/logger.js";

export const llmKeysRoutes = new Elysia({ prefix: "/api/llm-keys" })
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
  // List user's LLM keys
  .get("/", async ({ user }) => {
    const keys = await db
      .select()
      .from(llmKeys)
      .where(eq(llmKeys.userId, user.id));

    const response: LlmKeyResponse[] = keys.map((k) => ({
      id: k.id,
      provider: k.provider as LlmKeyResponse["provider"],
      name: k.name,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    }));

    return response;
  })
  // Create new LLM key
  .post("/", async ({ user, body, set }) => {
    const parsed = createLlmKeySchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.flatten() };
    }

    const { provider, name, apiKey } = parsed.data;

    // Encrypt the API key before storing
    const encryptedKey = encrypt(apiKey);

    const [created] = await db
      .insert(llmKeys)
      .values({
        userId: user.id,
        provider,
        name,
        encryptedKey,
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "llm_key_added",
      metadata: { llmKeyId: created.id, provider, name },
    });

    logger.info("LLM key created", { userId: user.id, llmKeyId: created.id, provider });

    const response: LlmKeyResponse = {
      id: created.id,
      provider: created.provider as LlmKeyResponse["provider"],
      name: created.name,
      lastUsedAt: null,
      createdAt: created.createdAt.toISOString(),
    };

    return response;
  })
  // Delete LLM key
  .delete("/:id", async ({ user, params, set }) => {
    const existing = await db
      .select()
      .from(llmKeys)
      .where(and(eq(llmKeys.id, params.id), eq(llmKeys.userId, user.id)));

    if (existing.length === 0) {
      set.status = 404;
      return { error: "LLM key not found" };
    }

    await db
      .delete(llmKeys)
      .where(and(eq(llmKeys.id, params.id), eq(llmKeys.userId, user.id)));

    await logAudit({
      userId: user.id,
      action: "llm_key_deleted",
      metadata: { llmKeyId: params.id, provider: existing[0].provider, name: existing[0].name },
    });

    logger.info("LLM key deleted", { userId: user.id, llmKeyId: params.id });

    return { success: true };
  });
