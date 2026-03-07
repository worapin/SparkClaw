import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  otpCodes,
  sessions,
  subscriptions,
  instances,
} from "./db/schema.js";

// ─── Select types (read from DB) ────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type OtpCode = InferSelectModel<typeof otpCodes>;
export type Session = InferSelectModel<typeof sessions>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type Instance = InferSelectModel<typeof instances>;

// ─── Insert types (write to DB) ─────────────────────────────────────────────

export type NewUser = InferInsertModel<typeof users>;
export type NewOtpCode = InferInsertModel<typeof otpCodes>;
export type NewSession = InferInsertModel<typeof sessions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;
export type NewInstance = InferInsertModel<typeof instances>;

// ─── Domain types ────────────────────────────────────────────────────────────

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
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}
