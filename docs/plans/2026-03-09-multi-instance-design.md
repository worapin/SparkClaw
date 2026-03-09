# Multi-Instance Support Design

## Overview
Allow users to create multiple OpenClaw instances based on their subscription plan limits.
Currently 1 user = 1 instance. This changes to 1 user = N instances (limited by plan).

## Plan Limits
- Starter: 1 instance
- Pro: 3 instances
- Scale: 10 instances

## Database Changes

### Remove unique constraints
- `instances.userId` — remove unique, keep as FK (1:many)
- `instances.subscriptionId` — remove unique, keep as FK (1:many)

### Add plan limits config
Store limits in shared constants (no new table needed):
```ts
export const PLAN_INSTANCE_LIMITS = {
  starter: 1,
  pro: 3,
  scale: 10,
} as const;
```

### Migration
- Drop unique index on `instances.userId`
- Drop unique index on `instances.subscriptionId`
- Existing data is unaffected (1 instance per user still valid)

## API Changes

### New/Modified Endpoints
| Method | Path | Change |
|--------|------|--------|
| GET | `/api/instances` | NEW — list all user instances |
| GET | `/api/instances/:id` | NEW — get single instance (must belong to user) |
| POST | `/api/instances` | NEW — create instance (check limit) |
| DELETE | `/api/instances/:id` | NEW — delete instance + cleanup Railway |
| GET | `/api/instance` | DEPRECATE — redirect to `/api/instances` |
| GET | `/api/setup/state` | MODIFY — require `instanceId` query param |
| POST | `/api/setup/save` | MODIFY — require `instanceId` in body |
| POST | `/api/setup/channel` | MODIFY — require `instanceId` in body |
| DELETE | `/api/setup/channel/:type` | MODIFY — require `instanceId` query param |

### Instance creation flow
1. Check user has active subscription
2. Count existing instances for user
3. Compare against PLAN_INSTANCE_LIMITS[plan]
4. If under limit: create DB record, queue provisioning job
5. If at limit: return 403 with `upgrade_required` error code

### Instance deletion flow
1. Verify instance belongs to user
2. Delete Railway service via API
3. Delete instance + channel_configs from DB (cascade)

## Frontend Changes

### Navbar — Instance Switcher
- Dropdown showing instance name + status badge
- Current instance highlighted
- "New Instance" option at bottom
- Persists selected instance in localStorage

### Dashboard — Instance List
- Grid of instance cards (name, status, URL, domain)
- "New Instance" button (primary CTA)
- When at limit: button disabled + click shows upgrade modal

### Upgrade Modal
- Shows current plan and limit
- Shows next plan with higher limit
- CTA button to /pricing

### Setup Wizard
- URL changes to `/setup?instance=<id>`
- Loads config for specific instance
- All save operations include instanceId

### Instance Detail
- Reuse existing dashboard instance card
- Add "Delete Instance" button with confirmation modal

## Provisioning
- No changes to Railway provisioning logic
- Each instance gets its own Railway service
- Queue job payload already supports instanceId

## What Stays the Same
- Stripe billing (per subscription, not per instance)
- Auth flow (OTP, sessions)
- Admin panel (already queries all instances)
- Channel config schema
- Setup wizard steps (just parameterized by instanceId)
