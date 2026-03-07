import { Elysia } from "elysia";
import { constructStripeEvent, handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted } from "../services/stripe.js";
import { logger } from "../lib/logger.js";

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  .post("/stripe", async ({ request, set }) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      set.status = 400;
      return { error: "Missing signature" };
    }

    const body = await request.text();

    let event;
    try {
      event = constructStripeEvent(body, signature);
    } catch {
      set.status = 400;
      return { error: "Invalid signature" };
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object);
          break;
        default:
          logger.info("Unhandled webhook event", { type: event.type });
      }
    } catch (err) {
      logger.error("Webhook processing failed", {
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
      set.status = 500;
      return { error: "Webhook processing failed" };
    }

    logger.info("Webhook processed", { type: event.type });
    return { received: true };
  });
