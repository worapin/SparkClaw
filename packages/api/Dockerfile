# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM oven/bun:1.3.10-slim AS deps
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN bun install --frozen-lockfile

# ============================================================
# Stage 2: Build api (shared is TypeScript source, Bun handles it directly)
# ============================================================
FROM deps AS builder
WORKDIR /app

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY tsconfig.json ./

# Build api bundle (Bun resolves workspace TypeScript directly)
RUN bun run --filter @sparkclaw/api build

# ============================================================
# Stage 3: Runtime image
# ============================================================
FROM oven/bun:1.3.10-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built bundle, source packages (for shared TS), and node_modules
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
