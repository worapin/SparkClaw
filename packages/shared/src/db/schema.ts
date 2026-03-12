import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
  boolean,
  real,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  otpCodes: many(otpCodes),
  sessions: many(sessions),
  subscription: one(subscriptions),
  instances: many(instances),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  totpSecret: one(totpSecrets),
  llmKeys: many(llmKeys),
  orgMemberships: many(orgMembers),
}));

// ─── otp_codes ───────────────────────────────────────────────────────────────

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("otp_codes_email_idx").on(table.email),
    index("otp_codes_expires_at_idx").on(table.expiresAt),
  ],
);

// ─── sessions ────────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ─── subscriptions ───────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    plan: varchar("plan", { length: 20 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 })
      .notNull()
      .unique(),
    status: varchar("status", { length: 20 }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_stripe_customer_id_idx").on(table.stripeCustomerId),
    uniqueIndex("subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId,
    ),
  ],
);

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  instances: many(instances),
}));

// ─── instances ───────────────────────────────────────────────────────────────

export const instances = pgTable(
  "instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
    railwayProjectId: varchar("railway_project_id", { length: 255 }).notNull(),
    railwayServiceId: varchar("railway_service_id", { length: 255 }),
    // Custom domain (user-facing)
    customDomain: varchar("custom_domain", { length: 255 }),
    // Internal Railway domain (hidden from users)
    railwayUrl: text("railway_url"),
    // Public URL shown to users (points to custom domain)
    url: text("url"),
    status: varchar("status", { length: 20 }).notNull(),
    domainStatus: varchar("domain_status", { length: 20 }).default("pending"),
    // Setup wizard state
    setupCompleted: boolean("setup_completed").default(false),
    instanceName: varchar("instance_name", { length: 100 }),
    timezone: varchar("timezone", { length: 50 }).default("UTC"),
    // AI Configuration (stored as JSON)
    aiConfig: jsonb("ai_config").$type<{
      model: string;
      persona: string;
      customPrompt?: string;
      language: string;
      temperature: number;
      maxTokens: number;
    }>(),
    // Feature flags (stored as JSON)
    features: jsonb("features").$type<{
      imageGeneration: boolean;
      webSearch: boolean;
      fileProcessing: boolean;
      voiceMessages: boolean;
      memory: boolean;
      codeExecution: boolean;
      mediaGeneration: boolean;
      calendar: boolean;
      email: boolean;
    }>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("instances_user_id_idx").on(table.userId),
    index("instances_subscription_id_idx").on(table.subscriptionId),
    index("instances_status_idx").on(table.status),
    uniqueIndex("instances_custom_domain_idx").on(table.customDomain),
    index("instances_domain_status_idx").on(table.domainStatus),
    index("instances_setup_completed_idx").on(table.setupCompleted),
  ],
);

export const instancesRelations = relations(instances, ({ one, many }) => ({
  user: one(users, { fields: [instances.userId], references: [users.id] }),
  subscription: one(subscriptions, {
    fields: [instances.subscriptionId],
    references: [subscriptions.id],
  }),
  channelConfigs: many(channelConfigs),
  auditLogs: many(auditLogs),
  usageRecords: many(usageRecords),
  scheduledJobs: many(scheduledJobs),
  envVars: many(envVars),
  customSkills: many(customSkills),
}));

// ─── channel_configs ──────────────────────────────────────────────────────────

export const channelConfigs = pgTable(
  "channel_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    // Encrypted credentials (JSON blob)
    credentials: jsonb("credentials").$type<Record<string, string>>(),
    // Channel-specific settings
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("channel_configs_instance_id_idx").on(table.instanceId),
    uniqueIndex("channel_configs_instance_type_idx").on(table.instanceId, table.type),
  ],
);

export const channelConfigsRelations = relations(channelConfigs, ({ one }) => ({
  instance: one(instances, {
    fields: [channelConfigs.instanceId],
    references: [instances.id],
  }),
}));

// ─── api_keys ────────────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_keys_user_id_idx").on(table.userId),
    uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
  ],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

// ─── audit_logs ──────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    instanceId: uuid("instance_id")
      .references(() => instances.id, { onDelete: "set null" }),
    action: varchar("action", { length: 50 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_instance_id_idx").on(table.instanceId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  instance: one(instances, { fields: [auditLogs.instanceId], references: [instances.id] }),
}));

// ─── totp_secrets ────────────────────────────────────────────────────────────

export const totpSecrets = pgTable(
  "totp_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    encryptedSecret: text("encrypted_secret").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    backupCodes: jsonb("backup_codes").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("totp_secrets_user_id_idx").on(table.userId),
  ],
);

