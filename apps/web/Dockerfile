# apps/web/Dockerfile — multi-stage build cho Next.js standalone output
# Base: node 22-alpine (Phase 0). Phase 1+ có thể switch sang distroless nếu cần.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ── deps ────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/ 2>/dev/null || true
COPY packages/ui/package.json ./packages/ui/ 2>/dev/null || true
COPY packages/eslint-config/package.json ./packages/eslint-config/ 2>/dev/null || true
COPY packages/tsconfig/package.json ./packages/tsconfig/ 2>/dev/null || true
RUN pnpm install --frozen-lockfile --filter @saas-checkin/web...

# ── build ───────────────────────────────────────────────
FROM base AS build
COPY --from=deps /repo /repo
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm --filter @saas-checkin/web build

# ── runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public 2>/dev/null || true

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
