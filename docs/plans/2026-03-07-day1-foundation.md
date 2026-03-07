# Day 1 – Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up SparkClaw project from scratch — Cloudflare Workers + Hono + D1 + Email OTP auth + session management + protected dashboard route.

**Architecture:** Single Hono app on Cloudflare Workers. D1 (SQLite) for persistence. Email OTP passwordless auth with SHA-256 hashed codes. HTTP-only secure cookie sessions. All HTML rendered server-side via Hono's `c.html()`.

**Tech Stack:** Hono, Cloudflare Workers, D1, Resend (email), TypeScript, Wrangler CLI, Zod (validation)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `src/index.ts`

**Step 1: Initialize project with wrangler**

```bash
cd /Users/wora/Coding/WiseSpark/SparkClaw
npm create cloudflare@latest . -- --type web-framework --framework hono --lang ts --deploy false
```

If the interactive scaffold doesn't work cleanly, fall back to manual init:

```bash
npm init -y
npm install hono
npm install -D wrangler typescript @cloudflare/workers-types
```

**Step 2: Configure wrangler.toml**

```toml
name = "sparkclaw"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "sparkclaw-db"
database_id = "LOCAL_PLACEHOLDER"
migrations_dir = "migrations"
```

> Note: `database_id` will be replaced after `wrangler d1 create sparkclaw-db`. For local dev, wrangler uses a local SQLite file automatically.

**Step 3: Configure tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create minimal Hono entry**

```typescript
// src/index.ts
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  RESEND_API_KEY: string
  SESSION_SECRET: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RAILWAY_API_TOKEN: string
}

export type App = { Bindings: Bindings }

const app = new Hono<App>()

app.get('/', (c) => c.text('SparkClaw is running'))

export default app
```

**Step 5: Verify it runs**

```bash
npx wrangler dev
# Open http://localhost:8787 → should see "SparkClaw is running"
# Ctrl+C to stop
```

**Step 6: Commit**

```bash
git init
echo "node_modules/\ndist/\n.wrangler/\n.dev.vars" > .gitignore
git add .
git commit -m "feat: scaffold Hono + Cloudflare Workers project"
```

---

### Task 2: D1 Schema & Migration

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `src/db/queries.ts`

**Step 1: Create migration file**

```sql
-- migrations/0001_initial.sql

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OTP codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_expires ON otp_codes(email, expires_at);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  plan TEXT NOT NULL CHECK(plan IN ('starter', 'pro', 'scale')),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'canceled', 'past_due')),
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- Instances
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  railway_project_id TEXT NOT NULL,
  railway_service_id TEXT,
  url TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'ready', 'error', 'suspended')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_instances_user_id ON instances(user_id);
CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
```

**Step 2: Apply migration locally**

```bash
npx wrangler d1 migrations apply sparkclaw-db --local
```

**Step 3: Create DB query helpers**

```typescript
// src/db/queries.ts

export function generateId(): string {
  return crypto.randomUUID()
}

// --- Users ---
export async function getUserByEmail(db: D1Database, email: string) {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
}

export async function getUserById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
}

export async function createUser(db: D1Database, email: string) {
  const id = generateId()
  await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email).run()
  return { id, email }
}

// --- OTP ---
export async function createOtp(db: D1Database, email: string, codeHash: string, expiresAt: string) {
  const id = generateId()
  await db.prepare(
    'INSERT INTO otp_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, email, codeHash, expiresAt).run()
  return id
}

export async function getValidOtp(db: D1Database, email: string, codeHash: string) {
  return db.prepare(
    `SELECT * FROM otp_codes
     WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`
  ).bind(email, codeHash).first()
}

export async function markOtpUsed(db: D1Database, id: string) {
  await db.prepare(
    "UPDATE otp_codes SET used_at = datetime('now') WHERE id = ?"
  ).bind(id).run()
}

export async function countRecentOtps(db: D1Database, email: string) {
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM otp_codes
     WHERE email = ? AND created_at > datetime('now', '-10 minutes')`
  ).bind(email).first<{ count: number }>()
  return result?.count ?? 0
}

