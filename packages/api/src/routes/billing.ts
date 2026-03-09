import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { createBillingPortalSession, cancelSubscription } from "../services/stripe.js";
import { db, subscriptions, instances, users, sessions } from "@sparkclaw/shared/db";
import { eq } from "drizzle-orm";
import { logAudit } from "../services/audit.js";
import { logger } from "../lib/logger.js";
import { sendSubscriptionCanceledEmail, sendAccountDeletedEmail } from "../services/email.js";

export const billingRoutes = new Elysia({ prefix: "/api/billing" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) { set.status = 401; throw new Error("Not authenticated"); }
    const user = await verifySession(token);
    if (!user) { set.status = 401; throw new Error("Invalid session"); }
    return { user };
  })
  // POST /api/billing/portal - create Stripe billing portal session
  .post("/portal", async ({ user, set }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    if (!sub?.stripeCustomerId) {
      set.status = 400;
      return { error: "No billing account found" };
    }

    const url = await createBillingPortalSession(sub.stripeCustomerId);
    return { url };
  })
  // POST /api/billing/cancel - cancel subscription
  .post("/cancel", async ({ user, set }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    if (!sub?.stripeSubscriptionId) {
      set.status = 400;
      return { error: "No active subscription" };
    }

    if (sub.status === "canceled") {
      set.status = 400;
      return { error: "Subscription already canceled" };
    }

    await cancelSubscription(sub.stripeSubscriptionId);

    await db.update(subscriptions)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    // Suspend all user instances
    await db.update(instances)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(instances.userId, user.id));

    logAudit({ userId: user.id, action: "subscription_canceled" });
    logger.info("Subscription canceled", { userId: user.id });
    sendSubscriptionCanceledEmail(user.email, sub.plan).catch(() => {});

    return { success: true };
  })
  // DELETE /api/billing/account - delete account
  .delete("/account", async ({ user, cookie, set }) => {
    // Delete all user data (cascading through foreign keys)
    await db.delete(instances).where(eq(instances.userId, user.id));
    await db.delete(subscriptions).where(eq(subscriptions.userId, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));

    // Clear session cookie
    cookie[SESSION_COOKIE_NAME]!.set({ value: "", maxAge: 0 });

    logAudit({ userId: user.id, action: "account_deleted" });
    logger.info("Account deleted", { userId: user.id });
    sendAccountDeletedEmail(user.email).catch(() => {});

    return { success: true };
  });
