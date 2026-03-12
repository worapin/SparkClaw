# Mission Control Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Mission Control v2 as a proxy backend to expose Agent Ops features (costs, health, security, memory) to SparkClaw customers via a new dashboard tab.

**Architecture:** SparkClaw API proxies requests to a single Mission Control instance using API Key auth. Each SparkClaw instance maps to an MC workspace via `mcWorkspaceId`. The frontend adds an "Agent Ops" tab with 4 sub-tabs. MC is optional — graceful degradation when unavailable.

**Tech Stack:** Elysia (API routes), Drizzle ORM (PostgreSQL), SvelteKit + Svelte 5 (frontend), Zod (validation), native fetch (HTTP proxy)

**Spec:** `docs/superpowers/specs/2026-03-13-mission-control-integration-design.md`

---

## File Structure

### New Files
- `packages/api/src/services/mission-control.ts` — MC HTTP client (fetch, transform, cache)
- `packages/api/src/routes/instance-ops.ts` — Agent Ops API routes
- `packages/shared/src/db/migrations/` — Drizzle migration for `mcWorkspaceId`
- `scripts/backfill-mc-workspaces.ts` — One-time backfill script

### Modified Files
- `packages/shared/src/db/schema.ts` — Add `mcWorkspaceId` to instances table
- `packages/shared/src/env.ts` — Add `MISSION_CONTROL_URL` and `MISSION_CONTROL_API_KEY`
- `packages/shared/src/types.ts` — Add Agent Ops response types
- `packages/api/src/index.ts` — Mount new routes
- `packages/api/src/services/queue.ts` — Add MC workspace creation hook
- `packages/api/src/services/stripe.ts` — Add MC workspace creation in direct provisioning path
- `packages/web/src/lib/api.ts` — Add 5 Agent Ops API methods
- `packages/web/src/routes/dashboard/[id]/+page.svelte` — Add Agent Ops tab + 4 sub-tabs

---

## Chunk 1: Backend Foundation

### Task 1: Add environment variables

**Files:**
- Modify: `packages/shared/src/env.ts`

- [ ] **Step 1: Add MC env vars to Zod schema**

In `packages/shared/src/env.ts`, add to the `envSchema` object:

```typescript
// Mission Control (optional)
MISSION_CONTROL_URL: z.string().url().optional(),
MISSION_CONTROL_API_KEY: z.string().optional(),
```

Add after the `SKILL_RUNNER_TOKEN` line.

- [ ] **Step 2: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:shared`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/env.ts
git commit -m "feat: add Mission Control environment variables"
```

---

### Task 2: Add database schema field

**Files:**
- Modify: `packages/shared/src/db/schema.ts`

- [ ] **Step 1: Add `mcWorkspaceId` to instances table**

In `packages/shared/src/db/schema.ts`, inside the `instances` table definition, add after the `errorMessage` field:

```typescript
mcWorkspaceId: varchar("mc_workspace_id", { length: 255 }),
```

- [ ] **Step 2: Generate Drizzle migration**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run drizzle-kit generate`
Expected: Migration file created in migrations directory.

- [ ] **Step 3: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:shared`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/db/schema.ts packages/shared/src/db/migrations/
git commit -m "feat: add mcWorkspaceId field to instances table"
```

---

### Task 3: Add Agent Ops response types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add Agent Ops types**

Append to `packages/shared/src/types.ts`:

```typescript
// ── Agent Ops Types (Mission Control integration) ──────────────────

export type OpsSubTab = "costs" | "health" | "security" | "memory";
export type OpsPeriod = "24h" | "7d" | "30d";

export interface OpsUnavailableResponse {
  available: false;
}

export interface OpsCostsResponse {
  available: true;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  avgCostPerRequest: number;
  byModel: Array<{
    model: string;
    tokens: number;
    cost: number;
  }>;
}

export interface OpsCostTrendsResponse {
  available: true;
  hourly: Array<{
    time: string;
    tokens: number;
    cost: number;
  }>;
}

export interface OpsAgentStatus {
  name: string;
  status: "active" | "idle" | "offline" | "error";
  lastSeen: string | null;
  taskStats: {
    total: number;
    assigned: number;
    inProgress: number;
    done: number;
  };
}

export interface OpsHealthResponse {
  available: true;
  agents: OpsAgentStatus[];
}

export interface OpsSecurityResponse {
  available: true;
  postureScore: number;
  level: "hardened" | "secure" | "needs-attention" | "at-risk";
  trustScores: Array<{
    agentName: string;
    score: number;
  }>;
  secretExposures: {
    count: number;
    recent: Array<{ type: string; detectedAt: string }>;
  };
  injectionAttempts: {
    count: number;
    recent: Array<{ source: string; detectedAt: string }>;
  };
}