// --- Sessions ---
export async function createSession(db: D1Database, userId: string, token: string, expiresAt: string) {
  const id = generateId()
  await db.prepare(
    'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, token, expiresAt).run()
  return { id, token }
}

export async function getSessionByToken(db: D1Database, token: string) {
  return db.prepare(
    `SELECT s.*, u.email FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first()
}

export async function deleteSession(db: D1Database, token: string) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
}

// --- Subscriptions ---
export async function getSubscriptionByUserId(db: D1Database, userId: string) {
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').bind(userId).first()
}

// --- Instances ---
export async function getInstanceByUserId(db: D1Database, userId: string) {
  return db.prepare('SELECT * FROM instances WHERE user_id = ?').bind(userId).first()
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add D1 schema migration and DB query helpers"
```

---

### Task 3: Utility Helpers (crypto, email)

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/lib/email.ts`

**Step 1: Create crypto/utility helpers**

```typescript
// src/lib/utils.ts

export function generateOtpCode(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1000000).padStart(6, '0')
}

export async function hashSha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

export function addDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
```

**Step 2: Create email helper (Resend)**

```typescript
// src/lib/email.ts

export async function sendOtpEmail(apiKey: string, to: string, code: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SparkClaw <noreply@sparkclaw.com>',
      to: [to],
      subject: 'Your SparkClaw login code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Your login code</h2>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 24px 0;">
            ${code}
          </p>
          <p style="color: #666; font-size: 14px;">
            This code expires in 5 minutes. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    }),
  })
  return res.ok
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add crypto utilities and Resend email helper"
```

---

### Task 4: OTP & Session Services

**Files:**
- Create: `src/services/otp.ts`
- Create: `src/services/session.ts`

**Step 1: Create OTP service**

```typescript
// src/services/otp.ts

import { createOtp, getValidOtp, markOtpUsed, countRecentOtps } from '../db/queries'
import { generateOtpCode, hashSha256, addMinutes } from '../lib/utils'
import { sendOtpEmail } from '../lib/email'

const OTP_EXPIRY_MINUTES = 5
const OTP_RATE_LIMIT = 3

export async function sendOtp(db: D1Database, resendApiKey: string, email: string) {
  // Rate limit check
  const recentCount = await countRecentOtps(db, email)
  if (recentCount >= OTP_RATE_LIMIT) {
    return { ok: false, error: 'rate_limit' } as const
  }

  const code = generateOtpCode()
  const codeHash = await hashSha256(code)
  const expiresAt = addMinutes(OTP_EXPIRY_MINUTES)

  await createOtp(db, email, codeHash, expiresAt)

  const sent = await sendOtpEmail(resendApiKey, email, code)
  if (!sent) {
    return { ok: false, error: 'email_failed' } as const
  }

  return { ok: true } as const
}

export async function verifyOtp(db: D1Database, email: string, code: string) {
  const codeHash = await hashSha256(code)
  const otp = await getValidOtp(db, email, codeHash)

  if (!otp) {
    return { ok: false, error: 'invalid_code' } as const
  }

  await markOtpUsed(db, otp.id as string)
  return { ok: true } as const
}
```

**Step 2: Create session service**

```typescript
// src/services/session.ts

import { createSession, getSessionByToken, deleteSession, getUserByEmail, createUser } from '../db/queries'
import { generateSessionToken, addDays } from '../lib/utils'

const SESSION_EXPIRY_DAYS = 30
const COOKIE_NAME = 'session'

export async function createUserSession(db: D1Database, email: string) {
  // Get or create user
  let user = await getUserByEmail(db, email)
  if (!user) {
    user = await createUser(db, email)
  }

  const token = generateSessionToken()
  const expiresAt = addDays(SESSION_EXPIRY_DAYS)
  await createSession(db, user.id as string, token, expiresAt)

  return { token, expiresAt }
}

