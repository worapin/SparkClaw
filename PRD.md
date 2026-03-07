# SparkClaw – Product Requirements Document (Full)

> **Product name (provisional):** SparkClaw – Managed OpenClaw & Mission Control
> **Version:** V0 + Roadmap
> **Last updated:** 2026-03-07

---

## 1. Executive Summary

### Problem

OpenClaw เป็น open-source AI assistant framework ยอดนิยม (270k+ GitHub stars) รองรับ 25+ messaging channels (Telegram, Discord, Slack, LINE, WhatsApp ฯลฯ) แต่การ deploy OpenClaw instance ต้องมีความรู้ด้าน DevOps: provision server, config Docker, SSL, database, secrets, monitoring, backups, และตามอัปเดตเวอร์ชันเอง ซึ่งเป็น barrier สำหรับ creator, indie dev, agency และ SME ที่อยากใช้ AI assistant แต่ไม่อยากจัดการ infra.

### Solution

SparkClaw เป็น managed hosting + control panel สำหรับ OpenClaw:

- ผู้ใช้สมัคร + จ่ายรายเดือนผ่าน Stripe.
- ระบบสร้าง OpenClaw instance บน Railway ให้อัตโนมัติ.
- ผู้ใช้ได้ลิงก์ `/setup` และ UI หลัก พร้อมเริ่มต่อ LINE/Telegram/Web ได้เลย.
- ระยะยาว มี mission control + app integrations (Sheets, Slack, Shopify ฯลฯ) และ wizard สำหรับ non-tech.

### Value Proposition

- **"Launch your own OpenClaw in minutes."** – จาก signup ถึง instance พร้อมใช้ใน < 5 นาที
- **"We host OpenClaw on modern cloud for you. You focus on building."** – ไม่ต้องแตะ VPS, Docker, Railway, SSL, backups เลย
- **Powered by OpenClaw, not a customGPT toy.** – ระบุชัดทุกหน้า ว่า engine คือ OpenClaw ที่ dev ทั่วโลกใช้
- **Predictable pricing + optional usage add-ons**

### V0 Goal

ให้ผู้ใช้ global จ่ายรายเดือนผ่าน Stripe แล้วระบบสร้าง OpenClaw instance บน Railway ให้อัตโนมัติ พร้อมลิงก์ setup พร้อมใช้ โดยไม่ต้องไปกด deploy มือทีละคน.

---

## 2. Target Users

### Primary – Indie Dev / Creator / Small SaaS (V0 โฟกัส)

- อยากมี OpenClaw เป็น backend agent สำหรับ product / side project / automation
- ไม่อยากเสีย 1 วันไปกับ VPS / Docker / Railway script
- Technical พอใช้ API/Stripe ได้ แต่ไม่อยาก maintain infra
- Pain: Setup self-hosted OpenClaw ยุ่งยาก, docs เยอะ, ล้มแล้วไม่รู้จะแก้ไง

### Secondary – Agency / Consultant

- Deploy AI solutions ให้ลูกค้าหลายราย
- ต้องการ quick onboarding สำหรับลูกค้าใหม่
- Pain: จัดการ multiple deployments manually

### Future – SME / Non-Tech Owner (Phase 2+)

- เจ้าของร้าน/ธุรกิจที่รู้จักชื่อ OpenClaw, อยากใช้ engine แรงๆ แต่ไม่ technical
- อยากได้ "LINE/เว็บแชตบอท" ฉลาดจริง, มี dashboard ดูผลลัพธ์, ปรับได้ง่าย

---

## 3. Scope V0

### 3.1 In-Scope

#### (1) Landing & Pricing (public)

**Landing page** – 1 หน้า, ประกอบด้วย:

| Section | รายละเอียด |
|---------|-----------|
| Hero | Value prop หลัก + CTA "Get Started" |
| Features | สรุปจุดเด่น 3–4 ข้อ (zero DevOps, instant setup, multi-channel, predictable pricing) |
| Pricing | 3 plan cards |
| FAQ | 5–8 คำถามที่พบบ่อย |
| Footer | Links, terms, contact |

**Pricing** – 3 plans (monthly):

| Plan | Price | Target |
|------|-------|--------|
| **Starter** | $19/mo | ทดลอง, personal project |
| **Pro** | $39/mo | Production, single channel/bot |
| **Scale** | $79/mo | Multiple channels, higher resource |

> Plan differentiation detail (resource limits, features) จะ finalize ก่อน launch แต่ V0 ทั้ง 3 plan ได้ OpenClaw instance spec เดียวกัน ต่างกันแค่ชื่อ/ราคา.

#### (2) Auth & Account (Email OTP)

- **Signup/Login flow**: ใช้ Email OTP (one-time password 6 หลัก ส่งไปอีเมล)
  - ผู้ใช้กรอก email → กด "Send Code" → รับ OTP ทางอีเมล → กรอก code → เข้าสู่ระบบ
  - ไม่มี password, ไม่มี OAuth ใน V0
- **OTP spec**:
  - 6-digit numeric code
  - หมดอายุ 5 นาที
  - ใช้ได้ครั้งเดียว
  - Hash ก่อนเก็บใน DB (SHA-256)
  - Rate limit: สูงสุด 3 OTP requests ต่อ email ต่อ 10 นาที
  - **Verify rate limit**: สูงสุด 5 verify attempts ต่อ email ต่อ 15 นาที (ป้องกัน brute-force)
- **Session**: HTTP-only, Secure, SameSite cookie, อายุ 30 วัน
- **Email service**: Resend (หรือ Postmark/SendGrid) – เลือกตัวที่ setup ง่ายที่สุด

#### (3) Subscription & Billing (Stripe)

**Stripe setup:**

- 3 Products + 3 Prices (monthly recurring): Starter, Pro, Scale
- ใช้ Stripe Checkout (hosted) – ไม่ต้อง build form เอง

**Flow:**

```
Pricing page → กด "Get Started" บน plan ที่ต้องการ
  → ถ้ายังไม่ login → ไป /auth ก่อน → กลับมา
  → Backend สร้าง Stripe Checkout Session (plan ตามที่เลือก)
  → Redirect ไป Stripe Checkout page
  → จ่ายเงินสำเร็จ → Stripe redirect กลับ /dashboard
  → Stripe ส่ง webhook มา backend
```

**Webhook handling:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | สร้าง/อัปเดต subscription ใน DB → trigger async job: create Railway instance |
| `customer.subscription.updated` | อัปเดต plan/status ใน DB |
| `customer.subscription.deleted` | Mark subscription = canceled, instance = suspended (ยังไม่ auto-shutdown ใน V0) |

**Webhook safety:**

- Verify Stripe signature ทุก request
- Idempotent handling – duplicate webhook ไม่สร้าง duplicate records

#### (4) Instance Provisioning (Railway + OpenClaw)

**Railway template:**

- Fork OpenClaw Docker image เป็น repo ของเราเอง (pin version)
- Environment vars default: `OPENCLAW_GATEWAY_TOKEN`, model API keys, etc. (ทั้งหมดจาก environment secrets, ห้าม hardcode ใน code)

**Provisioning flow** (trigger หลัง `checkout.session.completed`):

```
1. ตรวจ user จาก email/metadata ใน webhook payload
2. สร้าง row `instances` → status = 'pending'
3. Spawn background async task (Bun long-running server):
   - Call Railway GraphQL API:
     - serviceCreate ใน project ที่เตรียมไว้ → ใช้ repo template
     - Set env vars: USER_ID, INSTANCE_ID, PRISM_BASE_URL, PRISM_API_KEY, etc.
   - Poll Railway API ทุก 10 วินาที (สูงสุด 6 ครั้ง = 60 วินาที)
4. ถ้า deploy success:
   - ดึง domain (e.g. https://xxx.up.railway.app)
   - Update instances: url = domain, status = 'ready'
5. ถ้า fail/timeout:
   - status = 'error', เก็บ error_message
   - (Optional) alert ทีมผ่าน Discord/email
```

