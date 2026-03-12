# Mission Control Integration — Agent Ops for SparkClaw

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Integrate Mission Control v2 as a proxy-based backend to expose Agent Ops features (costs, health, security, memory) to SparkClaw customers.

---

## 1. Context

SparkClaw is a managed hosting platform for OpenClaw instances. Customers provision AI assistant instances on Railway and manage them via the SparkClaw dashboard (SvelteKit frontend + Elysia API).

Mission Control v2 (https://github.com/builderz-labs/mission-control) is an open-source AI agent operations platform that provides cost tracking, agent health monitoring, security auditing, and memory/knowledge graph features. It runs as a Next.js app with SQLite and supports multi-tenancy via workspace isolation.

**Goal:** Give SparkClaw customers visibility into their OpenClaw instance's agent operations — token costs, agent health, security posture, and memory — without exposing Mission Control directly.

## 2. Architecture

```
Customer (Browser)
  │
  ▼
SparkClaw Web (SvelteKit)
  └── /dashboard/[id] → "Agent Ops" tab
       ├── Costs sub-tab
       ├── Health sub-tab
       ├── Security sub-tab
       └── Memory sub-tab
  │
  │ fetch /api/instances/:id/ops/*
  ▼
SparkClaw API (Elysia)
  └── routes/instance-ops.ts
       └── services/mission-control.ts
            │
            │ HTTP + x-api-key header
            ▼
Mission Control (1 Docker instance on Railway)
  ├── Multi-tenant via workspace_id
  ├── SQLite (WAL mode)
  └── Connected to OpenClaw instances via gateway
```

### Key Decisions

- **Single MC instance** with multi-tenant workspace isolation (not per-customer deployment)
- **SparkClaw API as gatekeeper** — customers never touch MC directly
- **API Key auth** (`x-api-key` header) between SparkClaw API and MC
- **MC is optional** — if unavailable, Agent Ops tab shows empty state; other features unaffected
- **Available to all plans** (Starter, Pro, Scale)

## 3. Database Changes

Add one field to the `instances` table:

```typescript
// packages/shared/src/db/schema.ts
mcWorkspaceId: varchar("mc_workspace_id", { length: 255 })
```

**When set:**
- New instances: after OpenClaw provisioning succeeds, call MC `POST /api/super/tenants` → store returned workspace ID
- Existing instances: migration script creates MC workspaces retroactively

The column is nullable — existing rows will have `NULL` until workspaces are created.

**Migration:** Run `drizzle-kit generate` + `drizzle-kit push` to apply the schema change. This is a non-breaking additive change.

**Backfill script:** A one-time idempotent script (`scripts/backfill-mc-workspaces.ts`) that:
1. Queries all instances where `mcWorkspaceId IS NULL` and `status = 'ready'`
2. For each, calls `createMCWorkspace()` and updates the record
3. Logs successes and failures — safe to re-run
4. Run manually after MC is deployed, not as part of automated deploy

**No new tables.** All agent ops data lives in Mission Control.

## 4. API Routes

New file: `packages/api/src/routes/instance-ops.ts`

Mounted under `/api/instances/:id/ops`

| Route | MC API Called | Response Shape |
|---|---|---|
| `GET /ops/costs?period=24h` | `GET /api/tokens?action=stats&workspaceId=X` | `{ available: true, totalTokens, totalCost, requestCount, avgCostPerRequest, byModel: [{ model, tokens, cost }] }` |
| `GET /ops/costs/trends?period=24h` | `GET /api/tokens?action=trends&workspaceId=X` | `{ available: true, hourly: [{ time, tokens, cost }] }` |
| `GET /ops/health` | `GET /api/agents?workspaceId=X` | `{ available: true, agents: [{ name, status, lastSeen, taskStats }] }` |
| `GET /ops/security` | `GET /api/security-audit?workspaceId=X` | `{ available: true, postureScore, level, trustScores, secretExposures, injectionAttempts }` |
| `GET /ops/memory` | `GET /api/memory?workspaceId=X` | `{ available: true, files: [...], relationships: [...] }` |

**Period parameter:** `?period=24h|7d|30d` (default `24h`). The service layer converts this to a `from` timestamp (e.g., `24h` → `Date.now() - 86400000` as ISO string) and passes it as a query param to MC. The exact MC filter parameter name must be verified during implementation — likely `?from=<ISO timestamp>` based on MC's timestamp-based filtering pattern. Applies to costs and trends routes.

### Auth Flow (every route)

1. Validate session cookie (existing middleware)
2. CSRF middleware (same as other mutation-capable routes)
3. Verify instance belongs to user **or user is a member of an org that the instance owner belongs to** (join: instance.userId → orgMembers.userId → check requesting user is also in that org)
4. Read `mcWorkspaceId` from instance record
5. If no `mcWorkspaceId` → lazy-create: call `createMCWorkspace()`, save it, then continue. If creation fails → return `{ available: false }`
6. Proxy to MC with API Key
7. Transform response → return `{ available: true, ...data }` to client

### Error Handling

- MC unreachable → `502 { error: "Agent ops temporarily unavailable" }`
- Timeout: 5 seconds (`AbortSignal.timeout(5000)`)
- Never blocks other instance features
- **Response caching:** API layer caches MC responses for 30 seconds (in-memory). Prevents excessive load from multiple clients polling simultaneously. Cache key: `${instanceId}:${endpoint}:${period}`
- **Rate limiting:** Ops routes share SparkClaw's existing rate limiting. No additional per-route limiting needed — the 30s cache absorbs repeated identical requests, and the limited parameter space (5 endpoints × 3 periods) bounds cache misses

## 5. Service Layer

New file: `packages/api/src/services/mission-control.ts`

```typescript
// Environment
MISSION_CONTROL_URL   // e.g., http://mission-control:3000
MISSION_CONTROL_API_KEY // e.g., mc_xxx

// Functions
fetchMCCosts(workspaceId: string)
fetchMCCostTrends(workspaceId: string)
fetchMCAgentHealth(workspaceId: string)
fetchMCSecurityAudit(workspaceId: string)
fetchMCMemory(workspaceId: string)
createMCWorkspace(instanceId: string, name: string)
```

**Pattern:** Same as existing OpenClaw proxy in `services/openclaw.ts` — native `fetch`, timeout via `AbortSignal`, API Key in `x-api-key` header, response transform, custom error throws.

**MC endpoint verification note:** The tenant creation endpoint (`POST /api/super/tenants`) and other MC endpoints are based on MC v2 documentation. These must be verified against the actual MC source code during implementation. If endpoints differ, update the service layer accordingly.

**Response transform:** Each fetch function maps the MC response to the SparkClaw response shape defined in Section 4. The exact MC response schemas must be determined from the MC source code during implementation (similar to the endpoint verification note above). The implementer will:
1. Read MC route handlers to determine actual response shapes
2. Define TypeScript types for both MC responses (`MCTokenStats`, `MCAgentList`, etc.) and SparkClaw responses (`OpsCotsResponse`, `OpsHealthResponse`, etc.) in `@sparkclaw/shared/types`
3. Write transform functions that map between the two

This is intentionally deferred to implementation time because MC is alpha and response shapes may change.

### Provisioning Hook

Added to `services/queue.ts` (or direct provisioning path):
- After OpenClaw instance is ready → call `createMCWorkspace()`
- Save `mcWorkspaceId` to instance record
- If MC call fails → log warning, do not block provisioning. Workspace will be lazy-created on first Agent Ops tab visit (see Auth Flow step 5)

## 6. Frontend

### Tab Structure

Added to `packages/web/src/routes/dashboard/[id]/+page.svelte`:

```
Controls | Logs | Env Vars | Jobs | Skills | Agent Ops
                                              │
                                    ┌─────────┼──────────┬──────────┐
                                    ▼         ▼          ▼          ▼
                                  Costs    Health    Security    Memory
```

### Sub-tab: Costs

- Summary cards: Total Tokens, Total Cost, Requests, Avg Cost/Request
- By-model breakdown table (model name, tokens, cost)
- Trend chart (24h hourly bar/line)
- Period selector: 24h / 7d / 30d

### Sub-tab: Health

- Agent list with status badges (active / idle / offline / error)
- Last seen timestamp per agent
- Task stats per agent (total / assigned / in_progress / done)
- Auto-refresh every 30 seconds

### Sub-tab: Security

- Posture score circle (0-100) with level badge (hardened / secure / needs-attention / at-risk)
- Per-agent trust scores
- Secret exposure count + recent incidents list
- Injection attempt count + recent attempts list

### Sub-tab: Memory

- File tree browser (memory files from agent knowledge base)
- Relationship list (simplified — no full graph visualization in v1)

### Unavailable State

If `mcWorkspaceId` is not set or MC is unreachable:
- Show empty state with icon: "Agent Ops is being set up"
- No error thrown, no impact on other tabs

### API Client

Extend `activeTab` type to include `"agentops"`. Add `activeOpsSubTab` state: `"costs" | "health" | "security" | "memory"` (default `"costs"`).

Add 5 methods to `packages/web/src/lib/api.ts`:

```typescript
getInstanceOpsCosts(instanceId: string)
getInstanceOpsCostTrends(instanceId: string)
getInstanceOpsHealth(instanceId: string)
getInstanceOpsSecurity(instanceId: string)
getInstanceOpsMemory(instanceId: string)
```

## 7. Environment & Deployment

### New Environment Variables

```
MISSION_CONTROL_URL=http://mission-control:3000
MISSION_CONTROL_API_KEY=mc_xxx
```

### Mission Control Deployment

- Docker container on Railway (single service)
- Internal network only — not publicly exposed
- SQLite with volume mount for persistence
- Standalone mode: `NEXT_PUBLIC_GATEWAY_OPTIONAL=true`

### Graceful Degradation

- MC not available → Agent Ops tab shows empty state
- Same pattern as Redis (optional dependency)
- All other SparkClaw features work normally

### Scale Considerations

- MC's SQLite uses WAL mode by default (configured in MC's database setup). SQLite single-writer is sufficient for current scale (tens of instances, low write frequency from telemetry)
- Agent Ops reads are cacheable (30s TTL) — MC sees at most 1 request per endpoint per instance per 30s
- If scale exceeds ~100 concurrent instances, consider migrating MC to PostgreSQL or adding a read replica layer
- Health sub-tab auto-refresh (30s) is the highest frequency poller; other sub-tabs fetch on visit only

## 8. Summary of Changes

| Component | What's Added |
|---|---|
| DB | 1 field: `mcWorkspaceId` in instances table |
| API | 1 route file (`instance-ops.ts`) + 1 service file (`mission-control.ts`) + 2 env vars |
| Frontend | 1 new tab "Agent Ops" with 4 sub-tabs + 5 API client methods |
| Infra | 1 Docker container (Mission Control) on Railway |
| Provisioning | Hook to create MC workspace when instance is provisioned |

## 9. Out of Scope (Future)

- Full interactive knowledge graph visualization (v2)
- Task management / Kanban board from MC
- Agent-to-agent messaging
- Eval framework integration
- Skills Hub from MC (SparkClaw has its own custom skills)
- Customer self-service MC access (always proxied through SparkClaw)
