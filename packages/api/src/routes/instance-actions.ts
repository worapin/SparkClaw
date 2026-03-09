import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { instanceActionSchema } from "@sparkclaw/shared/schemas";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { checkOpenClawHealth } from "../services/openclaw.js";
import { logAudit } from "../services/audit.js";
import { db, instances } from "@sparkclaw/shared/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export const instanceActionsRoutes = new Elysia({ prefix: "/api/instances" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) { set.status = 401; throw new Error("Not authenticated"); }
    const user = await verifySession(token);
    if (!user) { set.status = 401; throw new Error("Invalid session"); }
    return { user };
  })
  // POST /api/instances/:id/action - start/stop/restart
  .post("/:id/action", async ({ user, params, body, set }) => {
    const parsed = instanceActionSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: "Invalid action" }; }

    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }
    if (!instance.railwayUrl && !instance.url) { set.status = 400; return { error: "Instance has no URL" }; }

    const instanceUrl = instance.railwayUrl || instance.url!;
    const action = parsed.data.action;

    try {
      // Proxy action to OpenClaw instance
      const response = await fetch(`${instanceUrl}/api/admin/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Buffer.from(`${instance.id}:${process.env.SESSION_SECRET}`).toString("base64")}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const err = await response.text().catch(() => "Unknown error");
        set.status = 502;
        return { error: `Instance ${action} failed: ${err}` };
      }

      // Update instance status based on action
      const newStatus = action === "stop" ? "suspended" : "ready";
      await db.update(instances).set({ status: newStatus, updatedAt: new Date() }).where(eq(instances.id, params.id));

      logAudit({ userId: user.id, action: `instance_${action}` as "instance_start" | "instance_stop" | "instance_restart", instanceId: params.id });
      return { success: true, action, status: newStatus };
    } catch (e) {
      logger.error(`Instance ${action} failed`, { instanceId: params.id, error: (e as Error).message });
      set.status = 502;
      return { error: `Failed to ${action} instance` };
    }
  })
  // GET /api/instances/:id/health - detailed health check
  .get("/:id/health", async ({ user, params, set }) => {
    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
      with: { channelConfigs: true },
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }

    const instanceUrl = instance.railwayUrl || instance.url;
    let apiHealthy = false;
    let uptime: number | null = null;
    const channelStatus: Record<string, boolean> = {};

    if (instanceUrl) {
      try {
        const res = await fetch(`${instanceUrl}/health`, { signal: AbortSignal.timeout(5000) });
        apiHealthy = res.ok;
        if (res.ok) {
          const data = await res.json().catch(() => ({})) as Record<string, unknown>;
          uptime = typeof data.uptime === "number" ? data.uptime : null;
        }
      } catch { apiHealthy = false; }

      // Check each enabled channel
      for (const ch of (instance.channelConfigs || []).filter(c => c.enabled)) {
        try {
          const res = await fetch(`${instanceUrl}/api/channels/${ch.type}/status`, { signal: AbortSignal.timeout(3000) });
          channelStatus[ch.type] = res.ok;
        } catch { channelStatus[ch.type] = false; }
      }
    }

    return {
      instanceId: instance.id,
      status: instance.status,
      healthy: apiHealthy,
      uptime,
      lastChecked: new Date().toISOString(),
      checks: { api: apiHealthy, channels: channelStatus },
    };
  })
  // GET /api/instances/:id/logs - get recent logs (SSE stream)
  .get("/:id/logs", async ({ user, params, set, request }) => {
    const instance = await db.query.instances.findFirst({
      where: and(eq(instances.id, params.id), eq(instances.userId, user.id)),
    });
    if (!instance) { set.status = 404; return { error: "Instance not found" }; }

    const instanceUrl = instance.railwayUrl || instance.url;
    if (!instanceUrl) { set.status = 400; return { error: "Instance has no URL" }; }

    const accept = request.headers.get("accept") || "";

    // SSE streaming mode
    if (accept.includes("text/event-stream")) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let running = true;

          // Poll OpenClaw logs endpoint
          const poll = async () => {
            while (running) {
              try {
                const res = await fetch(`${instanceUrl}/api/admin/logs?since=${Date.now() - 5000}`, {
                  headers: { "Authorization": `Bearer ${Buffer.from(`${instance.id}:${process.env.SESSION_SECRET}`).toString("base64")}` },
                  signal: AbortSignal.timeout(5000),
                });
                if (res.ok) {
                  const data = await res.json() as { logs: Array<{ timestamp: string; level: string; message: string; metadata?: Record<string, unknown> }> };
                  for (const log of data.logs) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(log)}\n\n`));
                  }
                }
              } catch { /* ignore polling errors */ }
              await new Promise(r => setTimeout(r, 2000));
            }
          };

          poll().catch(() => { running = false; });

          // Cleanup on abort
          request.signal.addEventListener("abort", () => { running = false; controller.close(); });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Regular JSON mode - fetch recent logs
    try {
      const res = await fetch(`${instanceUrl}/api/admin/logs?limit=100`, {
        headers: { "Authorization": `Bearer ${Buffer.from(`${instance.id}:${process.env.SESSION_SECRET}`).toString("base64")}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { set.status = 502; return { error: "Failed to fetch logs" }; }
      const data = await res.json() as { logs: unknown[] };
      return data;
    } catch {
      set.status = 502;
      return { error: "Failed to connect to instance" };
    }
  });
