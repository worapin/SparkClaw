import { Resend } from "resend";
import { logger } from "./logger.js";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  // In development, log the code instead of sending email
  if (!process.env.RESEND_API_KEY) {
    logger.info("OTP code (development mode)", { email, code });
    console.log(`\n========================================`);
    console.log(`OTP CODE FOR ${email}: ${code}`);
    console.log(`========================================\n`);
    return;
  }

  await getResend().emails.send({
    from: "SparkClaw <noreply@updates.getsparkchat.com>",
    to: email,
    subject: `Your SparkClaw verification code: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your verification code</h2>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">
          ${code}
        </p>
        <p>This code expires in 5 minutes.</p>
        <p style="color: #666; font-size: 14px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  logger.info("OTP email sent", { to: email });
}
