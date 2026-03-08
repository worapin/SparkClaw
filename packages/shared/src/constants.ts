import type { Plan } from "./types.js";

export function getStripePriceId(plan: Plan): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}`;
  const id = process.env[key];
  if (!id) throw new Error(`Missing env var: ${key}`);
  return id;
}

export const PLANS: Record<Plan, { name: string; price: number }> = {
  starter: { name: "Starter", price: 19 },
  pro: { name: "Pro", price: 39 },
  scale: { name: "Scale", price: 79 },
};

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_SEND_RATE_LIMIT = 100; // max 100 per email per window (high for dev)
export const OTP_SEND_RATE_WINDOW_MS = 60 * 1000; // 1 minute
export const OTP_VERIFY_RATE_LIMIT = 100; // max 100 per email per window (high for dev)
export const OTP_VERIFY_RATE_WINDOW_MS = 60 * 1000; // 1 minute

export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_NAME = "sparkclaw_session";

export const INSTANCE_POLL_INTERVAL_MS = 10_000; // 10 seconds
export const INSTANCE_POLL_MAX_ATTEMPTS = 6; // 60 seconds total
export const INSTANCE_PROVISION_MAX_RETRIES = 3;