**Background Job Architecture (V0):**

เนื่องจาก Bun + Elysia ทำงานเป็น long-running server (ไม่ใช่ serverless request-based):

- **Async provisioning**: ใช้ `async` function ที่ fire-and-forget จาก webhook handler. Webhook handler return 200 ทันที แล้ว provisioning ทำ background.
- **In-memory job tracking**: V0 ใช้ in-memory Map ติดตาม active provisioning jobs. ถ้า server restart ระหว่าง provision → instance ค้าง 'pending' → แก้มือ (acceptable สำหรับ V0).
- **Phase 1 upgrade path**: ย้ายไปใช้ persistent job queue (BullMQ + Redis, หรือ pg-boss + Postgres) เพื่อรองรับ server restart, retry, และ scheduled jobs.

**Retry logic:** สูงสุด 3 retries สำหรับ transient Railway API errors (exponential backoff)

**ยังไม่ทำ:** multi-project distribution, health-check advance, auto-restart

#### (5) User Dashboard

หลัง login, หน้า `/dashboard` แสดง:

**Section: Subscription**

- Plan name (Starter / Pro / Scale)
- Status (active / canceled / past_due)
- Link ไป Stripe Customer Portal (optional ใน V0)

**Section: Instance**

| สถานะ | UI แสดง |
|--------|---------|
| ไม่มี instance | "No instance yet. Subscribe to create your OpenClaw." + CTA ไปหน้า pricing |
| `pending` | Spinner + "We're spinning up your OpenClaw instance..." |
| `ready` | URL + ปุ่ม **Open Setup** (`/setup`) + ปุ่ม **Open Console** (UI หลัก) เปิด tab ใหม่ |
| `error` | "We couldn't create your instance. Please contact support." + error detail (ถ้ามี) |
| `suspended` | "Your subscription has been canceled. Instance is suspended." |

**Actions (V0):**

- ไม่มี restart/stop instance ผ่าน UI
- แค่แสดงสถานะ + ลิงก์

#### (6) Tech Stack

| Layer | Technology | หมายเหตุ |
|-------|-----------|----------|
| Runtime | **Bun** | JavaScript runtime with built-in package manager, workspace support |
| Frontend | **SvelteKit** | Dashboard, landing page, auth UI. Deploy → Vercel หรือ Cloudflare Pages |
| Backend API | **Elysia** (TypeScript) | REST API, webhooks, provisioning logic. Deploy → Railway หรือ Fly.io |
| Database | **PostgreSQL** (Neon) | Serverless Postgres, auto-scaling, branching support |
| ORM | **Drizzle** | Type-safe SQL query builder, schema-first migrations |
| Billing | **Stripe** Checkout + Webhooks | Hosted checkout, ไม่ต้อง build form |
| Instance hosting | **Railway** | Deploy OpenClaw via GraphQL API |
| Email (OTP) | **Resend** (หรือ Postmark) | Transactional email สำหรับ OTP |
| LLM gateway | **Prism** (internal LLM gateway/router) | รวมทุก LLM provider ไว้จุดเดียว, เตรียมไว้สำหรับ usage billing |
| Error tracking | **Sentry** | Error/exception tracking + performance monitoring ทั้ง frontend (SvelteKit) และ backend (Elysia) |
| Product analytics | **PostHog** | Conversion funnel, user behavior, feature flags, session replay |

**Monorepo Structure (Bun Workspaces):**

```
sparkclaw/
├── package.json              # root workspace config
├── bun.lock
├── packages/
│   ├── web/                  # SvelteKit frontend
│   │   ├── package.json
│   │   ├── svelte.config.js
│   │   └── src/
│   │       ├── routes/       # pages: /, /auth, /dashboard, /pricing
│   │       └── lib/          # shared components, stores
│   ├── api/                  # Elysia backend
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts      # Elysia app entry
│   │       ├── routes/       # auth, checkout, webhook, instance
│   │       ├── services/     # otp, stripe, railway, session
│   │       └── middleware/   # auth guard, CSRF
│   └── shared/               # Shared types, schemas, constants
│       ├── package.json
│       └── src/
│           ├── types.ts      # User, Subscription, Instance types
│           ├── schemas.ts    # Zod validation schemas
│           ├── db/
│           │   ├── schema.ts # Drizzle table definitions
│           │   └── index.ts  # Drizzle client + connection
│           └── constants.ts  # Plan names, status enums
```

**Deployment:**

| Package | Deploy Target | หมายเหตุ |
|---------|--------------|----------|
| `packages/web` | Vercel (หรือ CF Pages) | SvelteKit adapter-auto, SSR + static |
| `packages/api` | Railway (หรือ Fly.io) | Bun runtime, long-running server |
| `packages/shared` | ไม่ deploy | ใช้ internal import `@sparkclaw/shared` |

**Import Convention:**

```ts
// ใน packages/web หรือ packages/api
import { type User } from "@sparkclaw/shared/types";
import { userSchema } from "@sparkclaw/shared/schemas";
import { db, users } from "@sparkclaw/shared/db";
```

---

### 3.2 Out of Scope (V0)

- Token/usage billing (wallet, top-up, overage)
- Multiple instances per user
- Analytics (conversation stats / charts)
- Advanced admin panel / multi-project management
- Upgrade/downgrade orchestration (นอกจาก Stripe subscription status)
- Self-service domain mapping / custom domain
- Multi-language UI (ใช้ EN อย่างเดียว)
- Free trial / free tier
- OAuth login (GitHub, Google)
- Instance restart/stop/config ผ่าน UI
- Backup/restore
- Multi-region deployment

---

## 4. User Flows

### Flow 1: New User – Signup → Subscribe → Get Instance

```
 1. User เข้า sparkclaw.com → เห็น landing page
 2. กด "Get Started" หรือเลือก plan จาก pricing section
 3. Redirect ไป /auth → กรอก email
 4. กด "Send Code" → system สร้าง OTP 6 หลัก, ส่งไปอีเมล
 5. User เปิดอีเมล, copy code กลับมากรอก
 6. System verify OTP → สร้าง user record + session → redirect ไป /dashboard
 7. Dashboard แสดง empty state → กด "Choose a Plan"
 8. เลือก plan → backend สร้าง Stripe Checkout Session → redirect ไป Stripe
 9. User กรอกบัตร + จ่ายเงิน
10. Stripe redirect กลับ /dashboard → เห็น "Spinning up your instance..."
11. (Background) Stripe webhook → สร้าง subscription + trigger Railway provisioning
12. Railway deploy สำเร็จ (1–3 นาที) → instance URL พร้อม
13. User refresh dashboard → เห็น "Your instance is ready!" + URL
14. กด "Open Setup" → เข้า OpenClaw setup wizard ที่ instance
```

### Flow 2: Returning User – Login

```
1. User เข้า /auth → กรอก email เดิม
2. ระบบส่ง OTP → user verify
3. Redirect ไป /dashboard → เห็นสถานะ instance (running/error/suspended)
```

### Flow 3: Provisioning Failure

```
1. Stripe webhook สำเร็จ, จ่ายเงินแล้ว
2. Railway API call fail (API error, resource limit, timeout)
3. Retry สูงสุด 3 ครั้ง → ยัง fail
4. Instance status = 'error' + เก็บ error_message
5. Dashboard แสดง "Provisioning failed. Contact support."
6. (Optional) Alert ทีมผ่าน Discord/email
7. ทีม manual resolve → trigger retry → instance พร้อม
```

### Flow 4: Subscription Canceled

