import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing ENCRYPTION_SECRET or SESSION_SECRET env var");
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns base64-encoded: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM string.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64");

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Encrypt a JSON object.
 */
export function encryptJson(data: Record<string, unknown>): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt to a JSON object.
 */
export function decryptJson<T = Record<string, unknown>>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T;
}

/**
 * Hash a string using SHA-256 (for API key hashing).
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a random token (hex string).
 */
export function generateToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Generate a random API key with prefix.
 * Format: sk_live_<random hex>
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `sk_live_${raw}`;
  const prefix = key.slice(0, 12);
  const hash = sha256(key);
  return { key, prefix, hash };
}
