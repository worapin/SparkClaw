import { db, sessions, users } from "@sparkclaw/shared/db";
import { SESSION_EXPIRY_MS } from "@sparkclaw/shared/constants";
import type { User } from "@sparkclaw/shared/types";
import { eq, and, gt } from "drizzle-orm";

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(userId: string): Promise<{ token: string }> {
  const token = generateToken();
  await db.insert(sessions).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
  });
  return { token };
}

export async function verifySession(token: string): Promise<User | null> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date()),
    ),
  });

  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  return user ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}
