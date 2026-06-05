# apps/checkin-admin/Dockerfile — multi-stage build, giống apps/web

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/checkin-admin/package.json ./apps/checkin-admin/
RUN pnpm install --frozen-lockfile --filter @saas-checkin/checkin-admin...

FROM base AS build
COPY --from=deps /repo /repo
COPY apps/checkin-admin ./apps/checkin-admin
RUN pnpm --filter @saas-checkin/checkin-admin build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /repo/apps/checkin-admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/checkin-admin/.next/static ./apps/checkin-admin/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/checkin-admin/public ./apps/checkin-admin/public 2>/dev/null || true
USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/checkin-admin/server.js"]
