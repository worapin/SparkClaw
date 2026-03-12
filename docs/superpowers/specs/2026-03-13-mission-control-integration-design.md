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
mcWorkspaceId: text("mc_workspace_id")
```

**When set:**
- New instances: after OpenClaw provisioning succeeds, call MC `POST /api/super/tenants` → store returned workspace ID
- Existing instances: migration script creates MC workspaces retroactively

**No new tables.** All agent ops data lives in Mission Control.

## 4. API Routes

New file: `packages/api/src/routes/instance-ops.ts`

Mounted under `/api/instances/:id/ops`

| Route | MC API Called | Response Shape |
|---|---|---|
| `GET /ops/costs` | `GET /api/tokens?action=stats&workspaceId=X` | `{ totalTokens, totalCost, requestCount, avgCostPerRequest, byModel: [{ model, tokens, cost }] }` |
| `GET /ops/costs/trends` | `GET /api/tokens?action=trends&workspaceId=X` | `{ hourly: [{ time, tokens, cost }] }` |
| `GET /ops/health` | `GET /api/agents?workspaceId=X` | `{ agents: [{ name, status, lastSeen, taskStats }] }` |
| `GET /ops/security` | `GET /api/security-audit?workspaceId=X` | `{ postureScore, level, trustScores, secretExposures, injectionAttempts }` |
| `GET /ops/memory` | `GET /api/memory?workspaceId=X` | `{ files: [...], relationships: [...] }` |

### Auth Flow (every route)

1. Validate session cookie (existing middleware)
2. Verify instance belongs to user
3. Read `mcWorkspaceId` from instance record
4. If no `mcWorkspaceId` → return `{ available: false }`
5. Proxy to MC with API Key
6. Transform response → return to client

### Error Handling

- MC unreachable → `502 { error: "Agent ops temporarily unavailable" }`
- Timeout: 5 seconds (`AbortSignal.timeout(5000)`)
- Never blocks other instance features

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

### Provisioning Hook

Added to `services/queue.ts` (or direct provisioning path):
- After OpenClaw instance is ready → call `createMCWorkspace()`
- Save `mcWorkspaceId` to instance record
- If MC call fails → log warning, do not block provisioning, retry later

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
