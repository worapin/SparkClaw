import { z } from "zod";

export const emailSchema = z.string().email().max(255);

export const otpCodeSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

export const planSchema = z.enum(["starter", "pro", "scale"]);

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

export const createCheckoutSchema = z.object({
  plan: planSchema,
});

export const createInstanceSchema = z.object({
  instanceName: z.string().max(100).optional(),
});

// ─── Setup Wizard schemas ─────────────────────────────────────────────────────

export const channelTypeSchema = z.enum([
  "telegram",
  "discord",
  "line",
  "whatsapp",
  "web",
  "slack",
  "instagram",
  "messenger",
]);

export const aiModelSchema = z.enum(["gpt-4o", "gpt-4o-mini", "claude-sonnet", "claude-haiku", "gemini-pro", "auto"]);

export const botPersonaSchema = z.enum(["professional", "friendly", "creative", "custom"]);

export const languageSchema = z.enum(["en", "th", "auto"]);

export const featureFlagsSchema = z.object({
  imageGeneration: z.boolean().default(true),
  webSearch: z.boolean().default(true),
  fileProcessing: z.boolean().default(true),
  voiceMessages: z.boolean().default(false),
  memory: z.boolean().default(true),
  codeExecution: z.boolean().default(false),
  mediaGeneration: z.boolean().default(false),
  calendar: z.boolean().default(false),
  email: z.boolean().default(false),
});

export const aiConfigSchema = z.object({
  model: aiModelSchema.default("auto"),
  persona: botPersonaSchema.default("friendly"),
  customPrompt: z.string().max(2000).optional(),
  language: languageSchema.default("auto"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(100).max(8000).default(4000),
});

export const channelConfigSchema = z.object({
  type: channelTypeSchema,
  enabled: z.boolean(),
  credentials: z.record(z.string()).optional(),
});

export const saveSetupSchema = z.object({
  instanceId: z.string().uuid(),
  instanceName: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  channels: z.array(channelConfigSchema).min(1, "Select at least one channel"),
  aiConfig: aiConfigSchema,
  features: featureFlagsSchema,
});

export const saveChannelCredentialsSchema = z.object({
  instanceId: z.string().uuid(),
  type: channelTypeSchema,
  credentials: z.record(z.string()),
});

// ─── API Key schemas ─────────────────────────────────────────────────────────

export const apiKeyScopeSchema = z.enum(["instance:read", "instance:write", "setup:read", "setup:write"]);

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(apiKeyScopeSchema).min(1),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// ─── TOTP schemas ────────────────────────────────────────────────────────────

export const verifyTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "TOTP must be 6 digits"),
});

// ─── BYOK (LLM Key) schemas ─────────────────────────────────────────────────

export const llmProviderSchema = z.enum(["openai", "anthropic", "google", "ollama"]);

export const createLlmKeySchema = z.object({
  provider: llmProviderSchema,
  name: z.string().min(1).max(100),
  apiKey: z.string().min(1).max(500),
});

// ─── Organization schemas ────────────────────────────────────────────────────

export const orgRoleSchema = z.enum(["owner", "admin", "member"]);

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export const inviteOrgMemberSchema = z.object({
  email: z.string().email().max(255),
  role: orgRoleSchema.default("member"),
});

export const updateOrgMemberRoleSchema = z.object({
  role: orgRoleSchema,
});

// ─── Scheduled Job schemas ───────────────────────────────────────────────────

export const scheduledTaskTypeSchema = z.enum(["backup", "report", "data_sync", "webhook"]);

export const createScheduledJobSchema = z.object({
  instanceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  cronExpression: z.string().min(1).max(50),
  taskType: scheduledTaskTypeSchema,
  config: z.record(z.unknown()).optional(),
});

export const updateScheduledJobSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cronExpression: z.string().min(1).max(50).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

// ─── Infer request types from schemas ────────────────────────────────────────

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type SaveSetupInput = z.infer<typeof saveSetupSchema>;
export type SaveChannelCredentialsInput = z.infer<typeof saveChannelCredentialsSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;
export type CreateLlmKeyInput = z.infer<typeof createLlmKeySchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type InviteOrgMemberInput = z.infer<typeof inviteOrgMemberSchema>;
export type CreateScheduledJobInput = z.infer<typeof createScheduledJobSchema>;
export type UpdateScheduledJobInput = z.infer<typeof updateScheduledJobSchema>;

// ─── Env Var schemas ────────────────────────────────────────────────────────

export const createEnvVarSchema = z.object({
  instanceId: z.string().uuid(),
  key: z.string().min(1).max(255).regex(/^[A-Z_][A-Z0-9_]*$/, "Must be uppercase with underscores"),
  value: z.string().min(1).max(10000),
  isSecret: z.boolean().default(false),
});

export const updateEnvVarSchema = z.object({
  value: z.string().min(1).max(10000),
});

// ─── Custom Skill schemas ───────────────────────────────────────────────────

export const skillLanguageSchema = z.enum(["python", "typescript"]);
export const skillTriggerTypeSchema = z.enum(["manual", "cron", "event", "webhook"]);

export const createCustomSkillSchema = z.object({
  instanceId: z.string().uuid(),
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_-]*$/, "Lowercase with hyphens/underscores"),
  description: z.string().max(500).optional(),
  language: skillLanguageSchema,
  code: z.string().min(1).max(50000),
  triggerType: skillTriggerTypeSchema.default("manual"),
  triggerValue: z.string().max(100).optional(),
  timeout: z.number().min(1).max(300).default(30),
});

export const updateCustomSkillSchema = z.object({
  description: z.string().max(500).optional(),
  code: z.string().min(1).max(50000).optional(),
  enabled: z.boolean().optional(),
  triggerType: skillTriggerTypeSchema.optional(),
  triggerValue: z.string().max(100).optional(),
  timeout: z.number().min(1).max(300).optional(),
});

// ─── Instance Action schema ─────────────────────────────────────────────────

export const instanceActionSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
});

export type CreateEnvVarInput = z.infer<typeof createEnvVarSchema>;
export type UpdateEnvVarInput = z.infer<typeof updateEnvVarSchema>;
export type CreateCustomSkillInput = z.infer<typeof createCustomSkillSchema>;
export type UpdateCustomSkillInput = z.infer<typeof updateCustomSkillSchema>;
export type InstanceActionInput = z.infer<typeof instanceActionSchema>;
