import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_SCALE: z.string().optional(),
  RAILWAY_API_TOKEN: z.string().optional(),
  RAILWAY_PROJECT_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(8).default("dev-secret-change-in-production-min-32-chars"),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SENTRY_DSN: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  // Langfuse - LLM Observability
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().url().default("https://cloud.langfuse.com"),
  // BetterStack - Log Management
  BETTERSTACK_SOURCE_TOKEN: z.string().optional(),
  BETTERSTACK_HOST: z.string().url().default("https://s1.logs.betterstack.com"),
  // Custom domain configuration
  CUSTOM_DOMAIN_ROOT: z.string().min(1).default("sparkclaw.io"),
  REDIS_URL: z.string().optional(),
  // OpenClaw template configuration
  OPENCLAW_GITHUB_REPO: z.string().default("sparkclaw/openclaw-template"),
  PRISM_BASE_URL: z.string().url().optional(),
  PRISM_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function validateEnv(): Env {
  if (_env) return _env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }
  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error("Environment not validated. Call validateEnv() at startup.");
  return _env;
}