export function sessionCookie(token: string, expiresAt: string): string {
  const expires = new Date(expiresAt).toUTCString()
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function getSession(db: D1Database, cookieHeader: string | undefined) {
  if (!cookieHeader) return null

  const match = cookieHeader.match(/(?:^|;\s*)session=([^\s;]+)/)
  if (!match) return null

  return getSessionByToken(db, match[1])
}

export async function destroySession(db: D1Database, cookieHeader: string | undefined) {
  if (!cookieHeader) return
  const match = cookieHeader.match(/(?:^|;\s*)session=([^\s;]+)/)
  if (match) {
    await deleteSession(db, match[1])
  }
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add OTP and session services"
```

---

### Task 5: Auth Middleware

**Files:**
- Create: `src/middleware/auth.ts`

**Step 1: Create auth middleware**

```typescript
// src/middleware/auth.ts

import { createMiddleware } from 'hono/factory'
import { getSession } from '../services/session'
import type { App } from '../index'

type AuthEnv = App & {
  Variables: {
    userId: string
    userEmail: string
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const cookie = c.req.header('cookie')
  const session = await getSession(c.env.DB, cookie)

  if (!session) {
    return c.redirect('/auth')
  }

  c.set('userId', session.user_id as string)
  c.set('userEmail', session.email as string)
  await next()
})
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add auth middleware for protected routes"
```

---

### Task 6: Auth Routes

**Files:**
- Create: `src/routes/auth.ts`

**Step 1: Create auth routes with Zod validation**

```bash
npm install zod
```

```typescript
// src/routes/auth.ts

import { Hono } from 'hono'
import { z } from 'zod'
import type { App } from '../index'
import { sendOtp, verifyOtp } from '../services/otp'
import { createUserSession, sessionCookie, clearSessionCookie, destroySession } from '../services/session'

const emailSchema = z.object({ email: z.string().email() })
const verifySchema = z.object({ email: z.string().email(), code: z.string().length(6).regex(/^\d+$/) })

const auth = new Hono<App>()

// Send OTP
auth.post('/send-otp', async (c) => {
  const body = await c.req.json()
  const parsed = emailSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Invalid email' }, 400)
  }

  const result = await sendOtp(c.env.DB, c.env.RESEND_API_KEY, parsed.data.email)

  if (!result.ok) {
    if (result.error === 'rate_limit') {
      return c.json({ ok: false, error: 'Too many requests. Try again later.' }, 429)
    }
    return c.json({ ok: false, error: 'Failed to send code.' }, 500)
  }

  return c.json({ ok: true })
})

// Verify OTP
auth.post('/verify-otp', async (c) => {
  const body = await c.req.json()
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Invalid input' }, 400)
  }

  const result = await verifyOtp(c.env.DB, parsed.data.email, parsed.data.code)
  if (!result.ok) {
    return c.json({ ok: false, error: 'Invalid or expired code.' }, 401)
  }

  const session = await createUserSession(c.env.DB, parsed.data.email)
  c.header('Set-Cookie', sessionCookie(session.token, session.expiresAt))
  return c.json({ ok: true, redirect: '/dashboard' })
})

// Logout
auth.post('/logout', async (c) => {
  await destroySession(c.env.DB, c.req.header('cookie'))
  c.header('Set-Cookie', clearSessionCookie())
  return c.redirect('/')
})

export { auth }
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add auth routes (send-otp, verify-otp, logout)"
```

---

### Task 7: Page Routes (HTML)

**Files:**
- Create: `src/routes/pages.ts`

**Step 1: Create HTML page routes**

This task creates server-rendered HTML pages for: landing (`/`), auth (`/auth`), and dashboard (`/dashboard`).

```typescript
// src/routes/pages.ts

import { Hono } from 'hono'
import { html } from 'hono/html'
import type { App } from '../index'
import { requireAuth } from '../middleware/auth'
import { getSubscriptionByUserId, getInstanceByUserId } from '../db/queries'

type AuthApp = App & { Variables: { userId: string; userEmail: string } }

const pages = new Hono<AuthApp>()

