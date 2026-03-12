import { getEnv } from "@sparkclaw/shared";
import { db, instances } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
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
  const params = new URLSearchParams({ action: "stats", workspaceId, from });
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/tokens?${params}`,
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
  const params = new URLSearchParams({ action: "trends", workspaceId, from });
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/tokens?${params}`,
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

  const params = new URLSearchParams({ workspaceId });
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/agents?${params}`,
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

  const params = new URLSearchParams({ workspaceId });
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/security-audit?${params}`,
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

  const params = new URLSearchParams({ workspaceId });
  const raw = await mcFetch<Record<string, unknown>>(
    `/api/memory?${params}`,
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

// ── Provisioning helper (shared by queue.ts and stripe.ts) ────

export async function provisionMCWorkspaceForInstance(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  if (!isMCConfigured()) return;

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
