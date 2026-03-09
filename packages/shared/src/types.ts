import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  otpCodes,
  sessions,
  subscriptions,
  instances,
  channelConfigs,
  apiKeys,
  auditLogs,
  totpSecrets,
  llmKeys,
  organizations,
  orgMembers,
  orgInvites,
  usageRecords,
  scheduledJobs,
  envVars,
  customSkills,
} from "./db/schema.js";

// ─── Select types (read from DB) ────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type OtpCode = InferSelectModel<typeof otpCodes>;
export type Session = InferSelectModel<typeof sessions>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type Instance = InferSelectModel<typeof instances>;
export type ChannelConfigRecord = InferSelectModel<typeof channelConfigs>;
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type TotpSecret = InferSelectModel<typeof totpSecrets>;
export type LlmKey = InferSelectModel<typeof llmKeys>;
export type Organization = InferSelectModel<typeof organizations>;
export type OrgMember = InferSelectModel<typeof orgMembers>;
export type OrgInvite = InferSelectModel<typeof orgInvites>;
export type UsageRecord = InferSelectModel<typeof usageRecords>;
export type ScheduledJob = InferSelectModel<typeof scheduledJobs>;

// ─── Insert types (write to DB) ─────────────────────────────────────────────

export type NewUser = InferInsertModel<typeof users>;
export type NewOtpCode = InferInsertModel<typeof otpCodes>;
export type NewSession = InferInsertModel<typeof sessions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;
export type NewInstance = InferInsertModel<typeof instances>;
export type NewChannelConfigRecord = InferInsertModel<typeof channelConfigs>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
export type NewTotpSecret = InferInsertModel<typeof totpSecrets>;
export type NewLlmKey = InferInsertModel<typeof llmKeys>;
export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewOrgMember = InferInsertModel<typeof orgMembers>;
export type NewOrgInvite = InferInsertModel<typeof orgInvites>;
export type NewUsageRecord = InferInsertModel<typeof usageRecords>;
export type NewScheduledJob = InferInsertModel<typeof scheduledJobs>;
export type EnvVar = InferSelectModel<typeof envVars>;
export type NewEnvVar = InferInsertModel<typeof envVars>;
export type CustomSkill = InferSelectModel<typeof customSkills>;
export type NewCustomSkill = InferInsertModel<typeof customSkills>;

// ─── Domain types ────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type Plan = "starter" | "pro" | "scale";
export type SubscriptionStatus = "active" | "canceled" | "past_due";
export type InstanceStatus = "pending" | "ready" | "error" | "suspended";
export type DomainStatus = "pending" | "provisioning" | "ready" | "error";
export type OrgRole = "owner" | "admin" | "member";
export type LlmProvider = "openai" | "anthropic" | "google" | "ollama";
export type ApiKeyScope = "instance:read" | "instance:write" | "setup:read" | "setup:write";
export type UsageType = "llm_tokens" | "messages" | "file_storage" | "api_calls";
export type ScheduledTaskType = "backup" | "report" | "data_sync" | "webhook";
export type SkillLanguage = "python" | "typescript";
export type SkillTriggerType = "command" | "event" | "schedule";
export type SkillRunStatus = "success" | "error" | "timeout";
export type InstanceAction = "start" | "stop" | "restart";

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
  instanceLimit: number;
  instanceCount: number;
  totpEnabled: boolean;
  createdAt: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AuditLogResponse {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  instanceId: string | null;
  user: { id: string; email: string };
  createdAt: string;
}

export interface OrgResponse {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrgMemberResponse {
  id: string;
  userId: string;
  email: string;
  role: OrgRole;
  createdAt: string;
}

export interface LlmKeyResponse {
  id: string;
  provider: LlmProvider;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface UsageSummary {
  period: string;
  items: Array<{
    type: UsageType;
    quantity: number;
    instanceId: string | null;
    instanceName: string | null;
  }>;
  totals: Record<UsageType, number>;
}

export interface ScheduledJobResponse {
  id: string;
  instanceId: string;
  name: string;
  cronExpression: string;
  taskType: ScheduledTaskType;
  config: Record<string, unknown> | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface InstanceResponse {
  id: string;
  instanceName: string | null;
  status: InstanceStatus;
  url: string | null;
  customDomain: string | null;
  domainStatus: DomainStatus;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}

export interface EnvVarResponse {
  id: string;
  key: string;
  value: string; // masked if isSecret
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomSkillResponse {
  id: string;
  instanceId: string;
  name: string;
  description: string | null;
  language: SkillLanguage;
  code: string;
  enabled: boolean;
  triggerType: SkillTriggerType;
  triggerValue: string | null;
  timeout: number;
  lastRunAt: string | null;
  lastRunStatus: SkillRunStatus | null;
  lastRunOutput: string | null;
  createdAt: string;
}

export interface InstanceHealthResponse {
  instanceId: string;
  status: InstanceStatus;
  healthy: boolean;
  uptime: number | null; // seconds
  lastChecked: string;
  checks: {
    api: boolean;
    channels: Record<string, boolean>;
  };
}

export interface InstanceLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SkillExecutionResult {
  success: boolean;
  output: string;
  error: string | null;
  duration: number; // ms
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
