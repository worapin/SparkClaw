import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  otpCodes,
  sessions,
  subscriptions,
  instances,
  channelConfigs,
} from "./db/schema.js";

// ─── Select types (read from DB) ────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type OtpCode = InferSelectModel<typeof otpCodes>;
export type Session = InferSelectModel<typeof sessions>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type Instance = InferSelectModel<typeof instances>;
export type ChannelConfigRecord = InferSelectModel<typeof channelConfigs>;

// ─── Insert types (write to DB) ─────────────────────────────────────────────

export type NewUser = InferInsertModel<typeof users>;
export type NewOtpCode = InferInsertModel<typeof otpCodes>;
export type NewSession = InferInsertModel<typeof sessions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;
export type NewInstance = InferInsertModel<typeof instances>;
export type NewChannelConfigRecord = InferInsertModel<typeof channelConfigs>;

// ─── Domain types ────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type Plan = "starter" | "pro" | "scale";
export type SubscriptionStatus = "active" | "canceled" | "past_due";
export type InstanceStatus = "pending" | "ready" | "error" | "suspended";
export type DomainStatus = "pending" | "provisioning" | "ready" | "error";

// ─── API response types ─────────────────────────────────────────────────────

export interface MeResponse {
  id: string;
  email: string;
  subscription: {
    id: string;
    plan: Plan;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  } | null;
  createdAt: string;
}

export interface InstanceResponse {
  id: string;
  status: InstanceStatus;
  url: string | null;
  customDomain: string | null;
  domainStatus: DomainStatus;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}

// ─── Setup Wizard types ──────────────────────────────────────────────────────

export type ChannelType = 
  | "telegram" 
  | "discord" 
  | "line" 
  | "whatsapp" 
  | "web" 
  | "slack" 
  | "instagram" 
  | "messenger";

export type AIModel = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet" | "claude-haiku" | "gemini-pro" | "auto";

export type BotPersona = "professional" | "friendly" | "creative" | "custom";

export type Language = "en" | "th" | "auto";

export interface SetupChannelConfig {
  type: ChannelType;
  enabled: boolean;
  // Channel-specific credentials (stored encrypted)
  credentials?: {
    // Telegram
    telegramBotToken?: string;
    // LINE
    lineChannelId?: string;
    lineChannelSecret?: string;
    lineChannelAccessToken?: string;
    // Discord
    discordBotToken?: string;
    discordApplicationId?: string;
    // WhatsApp
    whatsappPhoneNumberId?: string;
    whatsappAccessToken?: string;
    // Slack
    slackBotToken?: string;
    slackAppToken?: string;
    // Instagram/Messenger
    facebookPageId?: string;
    facebookPageAccessToken?: string;
    facebookVerifyToken?: string;
  };
}

export interface FeatureFlags {
  imageGeneration: boolean;      // DALL-E, Midjourney
  webSearch: boolean;            // Web browsing
  fileProcessing: boolean;       // PDF, doc parsing
  voiceMessages: boolean;        // Speech-to-text
  memory: boolean;               // Persistent context
  codeExecution: boolean;        // Run code
  mediaGeneration: boolean;      // Suno (music), etc.
  calendar: boolean;             // Calendar integration
  email: boolean;                // Email sending
}

export interface AIConfig {
  model: AIModel;
  persona: BotPersona;
  customPrompt?: string;
  language: Language;
  temperature: number;           // 0.0 - 2.0
  maxTokens: number;             // Response length limit
}

export interface SetupWizardData {
  channels: SetupChannelConfig[];
  aiConfig: AIConfig;
  features: FeatureFlags;
  instanceName?: string;
  timezone?: string;
  completedAt?: Date;
}

export interface SetupWizardState {
  step: number;
  instanceId: string;
  instanceUrl: string;
  isConfigured: boolean;
  setupData?: SetupWizardData;
}