// Shared layout
const layout = (title: string, body: string) => html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} – SparkClaw</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .btn { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #1d4ed8; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 1.5rem; }
    input { padding: 0.75rem 1rem; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; font-size: 1rem; width: 100%; }
    input:focus { outline: none; border-color: #3b82f6; }
    .error { color: #ef4444; font-size: 0.875rem; margin-top: 0.5rem; }
    .success { color: #22c55e; font-size: 0.875rem; margin-top: 0.5rem; }
    .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid #333; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">${body}</div>
</body>
</html>
`

// Landing page
pages.get('/', (c) => {
  return c.html(layout('Launch Your AI Assistant', `
    <header style="text-align: center; padding: 4rem 0 2rem;">
      <h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 1rem;">
        <span style="color: #3b82f6;">Spark</span>Claw
      </h1>
      <p style="font-size: 1.25rem; color: #999; max-width: 500px; margin: 0 auto 2rem;">
        Launch your own OpenClaw AI assistant in minutes. We host it for you.
      </p>
      <a href="/auth" class="btn" style="font-size: 1.125rem; padding: 1rem 2rem;">Get Started</a>
    </header>

    <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin: 3rem 0;">
      <div class="card">
        <h3 style="margin-bottom: 0.5rem;">Zero DevOps</h3>
        <p style="color: #999; font-size: 0.875rem;">No servers, no Docker, no Railway config. We handle everything.</p>
      </div>
      <div class="card">
        <h3 style="margin-bottom: 0.5rem;">Instant Setup</h3>
        <p style="color: #999; font-size: 0.875rem;">From signup to a running instance in under 5 minutes.</p>
      </div>
      <div class="card">
        <h3 style="margin-bottom: 0.5rem;">25+ Channels</h3>
        <p style="color: #999; font-size: 0.875rem;">Telegram, Discord, Slack, LINE, WhatsApp and more.</p>
      </div>
      <div class="card">
        <h3 style="margin-bottom: 0.5rem;">Predictable Pricing</h3>
        <p style="color: #999; font-size: 0.875rem;">Simple monthly plans. No surprise costs.</p>
      </div>
    </section>

    <section id="pricing" style="margin: 4rem 0;">
      <h2 style="text-align: center; margin-bottom: 2rem;">Pricing</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
        <div class="card" style="text-align: center;">
          <h3>Starter</h3>
          <p style="font-size: 2rem; font-weight: 700; margin: 1rem 0;">$19<span style="font-size: 1rem; color: #999;">/mo</span></p>
          <p style="color: #999; margin-bottom: 1.5rem;">Perfect for personal projects</p>
          <a href="/auth?plan=starter" class="btn" style="width: 100%;">Get Started</a>
        </div>
        <div class="card" style="text-align: center; border-color: #3b82f6;">
          <h3>Pro</h3>
          <p style="font-size: 2rem; font-weight: 700; margin: 1rem 0;">$39<span style="font-size: 1rem; color: #999;">/mo</span></p>
          <p style="color: #999; margin-bottom: 1.5rem;">For production workloads</p>
          <a href="/auth?plan=pro" class="btn" style="width: 100%;">Get Started</a>
        </div>
        <div class="card" style="text-align: center;">
          <h3>Scale</h3>
          <p style="font-size: 2rem; font-weight: 700; margin: 1rem 0;">$79<span style="font-size: 1rem; color: #999;">/mo</span></p>
          <p style="color: #999; margin-bottom: 1.5rem;">Multiple channels, higher resources</p>
          <a href="/auth?plan=scale" class="btn" style="width: 100%;">Get Started</a>
        </div>
      </div>
    </section>

    <footer style="text-align: center; padding: 2rem 0; color: #666; font-size: 0.875rem;">
      <p>&copy; 2026 SparkClaw. All rights reserved.</p>
    </footer>
  `))
})

// Auth page
pages.get('/auth', (c) => {
  const plan = c.req.query('plan') || ''
  return c.html(layout('Sign In', `
    <div style="max-width: 400px; margin: 4rem auto;">
      <h1 style="text-align: center; margin-bottom: 0.5rem;"><span style="color: #3b82f6;">Spark</span>Claw</h1>
      <p style="text-align: center; color: #999; margin-bottom: 2rem;">Enter your email to sign in or create an account</p>

      <div class="card">
        <div id="step-email">
          <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem;">Email</label>
          <input type="email" id="email" placeholder="you@example.com" />
          <button class="btn" style="width: 100%; margin-top: 1rem;" onclick="sendCode()">Send Code</button>
          <div id="email-error" class="error" style="display:none;"></div>
        </div>

        <div id="step-otp" style="display: none;">
          <p style="margin-bottom: 1rem; font-size: 0.875rem;">We sent a 6-digit code to <strong id="sent-email"></strong></p>
          <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem;">Code</label>
          <input type="text" id="otp" placeholder="000000" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" />
          <button class="btn" style="width: 100%; margin-top: 1rem;" onclick="verifyCode()">Verify</button>
          <div id="otp-error" class="error" style="display:none;"></div>
          <button style="background:none; border:none; color:#3b82f6; cursor:pointer; margin-top:1rem; font-size:0.875rem;" onclick="backToEmail()">Use different email</button>
        </div>
      </div>
    </div>

    <script>
      const plan = '${plan}';
      let email = '';

      async function sendCode() {
        const el = document.getElementById('email');
        email = el.value.trim();
        if (!email) return;
        const errEl = document.getElementById('email-error');
        errEl.style.display = 'none';

        const res = await fetch('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!data.ok) {
          errEl.textContent = data.error || 'Something went wrong';
          errEl.style.display = 'block';
          return;
        }

        document.getElementById('sent-email').textContent = email;
        document.getElementById('step-email').style.display = 'none';
        document.getElementById('step-otp').style.display = 'block';
        document.getElementById('otp').focus();
      }

      async function verifyCode() {
        const code = document.getElementById('otp').value.trim();
        if (code.length !== 6) return;
        const errEl = document.getElementById('otp-error');
        errEl.style.display = 'none';

        const res = await fetch('/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code })
        });
        const data = await res.json();

        if (!data.ok) {
          errEl.textContent = data.error || 'Invalid code';
          errEl.style.display = 'block';
          return;
        }

        window.location.href = plan ? '/dashboard?plan=' + plan : '/dashboard';
      }

      function backToEmail() {
        document.getElementById('step-otp').style.display = 'none';
        document.getElementById('step-email').style.display = 'block';
      }

      document.getElementById('email').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCode(); });
      document.getElementById('otp').addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyCode(); });
    </script>
  `))
})

// Dashboard (protected)
pages.get('/dashboard', requireAuth, async (c) => {
  const userId = c.get('userId')
  const userEmail = c.get('userEmail')
  const subscription = await getSubscriptionByUserId(c.env.DB, userId)
  const instance = await getInstanceByUserId(c.env.DB, userId)

  let instanceHtml = ''
  if (!subscription) {
    instanceHtml = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <p style="color: #999; margin-bottom: 1.5rem;">No subscription yet. Choose a plan to launch your OpenClaw instance.</p>
        <a href="/#pricing" class="btn">Choose a Plan</a>
      </div>
    `
  } else if (!instance || instance.status === 'pending') {
    instanceHtml = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <div class="spinner" style="margin-bottom: 1rem;"></div>
        <p>We're spinning up your OpenClaw instance...</p>
        <p style="color: #999; font-size: 0.875rem; margin-top: 0.5rem;">This usually takes 1-3 minutes.</p>
        <script>setTimeout(() => location.reload(), 10000);</script>
      </div>
    `
  } else if (instance.status === 'ready') {
    instanceHtml = `
      <div class="card">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
          <span style="width: 10px; height: 10px; background: #22c55e; border-radius: 50; display: inline-block;"></span>
          <strong>Instance Running</strong>
        </div>
        <p style="color: #999; font-size: 0.875rem; margin-bottom: 1rem;">${instance.url}</p>
        <div style="display: flex; gap: 1rem;">
          <a href="${instance.url}/setup" target="_blank" class="btn">Open Setup</a>
          <a href="${instance.url}" target="_blank" class="btn" style="background: #374151;">Open Console</a>
        </div>
      </div>
    `
  } else if (instance.status === 'error') {
    instanceHtml = `
      <div class="card" style="border-color: #ef4444;">
        <h3 style="color: #ef4444; margin-bottom: 0.5rem;">Provisioning Failed</h3>
        <p style="color: #999;">We couldn't create your instance. Please contact support.</p>
        ${instance.error_message ? `<p style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">${instance.error_message}</p>` : ''}
      </div>
    `
  } else if (instance.status === 'suspended') {
    instanceHtml = `
      <div class="card" style="border-color: #f59e0b;">
        <h3 style="color: #f59e0b; margin-bottom: 0.5rem;">Instance Suspended</h3>
        <p style="color: #999;">Your subscription has been canceled. Instance is suspended.</p>
      </div>
    `
  }

  return c.html(layout('Dashboard', `
    <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h1><span style="color: #3b82f6;">Spark</span>Claw</h1>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span style="color: #999; font-size: 0.875rem;">${userEmail}</span>
        <form action="/auth/logout" method="POST">
          <button type="submit" style="background: none; border: 1px solid #333; color: #999; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Logout</button>
        </form>
      </div>
    </header>

    ${subscription ? `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 0.75rem; color: #999; text-transform: uppercase;">Plan</span>
            <p style="font-size: 1.25rem; font-weight: 600; text-transform: capitalize;">${subscription.plan}</p>
          </div>
          <div>
            <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; background: ${subscription.status === 'active' ? '#052e16' : '#451a03'}; color: ${subscription.status === 'active' ? '#22c55e' : '#f59e0b'};">
              ${subscription.status}
            </span>
          </div>
        </div>
      </div>
    ` : ''}

    ${instanceHtml}
  `))
})

export { pages }
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add page routes (landing, auth, dashboard)"
```

---

### Task 8: Wire Everything Together

**Files:**
- Modify: `src/index.ts`
- Create: `.dev.vars`

**Step 1: Update entry point to register all routes**

```typescript
// src/index.ts
import { Hono } from 'hono'
import { pages } from './routes/pages'
import { auth } from './routes/auth'

type Bindings = {
  DB: D1Database
  RESEND_API_KEY: string
  SESSION_SECRET: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RAILWAY_API_TOKEN: string
}

export type App = { Bindings: Bindings }

const app = new Hono<App>()

// Page routes
app.route('/', pages)

// Auth API routes
app.route('/auth', auth)

export default app
```

**Step 2: Create .dev.vars for local dev secrets**

```ini
# .dev.vars (NOT committed – in .gitignore)
RESEND_API_KEY=re_test_xxxxx
SESSION_SECRET=local-dev-secret-change-in-prod
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
RAILWAY_API_TOKEN=xxxxx
```

**Step 3: Run and smoke test**

```bash
npx wrangler dev
```

Test manually:
1. `GET /` → landing page renders
2. `GET /auth` → auth form renders
3. `GET /dashboard` → redirects to `/auth` (not logged in)
4. `POST /auth/send-otp` with `{"email": "test@example.com"}` → should attempt to send (will fail without real Resend key, but no crash)

**Step 4: Commit**

```bash
git add .
git commit -m "feat: wire up all routes in entry point, add dev vars template"
```

---

### Task 9: Smoke Test & Final Verification

**Step 1: Start dev server and test full flow**

```bash
npx wrangler dev
```

Verify these endpoints respond correctly:

| URL | Expected |
|-----|----------|
| `GET /` | Landing page HTML with pricing |
| `GET /auth` | Auth form with email input |
| `GET /auth?plan=pro` | Auth form (plan param preserved) |
| `GET /dashboard` | Redirect to `/auth` |
| `POST /auth/send-otp` `{"email":"bad"}` | 400 error |
| `POST /auth/send-otp` `{"email":"test@test.com"}` | 200 or 500 (depends on Resend key) |
| `POST /auth/verify-otp` `{"email":"x@x.com","code":"000000"}` | 401 invalid code |
| `POST /auth/logout` | Redirect to `/` |

**Step 2: Final commit**

```bash
git add .
git commit -m "chore: Day 1 foundation complete - auth, sessions, dashboard"
```

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | Project scaffold: Hono + Workers + TypeScript |
| 2 | D1 schema (5 tables) + query helpers |
| 3 | Crypto utils + Resend email helper |
| 4 | OTP service + Session service |
| 5 | Auth middleware (route protection) |
| 6 | Auth routes (send-otp, verify-otp, logout) |
| 7 | HTML pages (landing, auth, dashboard) |
| 8 | Wire everything + dev vars |
| 9 | Smoke test & verify |

After Day 1, the app supports: landing page → email OTP auth → protected dashboard showing subscription/instance state.
