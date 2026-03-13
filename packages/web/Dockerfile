# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM oven/bun:1.3.10-slim AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

RUN bun install

# ============================================================
# Stage 2: Build SvelteKit
# PUBLIC_API_URL must be set at build time (Vite inlines it)
# ============================================================
FROM deps AS builder
WORKDIR /app

ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL}

COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
COPY tsconfig.json ./

RUN bun run --filter @sparkclaw/web build

# ============================================================
# Stage 3: Runtime (Node.js for adapter-node)
# ============================================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/packages/web/build ./build
COPY --from=builder /app/packages/web/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "build"]
