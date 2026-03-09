import { logger } from "./lib/logger.js";
import { validateEnv } from "@sparkclaw/shared";
import { initSentry, flushTelemetry } from "./lib/observability.js";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { setupRoutes } from "./routes/setup.js";
import { adminRoutes } from "./routes/admin.js";
import { adminAuditRoutes } from "./routes/admin-audit.js";
import { apiKeysRoutes } from "./routes/api-keys.js";
import { totpRoutes } from "./routes/totp.js";
import { llmKeysRoutes } from "./routes/llm-keys.js";
import { orgRoutes } from "./routes/orgs.js";
import { usageRoutes } from "./routes/usage.js";
import { scheduledJobsRoutes } from "./routes/scheduled-jobs.js";
import { instanceActionsRoutes } from "./routes/instance-actions.js";
import { envVarsRoutes } from "./routes/env-vars.js";
import { customSkillsRoutes } from "./routes/custom-skills.js";

const env = validateEnv();

// Initialize observability (Sentry)
initSentry();

const app = new Elysia()
  .use(cors({
    origin: env.WEB_URL,
    credentials: true,
  }))
  .get("/health", () => ({ status: "ok" }))
  .use(authRoutes)
  .use(apiRoutes)
  .use(webhookRoutes)
  .use(setupRoutes)
  .use(adminRoutes)
  .use(adminAuditRoutes)
  .use(apiKeysRoutes)
  .use(totpRoutes)
  .use(llmKeysRoutes)
  .use(orgRoutes)
  .use(usageRoutes)
  .use(scheduledJobsRoutes)
  .use(instanceActionsRoutes)
  .use(envVarsRoutes)
  .use(customSkillsRoutes)
  .listen(env.PORT);

logger.info("SparkClaw API started", { url: app.server?.url?.toString() });

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await flushTelemetry();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await flushTelemetry();
  process.exit(0);
});

export type App = typeof app;