```
1. User cancel subscription ผ่าน Stripe Customer Portal (หรือ Stripe dashboard)
2. Stripe ส่ง webhook: customer.subscription.deleted
3. System อัปเดต subscription status = 'canceled'
4. Instance status = 'suspended'
5. Dashboard แสดง "Subscription canceled. Instance suspended."
6. (V0 ยังไม่ auto-shutdown instance บน Railway – ทำมือ)
```

---

## 5. Functional Requirements

### FR1 – Authentication (Email OTP)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | User สามารถกรอก email แล้วได้รับ OTP 6 หลักทางอีเมล | P0 |
| FR1.2 | OTP หมดอายุใน 5 นาที, ใช้ได้ครั้งเดียว, hash ก่อนเก็บ | P0 |
| FR1.3 | Verify OTP สำเร็จ → สร้าง user record (ถ้าใหม่) + session | P0 |
| FR1.4 | Session เป็น HTTP-only Secure cookie, อายุ 30 วัน | P0 |
| FR1.5 | Rate limit: สูงสุด 3 OTP requests ต่อ email ต่อ 10 นาที | P1 |
| FR1.6 | Rate limit verify: สูงสุด 5 verify attempts ต่อ email ต่อ 15 นาที (ป้องกัน brute-force 6 หลัก) | P0 |
| FR1.7 | Logout → clear session, redirect ไป landing | P1 |

### FR2 – Subscribe via Stripe

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | User เลือก plan → backend สร้าง Stripe Checkout Session → redirect | P0 |
| FR2.2 | Stripe Checkout แสดง plan name, price, billing period | P0 |
| FR2.3 | Webhook `checkout.session.completed` → สร้าง subscription record + trigger provisioning | P0 |
| FR2.4 | Webhook signature verification ทุก request | P0 |
| FR2.5 | Idempotent webhook handling (duplicate ไม่สร้าง duplicate) | P0 |
| FR2.6 | Payment success redirect กลับ /dashboard พร้อมแสดงสถานะ | P0 |

### FR3 – Provision OpenClaw Instance on Railway

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | หลัง payment สำเร็จ → Call Railway API สร้าง service ใน ≤ 5 วินาที | P0 |
| FR3.2 | ใช้ OpenClaw template เดียวกันทุก instance (pinned version) | P0 |
| FR3.3 | Track status: pending → ready / error | P0 |
| FR3.4 | เมื่อ deploy สำเร็จ → เก็บ instance URL | P0 |
| FR3.5 | Deploy fail → status = error + เก็บ error_message | P0 |
| FR3.6 | Retry สูงสุด 3 ครั้ง สำหรับ transient errors | P1 |

### FR4 – Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | /dashboard เป็น protected route (ต้อง login) | P0 |
| FR4.2 | แสดง subscription info: plan name, status | P0 |
| FR4.3 | แสดง instance status + URL (ถ้า ready) | P0 |
| FR4.4 | Empty state: ยังไม่มี subscription → CTA เลือก plan | P0 |
| FR4.5 | ปุ่ม "Open Setup" / "Open Console" เปิด instance ใน tab ใหม่ | P0 |
| FR4.6 | Error state: แสดงข้อความติดต่อ support | P1 |

### FR5 – Error Handling & Support

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | Provisioning fail → notify user บน dashboard | P0 |
| FR5.2 | (Optional) Provisioning fail → alert ทีมผ่าน Discord/email webhook | P1 |
| FR5.3 | ทุก API error → structured log (สำหรับ debug) | P1 |

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Landing page load (LCP) | < 2 วินาที |
| API response (read) | < 200ms (p95) |
| API response (write) | < 500ms (p95) |
| OTP delivery | < 30 วินาที (p95) |
| Instance provisioning | < 5 นาที (p95) |

### Security

