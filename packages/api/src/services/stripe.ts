import Stripe from "stripe";
import { db, subscriptions, instances } from "@sparkclaw/shared/db";
import { getStripePriceId } from "@sparkclaw/shared/constants";
import type { Plan } from "@sparkclaw/shared/types";
import { eq } from "drizzle-orm";
import { queueInstanceProvisioning } from "./queue.js";
import { logger } from "../lib/logger.js";
import { sendPaymentFailedEmail, sendSubscriptionCanceledEmail } from "./email.js";
import { users } from "@sparkclaw/shared/db";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export function constructStripeEvent(body: string, signature: string) {
  return getStripe().webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: Plan,
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: getStripePriceId(plan), quantity: 1 }],
    success_url: `${process.env.WEB_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.WEB_URL}/pricing?checkout=canceled`,
    metadata: { userId, plan },
  });

  return session.url!;
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as Plan;
  if (!userId || !plan) return;

  const stripeSubscription = await getStripe().subscriptions.retrieve(
    session.subscription as string,
  );

  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId,
      plan,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      status: "active",
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    })
    .returning();

  // Queue instance provisioning for async processing
  queueInstanceProvisioning(userId, sub.id).catch((err: Error) => {
    logger.error("Failed to queue provisioning", { userId, subscriptionId: sub.id, error: err.message });
  });
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: subscription.status === "active" ? "active" : "past_due",
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
}

export async function createBillingPortalSession(
  customerId: string,
): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.WEB_URL}/account`,
  });

  return session.url;
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await getStripe().subscriptions.cancel(subscriptionId);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  // Mark associated instance as suspended
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subscription.id),
  });

  if (sub) {
    await db
      .update(instances)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(instances.subscriptionId, sub.id));

    // Send cancellation email
    const user = await db.query.users.findFirst({ where: eq(users.id, sub.userId) });
    if (user?.email) {
      sendSubscriptionCanceledEmail(user.email, sub.plan).catch(() => {});
    }
  }
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = invoice.customer as string;
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId),
  });

  if (sub) {
    await db
      .update(subscriptions)
      .set({ status: "past_due", updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    const user = await db.query.users.findFirst({ where: eq(users.id, sub.userId) });
    if (user?.email) {
      sendPaymentFailedEmail(user.email).catch(() => {});
    }
  }

  logger.warn("Invoice payment failed", { customerId, invoiceId: invoice.id });
}
