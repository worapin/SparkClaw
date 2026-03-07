import { Elysia } from "elysia";
import { createCheckoutSchema } from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import type { MeResponse, InstanceResponse, User } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { createCheckoutSession } from "../services/stripe.js";
import { verifySession } from "../services/session.js";
import { db, subscriptions, instances } from "@sparkclaw/shared/db";
import { eq } from "drizzle-orm";

export const apiRoutes = new Elysia({ prefix: "/api" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }

    const user = await verifySession(token);
    if (!user) {
      set.status = 401;
      throw new Error("Invalid or expired session");
    }

    return { user };
  })
  .onError(({ set, error: err }) => {
    if (err instanceof Error && (err.message === "Not authenticated" || err.message === "Invalid or expired session")) {
      set.status = 401;
      return { error: err.message };
    }
  })
  .get("/me", async ({ user }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    const response: MeResponse = {
      id: user.id,
      email: user.email,
      subscription: sub
        ? {
            id: sub.id,
            plan: sub.plan as NonNullable<MeResponse["subscription"]>["plan"],
            status: sub.status as NonNullable<MeResponse["subscription"]>["status"],
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      createdAt: user.createdAt.toISOString(),
    };

    return response;
  })
  .get("/instance", async ({ user }) => {
    const result = await db.query.instances.findFirst({
      where: eq(instances.userId, user.id),
      with: { subscription: true },
    });

    if (!result) {
      return { instance: null };
    }

    const response: InstanceResponse = {
      id: result.id,
      status: result.status as InstanceResponse["status"],
      url: result.url,
      plan: result.subscription.plan as InstanceResponse["plan"],
      subscriptionStatus: result.subscription.status as InstanceResponse["subscriptionStatus"],
      createdAt: result.createdAt.toISOString(),
    };

    return response;
  })
  .post("/checkout", async ({ user, body, set }) => {
    const parsed = createCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid plan" };
    }

    const url = await createCheckoutSession(user.id, user.email, parsed.data.plan);
    return { url };
  });
