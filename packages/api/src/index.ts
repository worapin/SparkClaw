import { logger } from "./lib/logger.js";
import { validateEnv } from "@sparkclaw/shared";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { setupRoutes } from "./routes/setup.js";
import { adminRoutes } from "./routes/admin.js";

const env = validateEnv();

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
  .listen(env.PORT);

logger.info("SparkClaw API started", { url: app.server?.url?.toString() });

export type App = typeof app;
