/**
 * One-time script to create MC workspaces for existing instances.
 * Safe to re-run (idempotent — only processes instances without mcWorkspaceId).
 *
 * Usage: bun run scripts/backfill-mc-workspaces.ts
 */
import { db } from "@sparkclaw/shared/db";
import { instances } from "@sparkclaw/shared/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { validateEnv } from "@sparkclaw/shared";

validateEnv();

const MC_URL = process.env.MISSION_CONTROL_URL;
const MC_API_KEY = process.env.MISSION_CONTROL_API_KEY;

if (!MC_URL || !MC_API_KEY) {
  console.error("MISSION_CONTROL_URL and MISSION_CONTROL_API_KEY must be set");
  process.exit(1);
}

async function main() {
  const toBackfill = await db.query.instances.findMany({
    where: and(
      eq(instances.status, "ready"),
      isNull(instances.mcWorkspaceId),
    ),
  });

  console.log(`Found ${toBackfill.length} instances to backfill`);

  let success = 0;
  let failed = 0;

  for (const instance of toBackfill) {
    try {
      const response = await fetch(`${MC_URL}/api/super/tenants`, {
        method: "POST",
        headers: {
          "x-api-key": MC_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: instance.instanceName || instance.id,
          instanceId: instance.id,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`MC API ${response.status}: ${text}`);
      }

      const result = (await response.json()) as { id: string };

      await db
        .update(instances)
        .set({ mcWorkspaceId: result.id, updatedAt: new Date() })
        .where(eq(instances.id, instance.id));

      console.log(`OK: ${instance.id} → workspace ${result.id}`);
      success++;
    } catch (error) {
      console.error(`FAIL: ${instance.id} — ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
