# SparkClaw Quality 10/10 Upgrade Design

## Goal
Upgrade codebase quality from 5.5/10 to 10/10 across security, completeness, testing, frontend UX, and code quality.

## Decisions
- **Approach:** Single branch, all fixes together (Approach A)
- **Rate limiting:** In-memory sliding window (no Redis dependency)
- **Testing:** Unit + Integration with bun:test
- **Frontend:** Full UX improvements (loading states, polling, toasts)
- **Integrations:** Real Stripe price IDs + Railway API (read from env)

## 1. Security Hardening

### Rate Limiting
- In-memory sliding window rate limiter class
- OTP send: 5 req/min per IP
- OTP verify: 10 req/min per IP
- Auto-cleanup of expired entries

### CSRF Fix
- Reject POST/PUT/DELETE requests without Origin header
- Validate Origin against allowed origins list

### Auth Middleware
- Use Elysia `derive()` to inject authenticated user
- Return 401 immediately for missing/invalid sessions (no null user passthrough)
- Remove unsafe type casts in routes

### Env Validation
- Zod schema for all required env vars
- Fail fast at startup with clear error messages
- Separate validation per package (shared, api)

## 2. Completeness

### Railway GraphQL
- Implement proper `getServiceDomain()` query
- Return actual domain from Railway API response
- Proper error handling for GraphQL errors

### Stripe Configuration
- Read price IDs from env vars (STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_SCALE)
- Validate at startup
- Update constants.ts to use env-based config

### Webhook Error Handling
- Wrap each event handler in try/catch
- Log errors with structured format
- Return appropriate HTTP status codes

### Structured Logging
- Console-based JSON logger utility (no external deps)
- Log levels: info, warn, error
- Include timestamp, context, request ID where available

## 3. Testing

### Unit Tests
- OTP service (generate, verify, expiry)
- Session service (create, verify, cleanup)
- Rate limiter (allow, block, window reset)
- Utils (generateId, hashOtp)
- Env validation (valid config, missing vars)

### Integration Tests
- Auth flow: send-otp -> verify-otp -> session cookie
- Protected API routes: with/without valid session
- Stripe webhook: signature verification, event processing
- All with mocked DB and external services

## 4. Frontend UX

### Loading States
- Spinner/skeleton for all async operations
- Disabled buttons during submission
- Visual feedback on form submit

### Instance Status Polling
- Auto-poll every 5s while instance status is "provisioning"
- Stop polling when ready/failed
- Show progress indicator

### Error Handling
- Validate plan parameter with shared Zod schema
- User-friendly error messages (not raw API errors)
- Toast notification system for success/error

### Type Safety
- Remove all unsafe type casts
- Proper typing for API responses
- Validate external data at boundaries

## 5. Code Quality

### Consistent Error Responses
- Standardized `{ error: string, code?: string }` format
- HTTP status codes used correctly

### JSDoc
- Document public service functions
- Document API route handlers

## Tech Choices
- bun:test for testing (zero config with Bun)
- Zod for env validation (already a dependency)
- No new runtime dependencies added