export interface OpsMemoryResponse {
  available: true;
  files: Array<{
    path: string;
    name: string;
    size: number;
    lastModified: string;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}
```

- [ ] **Step 2: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:shared`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add Agent Ops response types for Mission Control"
```

---

### Task 4: Create Mission Control service

**Files:**
- Create: `packages/api/src/services/mission-control.ts`

- [ ] **Step 1: Create the MC service file**

Create `packages/api/src/services/mission-control.ts`:

```typescript
import { getEnv } from "@sparkclaw/shared";
import { logger } from "../lib/logger.js";
import type {
  OpsCostsResponse,
  OpsCostTrendsResponse,
  OpsHealthResponse,
  OpsSecurityResponse,
  OpsMemoryResponse,
  OpsPeriod,
} from "@sparkclaw/shared/types";

// ── In-memory response cache ───────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  // Evict expired entries periodically (every 100 writes)
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── MC HTTP Client ─────────────────────────────────────────────────

function getMCConfig(): { url: string; apiKey: string } | null {
  const env = getEnv();
  if (!env.MISSION_CONTROL_URL || !env.MISSION_CONTROL_API_KEY) return null;
  return { url: env.MISSION_CONTROL_URL, apiKey: env.MISSION_CONTROL_API_KEY };
}

async function mcFetch<T>(path: string): Promise<T> {
  const config = getMCConfig();
  if (!config) throw new Error("Mission Control not configured");

  const response = await fetch(`${config.url}${path}`, {
    method: "GET",
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`MC API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function mcPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getMCConfig();
  if (!config) throw new Error("Mission Control not configured");

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`MC API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ── Period → timestamp conversion ──────────────────────────────────

function periodToFrom(period: OpsPeriod): string {
  const ms = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 };
  return new Date(Date.now() - ms[period]).toISOString();
}

// ── Public API ─────────────────────────────────────────────────────

export function isMCConfigured(): boolean {
  return getMCConfig() !== null;
}

export async function createMCWorkspace(
  instanceId: string,
  name: string,
): Promise<string | null> {
  try {
    // NOTE: Verify actual MC endpoint during integration testing
    const result = await mcPost<{ id: string }>("/api/super/tenants", {
      name,
      instanceId,
    });
    logger.info("MC workspace created", { instanceId, workspaceId: result.id });
    return result.id;
  } catch (error) {
    logger.error("Failed to create MC workspace", {
      instanceId,
      error: (error as Error).message,
    });
    return null;
  }
}

export async function fetchMCCosts(
  workspaceId: string,
  period: OpsPeriod = "24h",
): Promise<OpsCostsResponse> {
  const cacheKey = `${workspaceId}:costs:${period}`;
  const cached = getCached<OpsCostsResponse>(cacheKey);
  if (cached) return cached;

  const from = periodToFrom(period);
  // NOTE: Verify actual MC query params during integration testing
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/tokens?action=stats&workspaceId=${workspaceId}&from=${from}`,
  );

  const result: OpsCostsResponse = {
    available: true,
    totalTokens: (raw.totalTokens as number) || 0,
    totalCost: (raw.totalCost as number) || 0,
    requestCount: (raw.requestCount as number) || 0,
    avgCostPerRequest: (raw.avgCostPerRequest as number) || 0,
    byModel: Array.isArray(raw.byModel)
      ? (raw.byModel as Array<{ model: string; tokens: number; cost: number }>)
      : [],
  };

  setCache(cacheKey, result);
  return result;
}

export async function fetchMCCostTrends(
  workspaceId: string,
  period: OpsPeriod = "24h",
): Promise<OpsCostTrendsResponse> {
  const cacheKey = `${workspaceId}:trends:${period}`;
  const cached = getCached<OpsCostTrendsResponse>(cacheKey);
  if (cached) return cached;

  const from = periodToFrom(period);
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/tokens?action=trends&workspaceId=${workspaceId}&from=${from}`,
  );

  const result: OpsCostTrendsResponse = {
    available: true,
    hourly: Array.isArray(raw.hourly)
      ? (raw.hourly as Array<{ time: string; tokens: number; cost: number }>)
      : [],
  };

  setCache(cacheKey, result);
  return result;
}

export async function fetchMCAgentHealth(
  workspaceId: string,
): Promise<OpsHealthResponse> {
  const cacheKey = `${workspaceId}:health`;
  const cached = getCached<OpsHealthResponse>(cacheKey);
  if (cached) return cached;

  const raw = await mcFetch<Record<string, unknown>>(
    `/api/agents?workspaceId=${workspaceId}`,
  );

  const agents = Array.isArray(raw.agents) ? raw.agents : Array.isArray(raw) ? raw : [];

  const result: OpsHealthResponse = {
    available: true,
    agents: agents.map((a: Record<string, unknown>) => ({
      name: (a.name as string) || "unknown",
      status: (a.status as "active" | "idle" | "offline" | "error") || "offline",
      lastSeen: (a.last_seen as string) || (a.lastSeen as string) || null,
      taskStats: {
        total: ((a.taskStats as Record<string, number>)?.total as number) || 0,
        assigned: ((a.taskStats as Record<string, number>)?.assigned as number) || 0,
        inProgress: ((a.taskStats as Record<string, number>)?.in_progress as number) ||
          ((a.taskStats as Record<string, number>)?.inProgress as number) || 0,
        done: ((a.taskStats as Record<string, number>)?.done as number) || 0,
      },
    })),
  };

  setCache(cacheKey, result);
  return result;
}

export async function fetchMCSecurityAudit(
  workspaceId: string,
): Promise<OpsSecurityResponse> {
  const cacheKey = `${workspaceId}:security`;
  const cached = getCached<OpsSecurityResponse>(cacheKey);
  if (cached) return cached;

  const raw = await mcFetch<Record<string, unknown>>(
    `/api/security-audit?workspaceId=${workspaceId}`,
  );

  const postureScore = raw.postureScore as Record<string, unknown> | undefined;

  const result: OpsSecurityResponse = {
    available: true,
    postureScore: (postureScore?.score as number) || 0,
    level: (postureScore?.level as OpsSecurityResponse["level"]) || "at-risk",
    trustScores: Array.isArray(raw.agentTrustScores)
      ? (raw.agentTrustScores as Array<{ agentName: string; score: number }>)
      : [],
    secretExposures: {
      count: ((raw.secretExposures as Record<string, unknown>)?.count as number) || 0,
      recent: Array.isArray((raw.secretExposures as Record<string, unknown>)?.recent)
        ? ((raw.secretExposures as Record<string, unknown>).recent as Array<{ type: string; detectedAt: string }>)
        : [],
    },
    injectionAttempts: {
      count: ((raw.injectionAttempts as Record<string, unknown>)?.count as number) || 0,
      recent: Array.isArray((raw.injectionAttempts as Record<string, unknown>)?.recent)
        ? ((raw.injectionAttempts as Record<string, unknown>).recent as Array<{ source: string; detectedAt: string }>)
        : [],
    },
  };

  setCache(cacheKey, result);
  return result;
}

export async function fetchMCMemory(
  workspaceId: string,
): Promise<OpsMemoryResponse> {
  const cacheKey = `${workspaceId}:memory`;
  const cached = getCached<OpsMemoryResponse>(cacheKey);
  if (cached) return cached;

  const raw = await mcFetch<Record<string, unknown>>(
    `/api/memory?workspaceId=${workspaceId}`,
  );

  const result: OpsMemoryResponse = {
    available: true,
    files: Array.isArray(raw.files)
      ? (raw.files as Array<{ path: string; name: string; size: number; lastModified: string }>)
      : [],
    relationships: Array.isArray(raw.relationships)
      ? (raw.relationships as Array<{ source: string; target: string; type: string }>)
      : [],
  };

  setCache(cacheKey, result);
  return result;
}
```

- [ ] **Step 2: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:api`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/mission-control.ts
git commit -m "feat: add Mission Control service with caching and transforms"
```

---

### Task 5: Create Agent Ops API routes

**Files:**
- Create: `packages/api/src/routes/instance-ops.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Create the route file**

Create `packages/api/src/routes/instance-ops.ts`:

```typescript
import { Elysia } from "elysia";
import { verifySession } from "../services/session.js";
import { db } from "@sparkclaw/shared/db";
import { instances, orgMembers } from "@sparkclaw/shared/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import {
  isMCConfigured,
  createMCWorkspace,
  fetchMCCosts,
  fetchMCCostTrends,
  fetchMCAgentHealth,
  fetchMCSecurityAudit,
  fetchMCMemory,
} from "../services/mission-control.js";
import type { OpsPeriod, OpsUnavailableResponse } from "@sparkclaw/shared/types";

const UNAVAILABLE: OpsUnavailableResponse = { available: false };
const VALID_PERIODS = new Set<OpsPeriod>(["24h", "7d", "30d"]);

function validatePeriod(raw: string | undefined): OpsPeriod {
  if (raw && VALID_PERIODS.has(raw as OpsPeriod)) return raw as OpsPeriod;
  return "24h";
}

// No CSRF middleware — all routes are GET-only (read operations)
export const instanceOpsRoutes = new Elysia({ prefix: "/api/instances" })

  // ── Auth + instance resolution ─────────────────────────────────
  .resolve(async ({ cookie, set, params }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }

    const user = await verifySession(token);
    if (!user) {
      set.status = 401;
      throw new Error("Invalid session");
    }

    const id = (params as { id?: string }).id;
    if (!id) {
      set.status = 400;
      throw new Error("Instance ID required");
    }

    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, id),
    });

    if (!instance) {
      set.status = 404;
      throw new Error("Instance not found");
    }

    // Check direct ownership or org membership
    if (instance.userId !== user.id) {
      // Check if user is in the same org as the instance owner
      const ownerOrgs = await db.query.orgMembers.findMany({
        where: eq(orgMembers.userId, instance.userId),
      });
      const ownerOrgIds = ownerOrgs.map((o) => o.orgId);

      let hasAccess = false;
      if (ownerOrgIds.length > 0) {
        const userOrgs = await db.query.orgMembers.findMany({
          where: eq(orgMembers.userId, user.id),
        });
        hasAccess = userOrgs.some((o) => ownerOrgIds.includes(o.orgId));
      }

      if (!hasAccess) {
        set.status = 404;
        throw new Error("Instance not found");
      }
    }

    return { user, instance };
  })

  // ── Lazy workspace creation helper ─────────────────────────────
  .derive(({ instance }) => {
    return {
      getWorkspaceId: async (): Promise<string | null> => {
        if (instance.mcWorkspaceId) return instance.mcWorkspaceId;

        if (!isMCConfigured()) return null;

        // Lazy-create workspace
        const workspaceId = await createMCWorkspace(
          instance.id,
          instance.instanceName || instance.id,
        );

        if (workspaceId) {
          await db
            .update(instances)
            .set({ mcWorkspaceId: workspaceId, updatedAt: new Date() })
            .where(eq(instances.id, instance.id));
        }

        return workspaceId;
      },
    };
  })

  // ── Routes ─────────────────────────────────────────────────────

  .get("/:id/ops/costs", async ({ getWorkspaceId, set, query }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    const period = validatePeriod((query as { period?: string }).period);

    try {
      return await fetchMCCosts(workspaceId, period);
    } catch (error) {
      logger.error("Failed to fetch MC costs", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/costs/trends", async ({ getWorkspaceId, set, query }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    const period = validatePeriod((query as { period?: string }).period);

    try {
      return await fetchMCCostTrends(workspaceId, period);
    } catch (error) {
      logger.error("Failed to fetch MC cost trends", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/health", async ({ getWorkspaceId, set }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    try {
      return await fetchMCAgentHealth(workspaceId);
    } catch (error) {
      logger.error("Failed to fetch MC agent health", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/security", async ({ getWorkspaceId, set }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    try {
      return await fetchMCSecurityAudit(workspaceId);
    } catch (error) {
      logger.error("Failed to fetch MC security audit", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  })

  .get("/:id/ops/memory", async ({ getWorkspaceId, set }) => {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return UNAVAILABLE;

    try {
      return await fetchMCMemory(workspaceId);
    } catch (error) {
      logger.error("Failed to fetch MC memory", { error: (error as Error).message });
      set.status = 502;
      return { error: "Agent ops temporarily unavailable" };
    }
  });
```

- [ ] **Step 2: Mount routes in app**

In `packages/api/src/index.ts`, add import and `.use()`:

```typescript
import { instanceOpsRoutes } from "./routes/instance-ops.js";
```

Add `.use(instanceOpsRoutes)` alongside the other route `.use()` calls.

- [ ] **Step 3: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:api`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/instance-ops.ts packages/api/src/index.ts
git commit -m "feat: add Agent Ops API routes with MC proxy"
```

---

### Task 6: Add MC workspace creation to provisioning hook

**Files:**
- Modify: `packages/api/src/services/queue.ts`

- [ ] **Step 1: Add MC workspace creation after provisioning**

In `packages/api/src/services/queue.ts`, inside the worker's job handler, after the `provisionInstance()` call succeeds, add:

```typescript
import { createMCWorkspace, isMCConfigured } from "./mission-control.js";

// Inside the worker handler, after provisionInstance succeeds:
if (isMCConfigured()) {
  try {
    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.userId, userId),
        eq(instances.subscriptionId, subscriptionId),
        eq(instances.status, "ready"),
      ),
    });

    if (instance && !instance.mcWorkspaceId) {
      const workspaceId = await createMCWorkspace(
        instance.id,
        instance.instanceName || instance.id,
      );
      if (workspaceId) {
        await db
          .update(instances)
          .set({ mcWorkspaceId: workspaceId, updatedAt: new Date() })
          .where(eq(instances.id, instance.id));
        logger.info("MC workspace created during provisioning", {
          instanceId: instance.id,
          workspaceId,
        });
      }
    }
  } catch (error) {
    logger.warn("Failed to create MC workspace during provisioning (will lazy-create later)", {
      error: (error as Error).message,
    });
  }
}
```

- [ ] **Step 2: Add to direct provisioning path (stripe.ts)**

In `packages/api/src/services/stripe.ts`, after the direct `provisionInstance()` call succeeds (non-Redis path), add the same MC workspace creation logic:

```typescript
import { createMCWorkspace, isMCConfigured } from "./mission-control.js";

// After provisionInstance() succeeds in the direct path:
if (isMCConfigured()) {
  try {
    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.userId, userId),
        eq(instances.subscriptionId, subscriptionId),
        eq(instances.status, "ready"),
      ),
    });

    if (instance && !instance.mcWorkspaceId) {
      const workspaceId = await createMCWorkspace(
        instance.id,
        instance.instanceName || instance.id,
      );
      if (workspaceId) {
        await db
          .update(instances)
          .set({ mcWorkspaceId: workspaceId, updatedAt: new Date() })
          .where(eq(instances.id, instance.id));
        logger.info("MC workspace created during direct provisioning", {
          instanceId: instance.id,
          workspaceId,
        });
      }
    }
  } catch (error) {
    logger.warn("Failed to create MC workspace during direct provisioning (will lazy-create later)", {
      error: (error as Error).message,
    });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:api`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/queue.ts packages/api/src/services/stripe.ts
git commit -m "feat: create MC workspace during instance provisioning"
```

---

## Chunk 2: Frontend

### Task 7: Add Agent Ops API client methods

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Add 5 API methods**

Append to `packages/web/src/lib/api.ts`:

```typescript
import type {
  OpsCostsResponse,
  OpsCostTrendsResponse,
  OpsHealthResponse,
  OpsSecurityResponse,
  OpsMemoryResponse,
  OpsUnavailableResponse,
  OpsPeriod,
} from "@sparkclaw/shared/types";

// ── Agent Ops ──────────────────────────────────────────────────────

export async function getInstanceOpsCosts(instanceId: string, period: OpsPeriod = "24h") {
  return request<OpsCostsResponse | OpsUnavailableResponse>(
    `/api/instances/${instanceId}/ops/costs?period=${period}`,
  );
}

export async function getInstanceOpsCostTrends(instanceId: string, period: OpsPeriod = "24h") {
  return request<OpsCostTrendsResponse | OpsUnavailableResponse>(
    `/api/instances/${instanceId}/ops/costs/trends?period=${period}`,
  );
}

export async function getInstanceOpsHealth(instanceId: string) {
  return request<OpsHealthResponse | OpsUnavailableResponse>(
    `/api/instances/${instanceId}/ops/health`,
  );
}

export async function getInstanceOpsSecurity(instanceId: string) {
  return request<OpsSecurityResponse | OpsUnavailableResponse>(
    `/api/instances/${instanceId}/ops/security`,
  );
}

export async function getInstanceOpsMemory(instanceId: string) {
  return request<OpsMemoryResponse | OpsUnavailableResponse>(
    `/api/instances/${instanceId}/ops/memory`,
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:web`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat: add Agent Ops API client methods"
```

---

### Task 8: Add Agent Ops tab to dashboard

**Files:**
- Modify: `packages/web/src/routes/dashboard/[id]/+page.svelte`

- [ ] **Step 1: Add state variables**

In the `<script>` section, add alongside existing state:

```typescript
import {
  getInstanceOpsCosts,
  getInstanceOpsCostTrends,
  getInstanceOpsHealth,
  getInstanceOpsSecurity,
  getInstanceOpsMemory,
} from "$lib/api";
import type {
  OpsCostsResponse,
  OpsCostTrendsResponse,
  OpsHealthResponse,
  OpsSecurityResponse,
  OpsMemoryResponse,
  OpsUnavailableResponse,
  OpsPeriod,
  OpsSubTab,
} from "@sparkclaw/shared/types";
```

Update the `activeTab` type to include `"agentops"`:

```typescript
let activeTab = $state<"controls" | "logs" | "envvars" | "jobs" | "skills" | "agentops">("controls");
```

Add Agent Ops state:

```typescript
// ── Agent Ops state
let opsSubTab = $state<OpsSubTab>("costs");
let opsPeriod = $state<OpsPeriod>("24h");
let opsCosts = $state<OpsCostsResponse | OpsUnavailableResponse | null>(null);
let opsCostTrends = $state<OpsCostTrendsResponse | OpsUnavailableResponse | null>(null);
let opsHealth = $state<OpsHealthResponse | OpsUnavailableResponse | null>(null);
let opsSecurity = $state<OpsSecurityResponse | OpsUnavailableResponse | null>(null);
let opsMemory = $state<OpsMemoryResponse | OpsUnavailableResponse | null>(null);
let opsLoading = $state(false);
let opsHealthTimer: ReturnType<typeof setInterval> | undefined;

// Clean up health timer on component destroy
import { onDestroy } from "svelte";
onDestroy(() => {
  clearInterval(opsHealthTimer);
});
```

- [ ] **Step 2: Add data loading functions**

```typescript
async function loadOpsCosts() {
  opsLoading = true;
  try {
    const [costs, trends] = await Promise.all([
      getInstanceOpsCosts(instanceId, opsPeriod),
      getInstanceOpsCostTrends(instanceId, opsPeriod),
    ]);
    opsCosts = costs;
    opsCostTrends = trends;
  } catch (err) {
    opsCosts = { available: false };
    opsCostTrends = { available: false };
  } finally {
    opsLoading = false;
  }
}

async function loadOpsHealth() {
  opsLoading = true;
  try {
    opsHealth = await getInstanceOpsHealth(instanceId);
  } catch {
    opsHealth = { available: false };
  } finally {
    opsLoading = false;
  }
}

async function loadOpsSecurity() {
  opsLoading = true;
  try {
    opsSecurity = await getInstanceOpsSecurity(instanceId);
  } catch {
    opsSecurity = { available: false };
  } finally {
    opsLoading = false;
  }
}

async function loadOpsMemory() {
  opsLoading = true;
  try {
    opsMemory = await getInstanceOpsMemory(instanceId);
  } catch {
    opsMemory = { available: false };
  } finally {
    opsLoading = false;
  }
}

function loadOpsSubTab(sub: OpsSubTab) {
  opsSubTab = sub;
  if (sub === "costs") loadOpsCosts();
  else if (sub === "health") {
    loadOpsHealth();
    // Auto-refresh health every 30s
    clearInterval(opsHealthTimer);
    opsHealthTimer = setInterval(loadOpsHealth, 30_000);
  } else if (sub === "security") loadOpsSecurity();
  else if (sub === "memory") loadOpsMemory();
}
```

- [ ] **Step 3: Update switchTab function**

Add to the existing `switchTab` function:

```typescript
if (tab === "agentops") {
  loadOpsSubTab(opsSubTab);
} else {
  // Clear health timer when leaving Agent Ops
  clearInterval(opsHealthTimer);
}
```

- [ ] **Step 4: Add "Agent Ops" to tab bar**

In the tab bar `{#each}` array, add:

```typescript
{ id: "agentops", label: "Agent Ops" },
```

- [ ] **Step 5: Add Agent Ops tab content**

After the last `{:else if activeTab === "skills"}` block, add:

```svelte
{:else if activeTab === "agentops"}
  <!-- Agent Ops Sub-tabs -->
  <div class="flex gap-1 bg-warm-50 rounded-lg p-1 mb-6">
    {#each [
      { id: "costs", label: "Costs" },
      { id: "health", label: "Health" },
      { id: "security", label: "Security" },
      { id: "memory", label: "Memory" },
    ] as sub (sub.id)}
      <button
        onclick={() => loadOpsSubTab(sub.id as OpsSubTab)}
        class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {opsSubTab === sub.id ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-500 hover:text-warm-700'}"
      >
        {sub.label}
      </button>
    {/each}
  </div>

  {#if opsLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-6 h-6 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin"></div>
    </div>

  <!-- ═══ Costs Sub-tab ═══ -->
  {:else if opsSubTab === "costs"}
    {#if opsCosts && opsCosts.available}
      <!-- Period selector -->
      <div class="flex justify-end mb-4">
        <div class="flex gap-1 bg-warm-100 rounded-lg p-1">
          {#each ["24h", "7d", "30d"] as p}
            <button
              onclick={() => { opsPeriod = p as OpsPeriod; loadOpsCosts(); }}
              class="px-3 py-1 rounded-md text-xs font-medium transition-colors {opsPeriod === p ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-500 hover:text-warm-700'}"
            >
              {p}
            </button>
          {/each}
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl border border-warm-200 p-4">
          <p class="text-xs text-warm-500 mb-1">Total Tokens</p>
          <p class="text-xl font-bold text-warm-900">{opsCosts.totalTokens.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-xl border border-warm-200 p-4">
          <p class="text-xs text-warm-500 mb-1">Total Cost</p>
          <p class="text-xl font-bold text-warm-900">${opsCosts.totalCost.toFixed(4)}</p>
        </div>
        <div class="bg-white rounded-xl border border-warm-200 p-4">
          <p class="text-xs text-warm-500 mb-1">Requests</p>
          <p class="text-xl font-bold text-warm-900">{opsCosts.requestCount.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-xl border border-warm-200 p-4">
          <p class="text-xs text-warm-500 mb-1">Avg Cost/Request</p>
          <p class="text-xl font-bold text-warm-900">${opsCosts.avgCostPerRequest.toFixed(6)}</p>
        </div>
      </div>

      <!-- By model table -->
      {#if opsCosts.byModel.length > 0}
        <div class="bg-white rounded-xl border border-warm-200 overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="border-b border-warm-200 bg-warm-50">
                <th class="text-left text-xs font-semibold text-warm-500 px-4 py-3">Model</th>
                <th class="text-right text-xs font-semibold text-warm-500 px-4 py-3">Tokens</th>
                <th class="text-right text-xs font-semibold text-warm-500 px-4 py-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {#each opsCosts.byModel as model}
                <tr class="border-b border-warm-100 last:border-0">
                  <td class="px-4 py-3 text-sm text-warm-900">{model.model}</td>
                  <td class="px-4 py-3 text-sm text-warm-700 text-right">{model.tokens.toLocaleString()}</td>
                  <td class="px-4 py-3 text-sm text-warm-700 text-right">${model.cost.toFixed(4)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <!-- Trends chart placeholder -->
      {#if opsCostTrends && opsCostTrends.available && opsCostTrends.hourly.length > 0}
        <div class="mt-6 bg-white rounded-xl border border-warm-200 p-4">
          <h3 class="text-sm font-semibold text-warm-700 mb-3">Token Usage Trend</h3>
          {@const maxTokens = Math.max(...opsCostTrends.hourly.map(h => h.tokens)) || 1}
          <div class="flex items-end gap-1 h-32">
            {#each opsCostTrends.hourly as point}
              <div
                class="flex-1 bg-terra-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                style="height: {Math.max((point.tokens / maxTokens) * 100, 2)}%"
                title="{point.time}: {point.tokens.toLocaleString()} tokens (${ point.cost.toFixed(4)})"
              ></div>
            {/each}
          </div>
        </div>
      {/if}

    {:else}
      <div class="text-center py-12 text-warm-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-sm">Agent Ops is being set up</p>
      </div>
    {/if}

  <!-- ═══ Health Sub-tab ═══ -->
  {:else if opsSubTab === "health"}
    {#if opsHealth && opsHealth.available}
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-warm-700">Agent Status</h3>
        <span class="text-xs text-warm-400">Auto-refresh 30s</span>
      </div>

      {#if opsHealth.agents.length > 0}
        <div class="space-y-3">
          {#each opsHealth.agents as agent}
            <div class="bg-white rounded-xl border border-warm-200 p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full {
                    agent.status === 'active' ? 'bg-green-500' :
                    agent.status === 'idle' ? 'bg-yellow-500' :
                    agent.status === 'error' ? 'bg-red-500' : 'bg-warm-300'
                  }"></span>
                  <span class="text-sm font-semibold text-warm-900">{agent.name}</span>
                </div>
                <span class="text-xs px-2 py-1 rounded-full font-medium {
                  agent.status === 'active' ? 'bg-green-100 text-green-700' :
                  agent.status === 'idle' ? 'bg-yellow-100 text-yellow-700' :
                  agent.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-warm-100 text-warm-500'
                }">{agent.status}</span>
              </div>
              {#if agent.lastSeen}
                <p class="text-xs text-warm-400 mb-2">Last seen: {new Date(agent.lastSeen).toLocaleString()}</p>
              {/if}
              <div class="grid grid-cols-4 gap-2 text-center">
                <div class="bg-warm-50 rounded-lg p-2">
                  <p class="text-xs text-warm-400">Total</p>
                  <p class="text-sm font-bold">{agent.taskStats.total}</p>
                </div>
                <div class="bg-warm-50 rounded-lg p-2">
                  <p class="text-xs text-warm-400">Assigned</p>
                  <p class="text-sm font-bold">{agent.taskStats.assigned}</p>
                </div>
                <div class="bg-warm-50 rounded-lg p-2">
                  <p class="text-xs text-warm-400">In Progress</p>
                  <p class="text-sm font-bold">{agent.taskStats.inProgress}</p>
                </div>
                <div class="bg-warm-50 rounded-lg p-2">
                  <p class="text-xs text-warm-400">Done</p>
                  <p class="text-sm font-bold">{agent.taskStats.done}</p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center py-8 text-sm text-warm-400">No agents registered yet</p>
      {/if}
    {:else}
      <div class="text-center py-12 text-warm-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <p class="text-sm">Agent Ops is being set up</p>
      </div>
    {/if}

  <!-- ═══ Security Sub-tab ═══ -->
  {:else if opsSubTab === "security"}
    {#if opsSecurity && opsSecurity.available}
      <!-- Posture Score -->
      <div class="flex items-center gap-6 mb-6">
        <div class="relative w-24 h-24">
          <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e0db" stroke-width="8" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="{
              opsSecurity.level === 'hardened' ? '#16a34a' :
              opsSecurity.level === 'secure' ? '#2563eb' :
              opsSecurity.level === 'needs-attention' ? '#d97706' : '#dc2626'
            }" stroke-width="8" stroke-dasharray="{opsSecurity.postureScore * 2.83} 283" stroke-linecap="round" />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-2xl font-bold text-warm-900">{opsSecurity.postureScore}</span>
          </div>
        </div>
        <div>
          <p class="text-lg font-semibold text-warm-900 capitalize">{opsSecurity.level.replace('-', ' ')}</p>
          <p class="text-sm text-warm-500">Security Posture Score</p>
        </div>
      </div>

      <!-- Trust Scores -->
      {#if opsSecurity.trustScores.length > 0}
        <div class="bg-white rounded-xl border border-warm-200 p-4 mb-4">
          <h3 class="text-sm font-semibold text-warm-700 mb-3">Agent Trust Scores</h3>
          <div class="space-y-2">
            {#each opsSecurity.trustScores as ts}
              <div class="flex items-center justify-between">
                <span class="text-sm text-warm-700">{ts.agentName}</span>
                <div class="flex items-center gap-2">
                  <div class="w-24 h-2 bg-warm-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full {ts.score >= 70 ? 'bg-green-500' : ts.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: {ts.score}%"></div>
                  </div>
                  <span class="text-xs font-medium text-warm-600 w-8 text-right">{ts.score}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Threats summary -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-warm-200 p-4">
          <p class="text-xs text-warm-500 mb-1">Secret Exposures</p>
          <p class="text-2xl font-bold {opsSecurity.secretExposures.count > 0 ? 'text-red-600' : 'text-green-600'}">{opsSecurity.secretExposures.count}</p>
        </div>
        <div class="bg-white rounded-xl border border-warm-200 p-4">
          <p class="text-xs text-warm-500 mb-1">Injection Attempts</p>
          <p class="text-2xl font-bold {opsSecurity.injectionAttempts.count > 0 ? 'text-red-600' : 'text-green-600'}">{opsSecurity.injectionAttempts.count}</p>
        </div>
      </div>
    {:else}
      <div class="text-center py-12 text-warm-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p class="text-sm">Agent Ops is being set up</p>
      </div>
    {/if}

  <!-- ═══ Memory Sub-tab ═══ -->
  {:else if opsSubTab === "memory"}
    {#if opsMemory && opsMemory.available}
      {#if opsMemory.files.length > 0}
        <div class="bg-white rounded-xl border border-warm-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-warm-200 bg-warm-50">
            <h3 class="text-sm font-semibold text-warm-700">Memory Files ({opsMemory.files.length})</h3>
          </div>
          <div class="divide-y divide-warm-100">
            {#each opsMemory.files as file}
              <div class="px-4 py-3 flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-warm-900">{file.name}</p>
                  <p class="text-xs text-warm-400">{file.path}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-warm-500">{(file.size / 1024).toFixed(1)} KB</p>
                  <p class="text-xs text-warm-400">{new Date(file.lastModified).toLocaleDateString()}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>

        {#if opsMemory.relationships.length > 0}
          <div class="mt-4 bg-white rounded-xl border border-warm-200 overflow-hidden">
            <div class="px-4 py-3 border-b border-warm-200 bg-warm-50">
              <h3 class="text-sm font-semibold text-warm-700">Relationships ({opsMemory.relationships.length})</h3>
            </div>
            <div class="divide-y divide-warm-100">
              {#each opsMemory.relationships as rel}
                <div class="px-4 py-3 flex items-center gap-2 text-sm">
                  <span class="text-warm-700">{rel.source}</span>
                  <span class="text-warm-400">→</span>
                  <span class="px-2 py-0.5 bg-warm-100 rounded text-xs text-warm-500">{rel.type}</span>
                  <span class="text-warm-400">→</span>
                  <span class="text-warm-700">{rel.target}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <p class="text-center py-8 text-sm text-warm-400">No memory files yet</p>
      {/if}
    {:else}
      <div class="text-center py-12 text-warm-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
        </svg>
        <p class="text-sm">Agent Ops is being set up</p>
      </div>
    {/if}
  {/if}
```

- [ ] **Step 6: Verify build**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun run build:web`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/routes/dashboard/\[id\]/+page.svelte
git commit -m "feat: add Agent Ops tab with costs, health, security, memory sub-tabs"
```

---

## Chunk 3: Backfill & Cleanup

### Task 9: Create backfill script

**Files:**
- Create: `scripts/backfill-mc-workspaces.ts`

- [ ] **Step 1: Create the script**

Create `scripts/backfill-mc-workspaces.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/backfill-mc-workspaces.ts
git commit -m "feat: add backfill script for MC workspace creation"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full build check**

Run: `cd "/Users/wora/My Saas/SparkClaw" && bun install && bun run build:shared && bun run build:api && bun run build:web`
Expected: All three packages build successfully.

- [ ] **Step 2: Verify all new files exist**

```bash
ls -la packages/api/src/services/mission-control.ts
ls -la packages/api/src/routes/instance-ops.ts
ls -la scripts/backfill-mc-workspaces.ts
```

- [ ] **Step 3: Review git log**

Run: `git log --oneline -10`
Expected: See all commits from this implementation.
