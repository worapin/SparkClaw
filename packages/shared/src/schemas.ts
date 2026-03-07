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
  instanceName: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  channels: z.array(channelConfigSchema).min(1, "Select at least one channel"),
  aiConfig: aiConfigSchema,
  features: featureFlagsSchema,
});

export const saveChannelCredentialsSchema = z.object({
  type: channelTypeSchema,
  credentials: z.record(z.string()),
});

// Infer request types from schemas
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type SaveSetupInput = z.infer<typeof saveSetupSchema>;
export type SaveChannelCredentialsInput = z.infer<typeof saveChannelCredentialsSchema>;
