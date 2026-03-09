import { Elysia } from "elysia";
import { sendOtpSchema, verifyOtpSchema } from "@sparkclaw/shared/schemas";
import { SESSION_COOKIE_NAME, SESSION_EXPIRY_MS, OTP_SEND_RATE_LIMIT, OTP_SEND_RATE_WINDOW_MS, OTP_VERIFY_RATE_LIMIT, OTP_VERIFY_RATE_WINDOW_MS } from "@sparkclaw/shared/constants";
import { generateOtp, hashOtp, createOtpRecord, verifyOtp } from "../services/otp.js";
import { createSession, deleteSession } from "../services/session.js";
import { sendOtpEmail } from "../lib/email.js";
import { csrfMiddleware } from "../middleware/csrf.js";
import { RateLimiter } from "../lib/rate-limiter.js";
import { trackEvent, identifyUser } from "../lib/observability.js";
import { logAudit } from "../services/audit.js";

const sendOtpLimiter = new RateLimiter(OTP_SEND_RATE_LIMIT, OTP_SEND_RATE_WINDOW_MS);
const verifyOtpLimiter = new RateLimiter(OTP_VERIFY_RATE_LIMIT, OTP_VERIFY_RATE_WINDOW_MS);

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(csrfMiddleware)
  .post("/send-otp", async ({ body, set, request }) => {
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid email" };
    }

    const rateLimitKey = `send:${getClientIp(request)}:${parsed.data.email}`;
    if (!sendOtpLimiter.check(rateLimitKey)) {
      set.status = 429;
      return { error: "Too many requests. Please try again later." };
    }

    const code = generateOtp();
    const codeHash = await hashOtp(code);
    await createOtpRecord(parsed.data.email, codeHash);
    await sendOtpEmail(parsed.data.email, code);

    // Track OTP sent
    trackEvent(parsed.data.email, "otp_sent", { method: "email" });

    return { ok: true };
  })
  .post("/verify-otp", async ({ body, cookie, set, request }) => {
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid format" };
    }

    const rateLimitKey = `verify:${getClientIp(request)}:${parsed.data.email}`;
    if (!verifyOtpLimiter.check(rateLimitKey)) {
      set.status = 429;
      return { error: "Too many attempts. Please try again later." };
    }

    const user = await verifyOtp(parsed.data.email, parsed.data.code);
    if (!user) {
      set.status = 401;
      trackEvent(parsed.data.email, "otp_verify_failed");
      return { error: "Invalid or expired code" };
    }

    const session = await createSession(user.id);
    cookie[SESSION_COOKIE_NAME].set({
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: "/",
    });

    // Track successful login and identify user
    trackEvent(user.id, "login", { method: "otp" });
    identifyUser(user.id, { email: user.email });
    logAudit({ userId: user.id, action: "login", ip: getClientIp(request) });

    return { ok: true, redirect: "/dashboard" };
  })
  .post("/logout", async ({ cookie }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (token) {
      await deleteSession(token);
    }
    cookie[SESSION_COOKIE_NAME].remove();
    
    // Track logout
    trackEvent("anonymous", "logout");
    
    return { ok: true, redirect: "/" };
  });