export const totpSecretsRelations = relations(totpSecrets, ({ one }) => ({
  user: one(users, { fields: [totpSecrets.userId], references: [users.id] }),
}));

// ─── llm_keys (BYOK) ────────────────────────────────────────────────────────

export const llmKeys = pgTable(
  "llm_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("llm_keys_user_id_idx").on(table.userId),
    uniqueIndex("llm_keys_user_provider_name_idx").on(table.userId, table.provider, table.name),
  ],
);

export const llmKeysRelations = relations(llmKeys, ({ one }) => ({
  user: one(users, { fields: [llmKeys.userId], references: [users.id] }),
}));

// ─── organizations ───────────────────────────────────────────────────────────

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug),
    index("organizations_owner_id_idx").on(table.ownerId),
  ],
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(orgMembers),
  invites: many(orgInvites),
}));

// ─── org_members ─────────────────────────────────────────────────────────────

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("org_members_org_user_idx").on(table.orgId, table.userId),
    index("org_members_user_id_idx").on(table.userId),
  ],
);

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
}));

// ─── org_invites ─────────────────────────────────────────────────────────────

export const orgInvites = pgTable(
  "org_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    token: varchar("token", { length: 64 }).notNull().unique(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("org_invites_org_id_idx").on(table.orgId),
    uniqueIndex("org_invites_token_idx").on(table.token),
    index("org_invites_email_idx").on(table.email),
  ],
);

export const orgInvitesRelations = relations(orgInvites, ({ one }) => ({
  org: one(organizations, { fields: [orgInvites.orgId], references: [organizations.id] }),
  inviter: one(users, { fields: [orgInvites.invitedBy], references: [users.id] }),
}));

// ─── usage_records ───────────────────────────────────────────────────────────

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    instanceId: uuid("instance_id")
      .references(() => instances.id, { onDelete: "set null" }),
    type: varchar("type", { length: 30 }).notNull(),
    quantity: integer("quantity").notNull().default(0),
    period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("usage_records_user_id_idx").on(table.userId),
    index("usage_records_instance_id_idx").on(table.instanceId),
    index("usage_records_period_idx").on(table.period),
    uniqueIndex("usage_records_user_instance_type_period_idx").on(
      table.userId, table.instanceId, table.type, table.period,
    ),
  ],
);

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, { fields: [usageRecords.userId], references: [users.id] }),
  instance: one(instances, { fields: [usageRecords.instanceId], references: [instances.id] }),
}));

// ─── scheduled_jobs ──────────────────────────────────────────────────────────

export const scheduledJobs = pgTable(
  "scheduled_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    cronExpression: varchar("cron_expression", { length: 50 }).notNull(),
    taskType: varchar("task_type", { length: 30 }).notNull(),
    config: jsonb("config").$type<Record<string, unknown>>(),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scheduled_jobs_instance_id_idx").on(table.instanceId),
    index("scheduled_jobs_enabled_idx").on(table.enabled),
  ],
);

export const scheduledJobsRelations = relations(scheduledJobs, ({ one }) => ({
  instance: one(instances, { fields: [scheduledJobs.instanceId], references: [instances.id] }),
}));

// ─── env_vars ─────────────────────────────────────────────────────────────────

export const envVars = pgTable(
  "env_vars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 255 }).notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    isSecret: boolean("is_secret").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("env_vars_instance_id_idx").on(table.instanceId),
    uniqueIndex("env_vars_instance_key_idx").on(table.instanceId, table.key),
  ],
);

export const envVarsRelations = relations(envVars, ({ one }) => ({
  instance: one(instances, { fields: [envVars.instanceId], references: [instances.id] }),
}));

// ─── custom_skills ──────────────────────────────────────────────────────────

export const customSkills = pgTable(
  "custom_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    language: varchar("language", { length: 10 }).notNull(), // "python" | "typescript"
    code: text("code").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    triggerType: varchar("trigger_type", { length: 20 }).notNull().default("manual"), // manual | cron | event | webhook
    triggerValue: varchar("trigger_value", { length: 100 }), // command name, event name, or cron
    timeout: integer("timeout").notNull().default(30), // seconds
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: varchar("last_run_status", { length: 20 }), // success | error | timeout
    lastRunOutput: text("last_run_output"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("custom_skills_instance_id_idx").on(table.instanceId),
    uniqueIndex("custom_skills_instance_name_idx").on(table.instanceId, table.name),
  ],
);

export const customSkillsRelations = relations(customSkills, ({ one }) => ({
  instance: one(instances, { fields: [customSkills.instanceId], references: [instances.id] }),
}));