| Requirement | Implementation |
|-------------|----------------|
| Transport | HTTPS ทุกที่ |
| OTP storage | SHA-256 hash, ไม่เก็บ plaintext |
| Session cookie | HTTP-only, Secure, SameSite=Lax |
| CSRF protection | SameSite=Lax cookie + Origin header validation สำหรับทุก POST endpoint. Webhook endpoints (/api/webhook/*) exempt จาก CSRF check เพราะใช้ signature verification แทน |
| Input validation | Zod schemas สำหรับทุก API input |
| Secrets | เก็บใน environment variables (ไม่ hardcode ใน code) |
| Webhook verification | Stripe signature + (ถ้ามี) Railway webhook secret |
| Client exposure | ไม่ expose Railway token, internal IDs, หรือ Stripe secret key ฝั่ง client |

### Availability

- API (Elysia) deploy บน Railway/Fly.io → auto-restart, health check
- Frontend (SvelteKit) deploy บน Vercel/CF Pages → globally distributed CDN
- Database: Neon Postgres → serverless auto-scale, built-in connection pooling
- Railway ใช้ paid plan สำหรับ OpenClaw instances
- ไม่มี SLA แข็งใน V0 แต่ target uptime 99.5%

---

## 7. Data Model (PostgreSQL via Neon + Drizzle ORM)

### ER Overview

```
users 1──1 subscriptions 1──1 instances
  │
  │ 1──N otp_codes
  │ 1──N sessions
```

**V0 Relationship Constraints:**

- **users ↔ subscriptions**: 1:1 (UNIQUE on `user_id`). User มี subscription ได้แค่ 1 รายการ.
- **subscriptions ↔ instances**: 1:1 (UNIQUE on `subscription_id` ใน instances table). แต่ละ subscription ผูกกับ 1 instance เท่านั้น.
- **Re-subscribe behavior**: ถ้า user cancel แล้วสมัครใหม่ → สร้าง subscription row ใหม่ + instance ใหม่. Row เก่า mark เป็น `canceled`/`suspended` (ไม่ลบ, เพื่อ audit trail). ข้อมูลใน instance เดิมจะถูกเก็บไว้ 30 วัน grace period ก่อนลบ.

### Table: `users`

| Column | Type | Constraint |
|--------|------|------------|
| `id` | UUID | PRIMARY KEY (UUIDv7) |
| `email` | VARCHAR(255) | UNIQUE NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

### Table: `otp_codes`

| Column | Type | Constraint |
|--------|------|------------|
| `id` | UUID | PRIMARY KEY (UUIDv7) |
| `email` | VARCHAR(255) | NOT NULL |
| `code_hash` | VARCHAR(64) | NOT NULL (SHA-256) |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `used_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

Index: `email`, `expires_at`

### Table: `sessions`

| Column | Type | Constraint |
|--------|------|------------|
| `id` | UUID | PRIMARY KEY (UUIDv7) |
| `user_id` | UUID | NOT NULL → FK users(id) |
| `token` | VARCHAR(255) | UNIQUE NOT NULL |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

Index: `token`, `user_id`

### Table: `subscriptions`

| Column | Type | Constraint |
|--------|------|------------|
| `id` | UUID | PRIMARY KEY (UUIDv7) |
| `user_id` | UUID | NOT NULL UNIQUE → FK users(id) |
| `plan` | VARCHAR(20) | NOT NULL ('starter' / 'pro' / 'scale') |
| `stripe_customer_id` | VARCHAR(255) | NOT NULL |
| `stripe_subscription_id` | VARCHAR(255) | UNIQUE NOT NULL |
| `status` | VARCHAR(20) | NOT NULL ('active' / 'canceled' / 'past_due') |
| `current_period_end` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

Index: `user_id`, `stripe_customer_id`, `stripe_subscription_id`

### Table: `instances`

| Column | Type | Constraint |
|--------|------|------------|
| `id` | UUID | PRIMARY KEY (UUIDv7) |
| `user_id` | UUID | NOT NULL → FK users(id) |
| `subscription_id` | UUID | NOT NULL UNIQUE → FK subscriptions(id) |
| `railway_project_id` | VARCHAR(255) | NOT NULL (fixed ใน V0) |
| `railway_service_id` | VARCHAR(255) | NULL |
| `url` | TEXT | NULL |
| `status` | VARCHAR(20) | NOT NULL ('pending' / 'ready' / 'error' / 'suspended') |
| `error_message` | TEXT | NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

Index: `user_id`, `subscription_id`, `status`

---

## 8. API Routes

### Route Map

```
Public
  GET  /                        Landing page
  GET  /pricing                  Pricing page

Auth
  GET  /auth                     Auth page (email input + OTP verify)
  POST /auth/send-otp            Send OTP to email
  POST /auth/verify-otp          Verify OTP → create session
  POST /auth/logout              Clear session → redirect /

Protected (require session)
  GET  /dashboard                Dashboard page
  GET  /api/me                   Current user info
  GET  /api/instance             Instance details
  POST /api/checkout             Create Stripe Checkout Session

Webhooks (public, signature-verified)
  POST /api/webhook/stripe       Stripe event handler
```

### Endpoint Detail

#### `GET /api/me`

```
Success:
  200 {
    "id": "usr_xxx",
    "email": "user@example.com",
    "subscription": {
      "id": "sub_xxx",
      "plan": "pro",
      "status": "active",
      "currentPeriodEnd": "2026-04-07T00:00:00Z"
    } | null,
    "createdAt": "2026-03-07T10:00:00Z"
  }

Errors: 401 (not authenticated)
```

> `subscription` เป็น null ถ้า user ยังไม่ได้ subscribe. ใช้สำหรับ frontend routing: ถ้า null → แสดง CTA เลือก plan.

#### `POST /auth/send-otp`

```
Request:  { "email": "user@example.com" }
Success:  200 { "ok": true }
Errors:   400 (invalid email), 429 (rate limit)
```

#### `POST /auth/verify-otp`

```
Request:  { "email": "user@example.com", "code": "847291" }
Success:  200 + Set-Cookie (session token) + redirect /dashboard
Errors:   400 (invalid format), 401 (wrong/expired code), 429 (verify rate limit: >5 attempts/15min)
```

#### `POST /api/checkout`

```
Request:  { "plan": "pro" }
Success:  200 { "url": "https://checkout.stripe.com/c/pay/cs_xxx" }
Errors:   400 (invalid plan), 401 (not authenticated)
```

#### `GET /api/instance`

```
Success (has instance):
  200 {
    "id": "inst_xxx",
    "status": "ready",
    "url": "https://xxx.up.railway.app",
    "plan": "pro",              // resolved via JOIN instances ← subscriptions
    "subscriptionStatus": "active",
    "createdAt": "2026-03-07T10:30:00Z"
  }

Success (no instance):
  200 { "instance": null }
```

#### `POST /api/webhook/stripe`

```
Headers:  Stripe-Signature: t=xxx,v1=xxx
Body:     Stripe Event JSON
Response: 200 (processed) / 400 (invalid signature)

Handled events:
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
```

---

## 9. Assumptions & Dependencies

### External Dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| Bun runtime | JavaScript runtime + package manager | Low – stable, fast, built-in workspaces |
| Elysia | Backend API framework | Low – type-safe, high performance on Bun |
| SvelteKit | Frontend framework | Low – mature, SSR + static support |
| PostgreSQL (Neon) | Database | Low – serverless Postgres, auto-scale, branching |
| Drizzle ORM | Type-safe database queries | Low – lightweight, schema-first |
| Stripe | Billing & subscription | Low – industry standard |
| Railway | Instance hosting | Medium – API reliability, rate limits |
| Resend (email) | OTP delivery | Low – multiple alternatives |
| OpenClaw (Docker image) | Core product being hosted | Medium – version compat |
| Sentry | Error tracking | Low – industry standard, generous free tier |
| PostHog | Product analytics | Low – self-host option, generous free tier |

### Key Assumptions

1. Railway public API รองรับ programmatic deployment อย่างเสถียร
2. OpenClaw Docker image publicly accessible และ deploy ได้บน Railway
3. Railway instance cost ต่ำกว่า subscription price อย่างมีกำไร
4. Transactional email ส่งถึง inbox ได้ไว (ไม่ตก spam)
5. Railway default region เพียงพอสำหรับ V0
6. Stripe account approved + configured เรียบร้อย

### Secrets (เก็บใน environment variables)

| Secret | ใช้ทำอะไร |
|--------|----------|
| `DATABASE_URL` | Neon Postgres connection string |
| `STRIPE_SECRET_KEY` | Stripe API calls |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signature |
| `RAILWAY_API_TOKEN` | Railway GraphQL API |
| `RESEND_API_KEY` | ส่ง OTP email |
| `SESSION_SECRET` | Sign/verify session tokens |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `POSTHOG_API_KEY` | PostHog product analytics key |

---

## 10. Risk Assessment

### Technical Risks

| Risk | โอกาส | Impact | Mitigation |
|------|--------|--------|------------|
| Railway API rate limit / failure | Medium | High | Retry with exponential backoff (3 ครั้ง), manual fallback, alert ทีม |
| Stripe webhook delivery delay | Low | High | Idempotent handler, Stripe dashboard manual replay, monitor missing webhooks |
| OpenClaw version break | Medium | Medium | Pin specific version, test ก่อน upgrade |
| Neon Postgres cold start | Low | Low | Connection pooling, keep-alive queries |
| OTP email ตก spam | Low | Medium | ใช้ reputable provider (Resend), setup SPF/DKIM |

### Business Risks

| Risk | โอกาส | Impact | Mitigation |
|------|--------|--------|------------|
| Railway pricing change | Medium | High | Monitor costs, prepare migration plan |
| Low conversion | Medium | Medium | Iterate landing page, gather feedback |
| Support burden | Medium | Medium | Clear error states, self-serve dashboard |

---

## 11. Success Metrics

### V0 Launch Criteria (ก่อนเปิด public)

- [ ] End-to-end flow สำเร็จ: signup → pay → instance ready → user เข้า OpenClaw ได้
- [ ] Instance provisioning success rate > 90%
- [ ] Provisioning time < 5 นาที
- [ ] OTP delivery < 30 วินาที
- [ ] ไม่มี critical bug / security hole

### Month 1 Targets

| Metric | Target |
|--------|--------|
| Paying customers | 10–30 |
| MRR | $300–$900 |
| Instance provisioning success rate | > 95% |
| Monthly churn | < 15% |

---

## 12. Milestones (3-Day Sprint)

### Day 1 – Foundation

- สร้าง Bun workspace monorepo (packages/web, packages/api, packages/shared)
- Setup SvelteKit project (packages/web) + Elysia project (packages/api)
- สร้าง Drizzle schema + migrations (users, sessions, otp_codes, subscriptions, instances) ใน packages/shared
- Connect Neon Postgres + run initial migration
- Implement auth flow (Elysia): send OTP, verify OTP, session management
- Auth pages (SvelteKit): email input + OTP verify
- Dashboard blank page (protected route)
- Deploy dev environment (API → Railway, Web → Vercel)

### Day 2 – Billing + Provisioning

- ตั้งค่า Stripe: products, prices, webhook endpoint
- Implement Stripe Checkout flow (create session → redirect → callback)
- Implement webhook handler (checkout.session.completed, subscription events)
- ตั้งค่า Railway template (fork OpenClaw repo, env vars)
- Implement provisioning helper: Railway API call → poll status → save URL
- เชื่อม webhook → async provisioning pipeline (background job)

### Day 3 – UI + Integration + Launch

- ทำ landing page (hero, features, pricing, FAQ) ใน SvelteKit
- ทำ pricing page / section
- Complete dashboard UI (subscription info, instance card, status states)
- เชื่อม flow end-to-end: signup → choose plan → pay → instance created → dashboard shows URL
- Error handling + basic logging
- CSRF protection (Origin header validation)
- Smoke test ทุก flow
- Deploy production

---

## 13. Post-V0 Roadmap

### Phase 1 – Reliability + Basic Mission Control

**โฟกัส:** เสถียร, ดูแลลูกค้าชุดแรก 10-50 คนได้ไม่พังง่าย

| Feature | รายละเอียด |
|---------|-----------|
| **Health & status** | Background job ping instance; show uptime/status + last check ใน dashboard |
| **Auto-heal** | Simple retry ถ้า deploy fail หรือ instance ไม่ตอบ |
| **Admin console** (internal) | Web UI list users/subscriptions/instances + quick actions: re-deploy, suspend, view logs |
| **Manual override** | Mark instance as ready/error ถ้าต้องแก้มือ |
| **Monitoring & alert** | **BetterStack** สำหรับ uptime monitoring + structured logs + incident management. Alert ไป Discord/Slack เวลา instance down หรือ provisioning fail |
| **LLM observability** | **Langfuse** integration ใน Prism: trace token usage, latency, cost per instance/day |
| **Basic control panel** | Instance restart/stop, env vars editor, health status ให้ user จัดการเอง |
| **Mission control view** | Activity timeline ของ provisioning + key events per instance |

### Phase 2 – Usage Billing + LINE Wizard + Templates

**โฟกัส:** เริ่มกิน margin จาก LLM + เปิดทาง non-tech ผ่าน LINE

| Feature | รายละเอียด |
|---------|-----------|
| **Prism usage billing** | Log tokens/calls per instance via Prism, included credits per plan, hard cap |
| **Usage dashboard** | Graph: tokens/day, remaining credit, cost breakdown by model |
| **LINE integration wizard** | Step-by-step 3-4 ขั้นตอน สำหรับเชื่อม LINE OA + Rich Menu builder |
| **Business templates** | 5-10 curated templates (FAQ bot, lead capture, booking bot) |
| **Channel hub** | Connect/disconnect channels with wizard + test chat widget |
| **AI capabilities panel** | Toggle image/music/video/voice gen, model selector |
| **App integrations (Tier 1-2)** | Google Sheets, Calendar, Notion, Slack, Email, SMS |
| **Manual top-up** | "Buy more credits" → Stripe payment link |

### Phase 3 – Mission Control & App Integrations

**โฟกัส:** ขาย ticket ใหญ่ขึ้น (agency, SaaS, SMB)

| Feature | รายละเอียด |
|---------|-----------|
| **Agent dashboard** (ClawControl-style) | List agents per instance, status, quick actions, task/mission board |
| **Human-in-the-loop** | Queue ของ high-impact actions ให้ owner กด approve |
| **App integrations (Tier 3-4)** | Shopify, WooCommerce, Stripe, LINE Pay, HubSpot, Zapier/Make |
| **Multi-workspace / multi-client** | 1 account = หลาย workspace, each with own instance(s), channels, integrations |
| **Community templates** | User submit + review process, premium template marketplace |
| **Team & permissions** | Invite teammate, roles: owner / admin / editor / viewer |

### Phase 4 – Scale & Variants

**โฟกัส:** ทำให้เป็น platform

| Feature | รายละเอียด |
|---------|-----------|
| **Multiple instances/account** | 1 user สร้างหลาย assistant (คนละ brand/project) |
| **Region / infra variant** | แยก project ตาม region, เพิ่ม BYOS mode (ลูกค้ามี Railway/DO เอง) |
| **Version management** | Staging project สำหรับ test OpenClaw version ใหม่, batch rollout, backup/restore |
| **Developer API** | REST API สำหรับ programmatic instance/config management |
| **BYOK (Bring Your Own Key)** | User ใส่ LLM API key ตัวเอง, bypass Prism billing |

---

## Appendix: Implementation Files (V0)

เนื่องจากเป็น greenfield project, ใช้ Bun workspaces monorepo:

```
sparkclaw/
├── package.json                         # Bun workspace root
├── bun.lock
├── tsconfig.json                        # Base TS config
├── packages/
│   ├── shared/                          # @sparkclaw/shared
│   │   ├── package.json
│   │   └── src/
│   │       ├── types.ts                 # User, Subscription, Instance types
│   │       ├── schemas.ts               # Zod validation schemas
│   │       ├── constants.ts             # Plan names, status enums
│   │       └── db/
│   │           ├── schema.ts            # Drizzle table definitions (Postgres)
│   │           ├── index.ts             # Drizzle client + Neon connection
│   │           └── migrate.ts           # Migration runner
│   ├── api/                             # @sparkclaw/api (Elysia)
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                 # Elysia app entry, route registration
│   │       ├── middleware/
│   │       │   ├── auth.ts              # Session verification middleware
│   │       │   └── csrf.ts              # Origin header validation
│   │       ├── routes/
│   │       │   ├── auth.ts              # POST /auth/send-otp, verify-otp, logout
│   │       │   ├── api.ts              # GET /api/me, /api/instance, POST /api/checkout
│   │       │   └── webhooks.ts          # POST /api/webhook/stripe
│   │       ├── services/
│   │       │   ├── otp.ts               # OTP generation, hashing, validation
│   │       │   ├── session.ts           # Session create, verify, delete
│   │       │   ├── stripe.ts            # Stripe checkout, webhook handling
│   │       │   └── railway.ts           # Railway API: create service, poll status
│   │       └── lib/
│   │           ├── email.ts             # Send OTP email via Resend
│   │           └── utils.ts             # UUID, crypto helpers
│   └── web/                             # @sparkclaw/web (SvelteKit)
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       └── src/
│           ├── routes/
│           │   ├── +page.svelte         # Landing page (hero, features, pricing, FAQ)
│           │   ├── auth/
│           │   │   └── +page.svelte     # Auth page (email + OTP input)
│           │   ├── dashboard/
│           │   │   └── +page.svelte     # Dashboard (subscription + instance status)
│           │   └── pricing/
│           │       └── +page.svelte     # Pricing page
│           └── lib/
│               ├── api.ts               # API client (fetch wrapper → Elysia backend)
│               ├── stores/              # Svelte stores (user, subscription)
│               └── components/          # Shared UI components
└── drizzle/
    └── migrations/                      # Drizzle migration files (auto-generated)
```

---

## 14. Prism – LLM Gateway/Router

### Overview

Prism เป็น LLM gateway/router ที่ทีม own เอง (internal service) ทำหน้าที่เป็นชั้นกลางระหว่าง OpenClaw instances กับ LLM providers ทั้งหมด.

### Architecture

```
User → SparkClaw (SvelteKit + Elysia API) → OpenClaw instance (Railway)
                                        ↓
                                   Prism (LLM Gateway)
                                        ↓
                          ┌─────────────┼─────────────┐
                          ↓             ↓             ↓
                       OpenAI      Anthropic    BytePlus/Qwen
                      (GPT-4o)     (Claude)      (Qwen 2.5)
```

### Core Functions

| Function | รายละเอียด |
|----------|-----------|
| **Unified API** | OpenClaw ยิงมา endpoint เดียว, Prism แปลง format + route ไป provider ที่เลือก |
| **Provider abstraction** | เพิ่ม/เปลี่ยน provider ที่ Prism ชั้นเดียว, ทุก instance ใช้ของใหม่ทันที |
| **Usage metering** | Log token count, model, latency per request per instance → basis สำหรับ billing |
| **Cost tracking** | คำนวณ cost per request ตาม provider pricing → รู้ margin จริง |
| **Model routing** | Route ตาม rule (ถูก/เร็ว/ดี): เช่น request สั้นไป model ถูก, request ยาวไป model แรง |
| **Rate limiting** | ป้องกัน abuse, ป้องกัน API bill spike per instance |
| **Failover** | ถ้า provider ล่ม → auto fallback ไป provider สำรอง |

### Phased Rollout

| Phase | Prism Scope |
|-------|-------------|
| **V0** | Pass-through mode: ทุก instance ใช้ `PRISM_BASE_URL` + `PRISM_API_KEY` ใน env, ยังไม่มี per-user metering |
| **Phase 1** | Basic metering via **Langfuse**: log token count, model, latency, cost per instance/day. Langfuse trace → แสดงใน admin console (internal). ช่วยให้เห็น actual cost/margin ก่อนเปิด billing |
| **Phase 2** | Included credits per plan + usage dashboard (powered by Langfuse aggregated data) + hard cap เมื่อหมด |
| **Phase 3** | Top-up credits (Stripe), model selector UI, smart routing rules, Langfuse evaluation/scoring |
| **Phase 4** | BYOK (Bring Your Own Key): user ใส่ key ตัวเอง bypass billing, A/B test models, response caching |

### Pricing Model (Phase 2+)

| Plan | Included Tokens/mo | Overage |
|------|-------------------|---------|
| Starter ($19) | 100k tokens | Hard cap (ไม่ให้ใช้เกิน) |
| Pro ($39) | 500k tokens | Hard cap (Phase 2), pay-per-use (Phase 3) |
| Scale ($79) | 2M tokens | Pay-per-use overage |

### Secrets (เพิ่มจาก V0)

| Secret | ใช้ทำอะไร |
|--------|----------|
| `PRISM_BASE_URL` | Prism gateway endpoint |
| `PRISM_API_KEY` | Authenticate OpenClaw → Prism |

---

## 15. Control Panel

> **V0 Scope:** Control Panel ไม่มีใน V0. Dashboard V0 แสดงเฉพาะ subscription info + instance status/URL. Features ด้านล่างเป็น Phase 1+ roadmap.

### Overview

Control Panel คือ UI ให้ผู้ใช้จัดการ OpenClaw instance ด้วยตัวเอง โดยไม่ต้องเข้า Railway console หรือรอ support.

### Dashboard Layout (Phase 1+)

Sidebar navigation:

```
GENERAL
  🏠 Overview          -- ภาพรวม subscription + instance status
  ⚙️ Control Panel     -- จัดการ instance (restart/stop/redeploy)
  💬 Channels          -- เชื่อมต่อ messaging platforms
  🔑 Environment       -- จัดการ API keys / env vars
  📜 Logs              -- Real-time log viewer
  🧩 Templates         -- Template gallery (Phase 2)
  🤖 AI Capabilities   -- Media gen, model config (Phase 2)
  🔌 Integrations      -- App integrations (Phase 2)

ACCOUNT
  💳 Billing           -- Plan, payment, invoices
  👥 Team              -- Invite members (Phase 3)
  🚪 Log out
```

### Layer 1: Instance Management (Phase 1)

| Feature | รายละเอียด |
|---------|-----------|
| Start / Stop / Restart | กดปุ่มจัดการ instance ได้เอง |
| Redeploy | ดึง template ใหม่ deploy ซ้ำ |
| Health status | Ping + show uptime, last check, response time |
| Resource metrics | RAM, CPU, disk usage (ดึงจาก Railway API) |
| Version management | แสดง OpenClaw version ปัจจุบัน, auto-update toggle |
| Quick info | Plan, region, Railway service ID, created date, last deploy |

### Layer 2: Configuration (Phase 1-2)

| Feature | Phase | รายละเอียด |
|---------|-------|-----------|
| Env vars editor | Phase 1 | CRUD API keys, model config, secrets (masked values) |
| System prompt editor | Phase 2 | แก้ personality/behavior ของ bot |
| Model selector | Phase 2 | เลือก default model (GPT-4o / Claude / Qwen) ผ่าน Prism |
| Knowledge base | Phase 2 | Upload PDF/text สำหรับ RAG |
| Plugin/tool toggle | Phase 2 | เปิด/ปิด built-in tools (web search, code exec, image gen) |

### Layer 3: Monitoring & Logs (Phase 1-2)

| Feature | Phase | รายละเอียด |
|---------|-------|-----------|
| Real-time logs | Phase 1 | Terminal-style log viewer, filter by level (info/warn/error) |
| Conversation history | Phase 2 | ดูข้อความที่ bot รับ-ส่ง per channel |
| Token usage | Phase 2 | Tokens used/day, by model, remaining credits |
| Error alerts | Phase 2 | Email/webhook notify ถ้า instance down |
| Uptime chart | Phase 2 | Uptime % + downtime incidents timeline |

---

## 16. AI Capabilities

> **V0 Scope:** AI Capabilities ใน V0 จำกัดเฉพาะ Text generation ผ่าน Prism (pass-through mode). UI ไม่มี model selector หรือ toggle ใน V0. Features ด้านล่างเป็น Phase 2+ roadmap.

### Overview

OpenClaw รองรับ tool/plugin system. Control panel expose ให้ user เปิด/ปิด + config แต่ละ capability ได้.

### Capabilities Matrix

| Capability | Provider Examples | Phase | Control Panel Features |
|-----------|------------------|-------|----------------------|
| **Text generation** | GPT-4o, Claude, Qwen (via Prism) | V0 | Model selector, temperature, max tokens |
| **Image generation** | DALL-E 3, Flux, Midjourney API | Phase 2 | Toggle on/off, model select, default size/style, gallery |
| **Music generation** | Suno API, Udio | Phase 2 | Toggle on/off, duration limit, playback gallery |
| **Video generation** | Runway, Kling, Pika | Phase 3 | Toggle on/off, resolution/duration cap, preview |
| **Voice / TTS** | ElevenLabs, OpenAI TTS | Phase 2 | Voice selection, language, preview |
| **Document generation** | PDF export, report gen | Phase 3 | Template config, output format |

### Control Panel UX (Phase 2)

```
Control Panel > AI Capabilities
┌─────────────────────────────────────────┐
│ 🤖 AI Capabilities                      │
│                                         │
│ [✅] Text (GPT-4o)          [Configure] │
│ [✅] Image (DALL-E 3)       [Configure] │
│ [  ] Music (Suno)           [Connect]   │
│ [  ] Video (Runway)         [Connect]   │
│ [✅] Voice (ElevenLabs)     [Configure] │
│                                         │
│ Each capability requires an API key     │
│ configured in Environment variables.    │
│                                         │
│ 📊 Usage This Month                     │
│ Text: 142k tokens  Image: 47 images     │
│ Voice: 12 min      Music: 0             │
└─────────────────────────────────────────┘
```

### Additional Features

- **Media Gallery** – ดูรูป/เพลง/วิดีโอที่ bot สร้างย้อนหลัง per instance
- **Usage tracking** – แต่ละ capability ใช้ไปเท่าไหร่ (credits/tokens/units)
- **Safety config** – Content filter level, NSFW block toggle

---

## 17. App Integrations

> **V0 Scope:** ไม่มี App Integrations ใน V0. Section นี้เป็น Phase 2+ roadmap ทั้งหมด.

### Overview

App integrations คือ moat ของ SparkClaw: bot ไม่ได้แค่ตอบคำถาม แต่เชื่อมต่อกับ tools ที่ user ใช้อยู่จริง ทำให้เกิด automation ได้.

### Tier 1: Data & Productivity (Phase 2)

| Integration | ทำอะไรได้ | Use Case |
|------------|----------|----------|
| **Google Sheets** | Bot อ่าน/เขียน Sheet | Lead capture, order log, survey results |
| **Google Calendar** | Bot จอง/ดูนัด | Booking bot, appointment scheduling |
| **Notion** | Bot อ่าน/เขียน pages/DB | Knowledge base sync, task management |
| **Airtable** | Bot CRUD records | CRM, inventory |

### Tier 2: Communication (Phase 2)

| Integration | ทำอะไรได้ | Use Case |
|------------|----------|----------|
| **Slack** | Bot ส่ง alert/summary ไป channel | Internal notification |
| **Discord** | Bot post updates | Community management |
| **Email (Resend/SG)** | Bot ส่ง email ให้ user | Follow-up, receipt, report |
| **SMS (Twilio)** | Bot ส่ง SMS | Appointment reminder |

### Tier 3: Commerce (Phase 3)

| Integration | ทำอะไรได้ | Use Case |
|------------|----------|----------|
| **Shopify** | ดู order, ตอบ customer, track shipping | E-commerce support bot |
| **WooCommerce** | เหมือน Shopify สำหรับ WordPress | WordPress shops |
| **Stripe** | ดู payment status, send payment link | Billing assistant |
| **LINE Pay / PromptPay** | สร้าง QR จ่ายเงิน | Thai market |

### Tier 4: Advanced (Phase 3+)

| Integration | ทำอะไรได้ | Use Case |
|------------|----------|----------|
| **HubSpot / Salesforce** | CRM sync, lead scoring | Sales automation |
| **Zapier / Make** | เชื่อมกับ 5000+ apps | Catch-all for niche tools |
| **Custom webhook** | Bot call any HTTP endpoint | Developer use case |
| **Database (Postgres/MySQL)** | Bot query/write DB | Advanced data bot |

### Integration UX

แต่ละ integration มี:

- **Setup wizard** – step-by-step (OAuth หรือ API key)
- **Permission scope** – read-only / read-write
- **Activity log** – bot เรียก integration กี่ครั้ง, error rate
- **Test connection** – verify ก่อน go live

---

## 18. Template System

> **V0 Scope:** ไม่มี Template System ใน V0. Section นี้เป็น Phase 2+ roadmap ทั้งหมด.

### Overview

Template = pre-configured bot blueprint ที่ user กด deploy ได้เลย ลด time-to-value จาก "hours" เหลือ "minutes". เพิ่ม conversion เพราะคนเห็น use case ตรง pain ตัวเอง.

### Template Composition

```
Template = {
  name: "Email Lead Capture Bot"
  category: "Marketing"
  channels: ["Web Chat", "LINE"]
  integrations: ["Google Sheets", "Resend"]
  system_prompt: "..." (pre-written)
  env_vars: [SHEET_ID, RESEND_KEY] (user เติมเอง)
  tools: ["send_email", "append_sheet"]
  knowledge_base: optional starter docs
  preview_conversation: ตัวอย่าง chat สำหรับ demo
}
```

### Template Categories

| Category | ตัวอย่าง Templates |
|----------|-------------------|
| **Customer Support** | FAQ Bot, Ticket Triage, Return/Refund Handler |
| **Sales & Marketing** | Lead Capture Bot, Product Recommender, Follow-up Emailer |
| **Booking & Scheduling** | Appointment Bot (Calendar), Restaurant Reservation |
| **E-commerce** | Order Status Tracker (Shopify), Product Search, Cart Reminder |
| **Internal Ops** | Daily Standup Bot (Slack), Expense Report (Sheets), Meeting Summary |
| **Notification & Alert** | Error Monitor + Email Alert, Stock Price Alert, New Order Notify |
| **Content & Creative** | Social Post Generator (Image+Text), Blog Draft Writer |
| **Thai Market** | LINE Official Bot + PromptPay, Thai FAQ Bot, Delivery Tracking |

### Deploy Flow

```
Step 1: Browse gallery → เลือก template → ดู preview conversation
Step 2: Connect required integrations (Sheets, Email, etc.)
Step 3: Fill business info (ชื่อร้าน, เบอร์, เวลาเปิด-ปิด)
Step 4: Customize prompt (optional, มี default ให้)
Step 5: Deploy → instance สร้าง + config apply อัตโนมัติ
```

### Phased Rollout

| Phase | Template Scope |
|-------|---------------|
| **Phase 2** | 5-10 official templates ทีมทำเอง (curated, tested) |
| **Phase 3** | Community templates – user submit + review process |
| **Phase 3+** | Template marketplace – ขาย premium templates (revenue share) |

### Design Decisions

- **1 template = 1 instance** ใน Phase 2; apply template ทับ instance เดิมได้ใน Phase 3
- **Template versioning**: User lock version ที่ deploy, opt-in update
- **Landing page integration**: แสดง template gallery บน landing page เพื่อเพิ่ม conversion

---

## 19. LINE Strategy

> **V0 Scope:** ไม่มี LINE-specific features ใน V0. OpenClaw instance รองรับ LINE ได้ (user config เอง) แต่ไม่มี wizard/UI ใน SparkClaw V0. Section นี้เป็น Phase 2+ roadmap.

### Why LINE is First-Class

- ไทย LINE MAU 56M+ (เกือบทั้งประเทศ)
- ธุรกิจไทยส่วนใหญ่ใช้ LINE OA เป็น primary channel
- คู่แข่ง (Botpress, Dify) ไม่มี LINE support ดีๆ → moat สำหรับ Thai/SEA market

### LINE Feature Scope

| Feature | Phase | รายละเอียด |
|---------|-------|-----------|
| LINE Messaging API connect | Phase 2 | Wizard: สร้าง LINE OA → copy Channel Secret/Token → set webhook URL |
| Rich Menu builder | Phase 2 | สร้าง Rich Menu (เมนูล่างใน LINE) จาก UI ไม่ต้องเขียน JSON |
| Flex Message templates | Phase 2-3 | ส่ง carousel, button, confirm กลับ user |
| LINE Pay integration | Phase 3 | Bot สร้าง payment request ใน chat |
| LINE LIFF (mini app) | Phase 3+ | เปิด web form/dashboard ใน LINE app |
| LINE Beacon / Location | Phase 3+ | Trigger bot จาก location/beacon |

### LINE Connect Wizard UX (Phase 2)

```
Step 1: "สร้าง LINE Official Account"
        → ลิงก์ไป LINE Developers + รูปจอแต่ละขั้น
Step 2: "Copy Channel Secret & Access Token"
        → ช่องกรอก 2 ช่อง + ปุ่ม Verify
Step 3: "Set Webhook URL"
        → แสดง URL ให้ copy: https://xxx.up.railway.app/webhook/line
        → ปุ่ม "Test Connection" → แสดง ✓ หรือ ✗
Step 4: "Send test message"
        → QR code สำหรับ add bot เป็นเพื่อน
        → กด "Send Test" → bot ทัก "สวัสดีครับ!"
```

### Thai Market Templates

| Template | Description |
|---------|-------------|
| LINE ร้านอาหาร | เมนู + สั่งอาหาร + PromptPay QR |
| LINE คลินิก/ร้านเสริมสวย | จองคิว + เตือนนัด + ส่งโปร |
| LINE ร้านค้าออนไลน์ | ถามสินค้า + เช็คสต็อก + ติดตามพัสดุ |
| LINE HR Bot | ลาป่วย + เช็ค OT + ประกาศภายใน |
| LINE Customer Support | FAQ + ส่งต่อ agent + เก็บ ticket |

---

## 20. Unit Economics

### Cost Per Instance (V0 Estimate)

| รายการ | ค่าใช้จ่าย/instance/เดือน |
|-------|--------------------------|
| Railway (container + volume) | ~$5-10 |
| `Platform/DB` (shared, amortized) | ~$0 (Neon free tier + Vercel free tier) |
| Resend transactional email | ~$0.01/email |
| Stripe fee (2.9% + $0.30/txn) | ~$0.85-2.59 |
| **Total cost per instance** | **~$6-13** |

### Margin Analysis (V0 – Hosting Only)

| Plan | Price | Est. Cost | Gross Margin |
|------|-------|-----------|-------------|
| Starter ($19) | $19 | ~$7 | ~$12 (63%) |
| Pro ($39) | $39 | ~$9 | ~$30 (77%) |
| Scale ($79) | $79 | ~$11 | ~$68 (86%) |

### Margin Analysis (Phase 2+ – Hosting + LLM via Prism)

| Plan | Hosting Margin | LLM Markup (est. 30% on token cost) | Combined |
|------|---------------|--------------------------------------|----------|
| Starter | ~$12 | ~$3-5 | ~$15-17 |
| Pro | ~$30 | ~$10-20 | ~$40-50 |
| Scale | ~$68 | ~$30-60 | ~$98-128 |

> LLM margin เป็น upside ใหญ่: ยิ่ง user ใช้เยอะ revenue ยิ่งโต

### Key Assumptions

- Railway Hobby plan: ~$5/service/month (shared vCPU, 512MB RAM, 1GB disk). ถ้าใช้ Pro plan จะเป็น ~$10/service.
- Average LLM cost per 1k tokens: ~$0.003-0.01 (blended across models via Prism)
- Prism markup: 20-40% on token cost
- Stripe fee: 2.9% + $0.30 per transaction (Starter = ~$0.85, Pro = ~$1.43, Scale = ~$2.59)

---

## 21. Competitive Positioning

### Comparison Matrix

| | SparkClaw | Self-host OpenClaw | Botpress Cloud | Dify Cloud | Voiceflow |
|---|---|---|---|---|---|
| Engine | OpenClaw (open-source) | OpenClaw | Proprietary | Proprietary | Proprietary |
| Setup time | < 5 min | 1-3 hours | ~10 min | ~10 min | ~15 min |
| 25+ channels | Yes | Yes | Limited | No | No |
| LINE support | First-class (Phase 2) | Manual config | No | No | No |
| Full instance control | Yes (env/config/restart) | Yes | Limited | Limited | No |
| Open-source engine | Yes | Yes | No | Partial | No |
| Usage billing | Credits + top-up | N/A (own cost) | Credits | Credits | Credits |
| Templates | Yes (Phase 2) | No | Yes | Yes | Yes |
| App integrations | Phase 2-3 | DIY | Limited | Limited | Limited |
| Self-host option | Roadmap (BYOS) | N/A | No | Yes | No |
| Starting price | $19/mo | $5-20/mo (VPS) | Free (limited) | Free (limited) | $50/mo |

### SparkClaw Positioning

**"OpenClaw power, zero DevOps."**

- เทียบกับ self-host: ได้ full engine เดียวกัน แต่ไม่ต้อง maintain infra
- เทียบกับ Botpress/Dify/Voiceflow: ได้ open-source engine ที่ dev ทั่วโลกใช้ ไม่ถูก lock-in
- เทียบกับ SaaS chatbot: ได้ agent ที่ทำได้มากกว่า "ตอบคำถาม" (tool use, integrations, multi-channel)
- Thai/SEA differentiator: LINE first-class support + Thai templates

---

## 22. Onboarding & Retention

### First 5 Minutes (Post-Provisioning)

```
Instance ready → Onboarding checklist popup:
  ☐ Set your AI model (GPT-4o / Claude / Qwen)
  ☐ Connect first channel (Telegram recommended for speed)
  ☐ Send a test message to your bot
  ☐ Customize your system prompt
  ☐ (Optional) Upload knowledge docs
```

### Week 1 Engagement

- **Day 1**: Welcome email + quick start guide
- **Day 3**: "Have you connected a channel yet?" nudge (if no channel connected)
- **Day 7**: "Your bot handled X conversations this week" summary

### Retention Hooks (Phase 2+)

| Trigger | Action |
|---------|--------|
| Weekly active | Email: "Your bot handled X conversations, Y tokens used" |
| Usage milestone | "Your bot just hit 1,000 messages!" |
| 7-day inactivity | "Your bot hasn't received messages in 7 days – need help?" |
| Credit running low | "You've used 80% of your monthly credits" |
| New feature/template | "New template available: LINE Customer Support Bot" |

### Churn Prevention

- Grace period: หลัง cancel ยังเข้า dashboard ดู data ได้ 30 วัน
- Win-back: 14 วันหลัง cancel ส่ง email "We miss you – here's what's new"
- Downgrade path: ให้ downgrade ก่อน cancel (Starter $19 แทน cancel เลย)

---

## 23. Security & Data Ownership

### Instance Isolation

| Aspect | Implementation |
|--------|---------------|
| Container isolation | แต่ละ user = แยก Railway service, ไม่ share container |
| Network isolation | Railway service-level network separation |
| Data isolation | แต่ละ instance มี volume `/data` แยก |
| Secrets isolation | Env vars per service, ไม่ share ข้าม instance |

### Data Ownership

| Policy | รายละเอียด |
|--------|-----------|
| Ownership | User เป็นเจ้าของ conversation data, knowledge base, config ทั้งหมด |
| Data export | ดาวน์โหลด conversations, config, knowledge base เป็น JSON/ZIP (Phase 2) |
| Data portability | Export format compatible กับ self-hosted OpenClaw |
| Cancellation grace | หลัง cancel มี 30 วัน grace period ก่อนลบ data |
| Deletion request | รองรับ GDPR/PDPA data deletion request ภายใน 30 วัน |

### Backup & Recovery

| Feature | Phase |
|---------|-------|
| Neon auto-backup (SparkClaw data) | V0 (Neon built-in point-in-time recovery) |
| Instance data daily backup | Phase 1 |
| User-triggered backup/restore | Phase 3 |

### Compliance Considerations

- **GDPR** (EU users): Data processing agreement, right to erasure, data portability
- **PDPA** (Thai users): Consent management, data retention policy, breach notification
- **SOC 2**: Evaluate for Phase 3+ when targeting enterprise/agency

---

## 24. Team & Permissions (Phase 3)

### Role Model

| Role | Permissions |
|------|------------|
| **Owner** | Full access, billing, delete instance, manage team |
| **Admin** | Manage instance, config, integrations, channels |
| **Editor** | Edit prompts, knowledge base, templates |
| **Viewer** | Read dashboard, logs, analytics only |

### Use Cases

- **Agency**: Owner = agency, Viewer = client (ดู dashboard ของ bot ตัวเอง)
- **Team**: Owner = founder, Admin = dev, Editor = content team, Viewer = stakeholder
- **Enterprise**: Multiple admins, granular permission per workspace

### Invite Flow

```
Settings > Team > Invite Member
  → Enter email + select role
  → Invitee receives email with link
  → Accept → join workspace
```

---

## 25. Developer API (Phase 4)

### Overview

REST API สำหรับ dev/agency ที่ต้องการ programmatic access. ทำให้ user build automation บน SparkClaw ได้.

### Endpoints

```
Authentication
  All requests require: Authorization: Bearer <API_KEY>
  API key generated from: Dashboard > Settings > API Keys

Instance
  GET    /api/v1/instance              Instance status + details
  POST   /api/v1/instance/restart      Restart instance
  POST   /api/v1/instance/stop         Stop instance
  POST   /api/v1/instance/redeploy     Trigger redeploy

Configuration
  GET    /api/v1/env                   List env vars (values masked)
  PUT    /api/v1/env                   Update env vars (triggers redeploy)
  GET    /api/v1/config                Get instance config
  PUT    /api/v1/config                Update config

Usage
  GET    /api/v1/usage                 Token usage (current period)
  GET    /api/v1/usage/history         Usage history (daily aggregates)

Conversations
  GET    /api/v1/conversations         List recent conversations
  GET    /api/v1/conversations/:id     Get conversation detail

Messaging
  POST   /api/v1/message               Send message programmatically
```

### Rate Limits

| Plan | Requests/min |
|------|-------------|
| Starter | 60 |
| Pro | 120 |
| Scale | 300 |
