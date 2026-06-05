# apps/api-gateway/Dockerfile — multi-stage build cho NestJS

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/contracts/package.json ./packages/contracts/ 2>/dev/null || true
RUN pnpm install --frozen-lockfile --filter @saas-checkin/api-gateway...

FROM base AS build
COPY --from=deps /repo /repo
COPY apps/api-gateway ./apps/api-gateway
COPY packages ./packages
RUN pnpm --filter @saas-checkin/api-gateway build
RUN pnpm --filter @saas-checkin/api-gateway --prod deploy /prod/api-gateway

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /prod/api-gateway ./
USER nestjs
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/main.js"]
