# SparkClaw Full Feature Roadmap

Updated: 2026-03-09
Source: Competitor analysis (openclawhosting.io, hostinger, docs.openclaw.ai) + original roadmap

---

## Phase 1: Foundation (Current Sprint)

### 1.1 Multi-Instance Support
- Plan limits: Starter 1, Pro 3, Scale 10
- Instance list dashboard + navbar switcher
- Create/delete instances
- See: `docs/plans/2026-03-09-multi-instance-plan.md`

### 1.2 Secret Management (AES-256)
- Encrypt channel credentials at rest (currently plain JSONB)
- AES-256-GCM encryption with per-instance keys
- Key derivation from SESSION_SECRET + instanceId
- Decrypt only when sending to OpenClaw

### 1.3 Advanced Security
- **2FA (TOTP)**: Google Authenticator / Authy compatible
  - New `totp_secrets` table (userId, secret, enabled, backupCodes)
  - Enforce on login after OTP email verification
  - Backup codes for recovery
- **API Keys**: Let users control instances programmatically
  - New `api_keys` table (id, userId, name, keyHash, scopes, lastUsedAt, expiresAt)
  - Scopes: `instance:read`, `instance:write`, `setup:read`, `setup:write`
  - Bearer token auth alternative to session cookie
- **Audit Logs**:
  - New `audit_logs` table (id, userId, instanceId, action, metadata, ip, createdAt)
  - Track: login, instance create/delete, setup changes, channel config changes
  - Admin viewable in admin panel

---

## Phase 2: Power Features

### 2.1 Team/Organization Support
- New `organizations` table + `org_members` (userId, orgId, role: owner/admin/member)
- Instances belong to org instead of user
- Invite members by email
- Role-based permissions (owner can delete, admin can configure, member can view)
- Org-level billing (single subscription for the org)

### 2.2 BYOK (Bring Your Own Key) for LLM
- New `llm_keys` table (id, userId, provider, encryptedKey, createdAt)
- Providers: openai, anthropic, google, ollama
- UI in setup wizard step 2: toggle "Use my own API key"
- Pass key to OpenClaw instance via env var override
- Validate key before saving (test API call)

### 2.3 Usage-Based Billing Add-ons
- Stripe metered billing for:
  - Extra instances beyond plan limit
  - LLM token usage (when using managed gateway)
  - Storage (file processing)
- Usage tracking table: `usage_records` (id, userId, instanceId, type, quantity, period)
- Monthly invoice with breakdown
- Usage dashboard in /account

---

## Phase 3: Operations & Observability

### 3.1 Mission Control Dashboard
- Per-instance analytics:
  - Messages processed (by channel, by day)
  - LLM token usage and cost
  - Response latency (p50, p95, p99)
  - Error rate
  - Active users
- Aggregate dashboard for all instances
- Data source: OpenClaw instance metrics endpoint + Langfuse
- Time range selector (24h, 7d, 30d)
- Export as CSV

### 3.2 Scheduled Jobs / Cron
- Cron-style task scheduling per instance
- New `scheduled_jobs` table (id, instanceId, name, cronExpression, taskType, config, enabled)
- Task types: backup, report generation, data sync, custom webhook
- UI in setup wizard or separate /jobs page
- Execution via BullMQ repeatable jobs

### 3.3 Deployment Management
- View deployment history per instance
- Rollback to previous deployment
- Blue/green deployment support (Railway)
- Deployment notifications (email/webhook)

### 3.4 Backup & Restore
- Automated daily backups of instance config + data
- Manual backup trigger
- Restore from backup
- Backup retention: 7 days (Starter), 30 days (Pro), 90 days (Scale)

---

## Phase 4: Ecosystem

### 4.1 App Integrations
- **Slack**: Workspace integration (beyond just channel)
- **Google Sheets**: Read/write spreadsheets
- **Shopify**: Product catalog, order notifications
- **Notion**: Knowledge base sync
- **GitHub**: Issue/PR notifications
- OAuth2 flow for each integration
- New `integrations` table (id, instanceId, type, credentials, settings, enabled)

### 4.2 Custom Skills (Plugin System)
- Users write Python or TypeScript skills
- Upload via UI or git repo
- Sandboxed execution in instance container
- Skill marketplace (future)
- Skills stored in `custom_skills` table (id, instanceId, name, language, code, enabled)

### 4.3 REST API for Users
- Public API for programmatic instance control
- Endpoints mirror web UI functionality
- API key authentication (from Phase 1.3)
- Rate limiting per API key
- OpenAPI spec + docs at /api/docs
- SDK generation (TypeScript, Python)

---

## Phase 5: Platform Expansion

### 5.1 Additional Channels
- Signal (when API available)
- Microsoft Teams
- Email (inbound/outbound)
- SMS (Twilio)
- Voice (Twilio)

### 5.2 Mobile Apps
- React Native or Flutter
- Instance management on the go
- Push notifications for alerts
- Simplified setup wizard
- Biometric auth (Face ID / fingerprint)

### 5.3 Environment Promotion
- Dev/Staging/Prod environments per instance
- Promote config from dev → staging → prod
- Separate Railway services per environment
- Environment-specific secrets

### 5.4 Data Residency
- Region selection: US, EU, APAC
- Railway region deployment
- Compliance: GDPR, SOC 2 alignment
- Data processing agreements

---

## Priority Matrix

| Feature | Business Value | Effort | Priority |
|---------|---------------|--------|----------|
| Multi-Instance | High | Medium | P0 — NOW |
| Secret Management | High | Low | P0 — NOW |
| 2FA + API Keys | High | Medium | P1 |
| Audit Logs | Medium | Low | P1 |
| Team/Org Support | High | High | P1 |
| BYOK | High | Medium | P2 |
| Usage Billing | High | High | P2 |
| Mission Control | Medium | High | P2 |
| Scheduled Jobs | Medium | Medium | P2 |
| Deployment Mgmt | Medium | Medium | P3 |
| Backup & Restore | Medium | Medium | P3 |
| App Integrations | Medium | High | P3 |
| Custom Skills | Medium | High | P3 |
| REST API | Medium | Medium | P3 |
| Mobile Apps | Low | Very High | P4 |
| Environment Promotion | Low | High | P4 |
| Data Residency | Low | High | P4 |
