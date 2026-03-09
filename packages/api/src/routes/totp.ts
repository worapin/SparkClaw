import { Elysia } from "elysia";
import { createHmac, randomBytes } from "crypto";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { verifyTotpSchema } from "@sparkclaw/shared/schemas";
import { db, totpSecrets } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { logAudit } from "../services/audit.js";
import { logger } from "../lib/logger.js";

// Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}

function verifyTotp(secret: Buffer, code: string): boolean {
  const time = Math.floor(Date.now() / 30000);
  for (const offset of [-1, 0, 1]) {
    const t = time + offset;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(t));
    const hmac = createHmac("sha1", secret).update(timeBuffer).digest();
    const offset2 = hmac[hmac.length - 1] & 0x0f;
    const otp = ((hmac.readUInt32BE(offset2) & 0x7fffffff) % 1000000)
      .toString()
      .padStart(6, "0");
    if (otp === code) return true;
  }
  return false;
}

export const totpRoutes = new Elysia({ prefix: "/api/totp" })
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
  // Get TOTP status
  .get("/status", async ({ user }) => {
    const existing = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, user.id));

    if (existing.length === 0) {
      return { enabled: false, hasBackupCodes: false };
    }

    return {
      enabled: existing[0].enabled,
      hasBackupCodes: Array.isArray(existing[0].backupCodes) && existing[0].backupCodes.length > 0,
    };
  })
  // Setup TOTP
  .post("/setup", async ({ user, set }) => {
    // Check if TOTP is already enabled
    const existing = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, user.id));

    if (existing.length > 0 && existing[0].enabled) {
      set.status = 400;
      return { error: "TOTP is already enabled. Disable it first to reconfigure." };
    }

    // Generate 20-byte secret and base32-encode it
    const secretBytes = randomBytes(20);
    const secretBase32 = base32Encode(secretBytes);

    // Encrypt the secret before storing
    const encryptedSecret = encrypt(secretBase32);

    // Generate 8 backup codes (random 8-char hex strings)
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(randomBytes(4).toString("hex"));
    }
    const encryptedBackupCodes = backupCodes.map((code) => encrypt(code));

    // Upsert the TOTP record (replace if setup was started but not verified)
    if (existing.length > 0) {
      await db
        .update(totpSecrets)
        .set({
          encryptedSecret,
          enabled: false,
          backupCodes: encryptedBackupCodes,
          updatedAt: new Date(),
        })
        .where(eq(totpSecrets.userId, user.id));
    } else {
      await db.insert(totpSecrets).values({
        userId: user.id,
        encryptedSecret,
        enabled: false,
        backupCodes: encryptedBackupCodes,
      });
    }

    // Build otpauth URI
    const otpauthUri = `otpauth://totp/SparkClaw:${encodeURIComponent(user.email)}?secret=${secretBase32}&issuer=SparkClaw&algorithm=SHA1&digits=6&period=30`;

    logger.info("TOTP setup initiated", { userId: user.id });

    return {
      secret: secretBase32,
      otpauthUri,
      backupCodes,
    };
  })
  // Verify TOTP code and enable
  .post("/verify", async ({ user, body, set }) => {
    const parsed = verifyTotpSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.flatten() };
    }

    const { code } = parsed.data;

    const existing = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, user.id));

    if (existing.length === 0) {
      set.status = 400;
      return { error: "TOTP has not been set up. Call /api/totp/setup first." };
    }

    if (existing[0].enabled) {
      set.status = 400;
      return { error: "TOTP is already enabled." };
    }

    // Decrypt the secret and verify the code
    const secretBase32 = decrypt(existing[0].encryptedSecret);
    const secretBuffer = base32Decode(secretBase32);

    if (!verifyTotp(secretBuffer, code)) {
      set.status = 400;
      return { error: "Invalid TOTP code." };
    }

    // Enable TOTP
    await db
      .update(totpSecrets)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(totpSecrets.userId, user.id));

    await logAudit({
      userId: user.id,
      action: "totp_enabled",
    });

    logger.info("TOTP enabled", { userId: user.id });

    return { success: true };
  })
  // Disable TOTP
  .post("/disable", async ({ user, body, set }) => {
    const parsed = verifyTotpSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.flatten() };
    }

    const { code } = parsed.data;

    const existing = await db
      .select()
      .from(totpSecrets)
      .where(eq(totpSecrets.userId, user.id));

    if (existing.length === 0 || !existing[0].enabled) {
      set.status = 400;
      return { error: "TOTP is not enabled." };
    }

    // Verify the code before disabling
    const secretBase32 = decrypt(existing[0].encryptedSecret);
    const secretBuffer = base32Decode(secretBase32);

    if (!verifyTotp(secretBuffer, code)) {
      set.status = 400;
      return { error: "Invalid TOTP code." };
    }

    // Delete the TOTP record
    await db
      .delete(totpSecrets)
      .where(eq(totpSecrets.userId, user.id));

    await logAudit({
      userId: user.id,
      action: "totp_disabled",
    });

    logger.info("TOTP disabled", { userId: user.id });

    return { success: true };
  });
