import { db, otpCodes, users } from "@sparkclaw/shared/db";
import { OTP_EXPIRY_MS } from "@sparkclaw/shared/constants";
import type { User } from "@sparkclaw/shared/types";
import { eq, and, gt, isNull } from "drizzle-orm";

export function generateOtp(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

export async function hashOtp(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createOtpRecord(email: string, codeHash: string): Promise<void> {
  await db.insert(otpCodes).values({
    email,
    codeHash,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  });
}

export async function verifyOtp(email: string, code: string): Promise<User | null> {
  const codeHash = await hashOtp(code);

  const otp = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.email, email),
      eq(otpCodes.codeHash, codeHash),
      gt(otpCodes.expiresAt, new Date()),
      isNull(otpCodes.usedAt),
    ),
  });

  if (!otp) return null;

  // Mark OTP as used
  await db
    .update(otpCodes)
    .set({ usedAt: new Date() })
    .where(eq(otpCodes.id, otp.id));

  // Find or create user
  let user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    const [newUser] = await db.insert(users).values({ email }).returning();
    user = newUser;
  }

  return user;
}
