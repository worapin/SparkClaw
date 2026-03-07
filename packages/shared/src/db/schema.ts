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
  instance: one(instances),
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

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  instance: one(instances),
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
      .unique()
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
    uniqueIndex("instances_subscription_id_idx").on(table.subscriptionId),
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
