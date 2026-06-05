# apps/web — tenant-facing Next.js app (D12)

> Next.js 16.2 App Router + feature modules (D10) + Aurora design system (D11) +
> TanStack Query + Zustand + next-intl. **Tách biệt hoàn toàn** với `apps/checkin-admin`
> (platform owner app, audience khác, cookie domain khác, deploy domain khác).

## Quick start (dev)

```bash
# Từ repo root
task dev:up                    # postgres, redis, mailhog, minio
pnpm --filter @saas-checkin/web dev
# → http://localhost:3000
```

## Structure (D10 — feature module)

```
src/
├── app/                       # Next.js route shells (thin)
│   ├── (marketing)/           # Public landing pages
│   ├── (auth)/                # Login, register, forgot-password
│   ├── (dashboard)/           # Authenticated app routes
│   ├── api/                   # Route handlers (health, etc.)
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Root → redirect /dashboard
│   └── globals.css            # Aurora tokens
├── components/
│   └── ui/                    # shadcn CLI-managed (READ docs/components-ui/README.md)
├── lib/                       # Generic utilities (cn, formatDate, ...)
└── modules/
    ├── _shared/               # Cross-module coordinators (api, providers, env)
    ├── marketing/             # Public site
    ├── auth/                  # Phase 1 (I-104)
    ├── events/                # Phase 2 (I-201)
    ├── checkin/               # Phase 4 (I-401)
    ├── registration/          # Phase 3 (I-301)
    ├── billing/               # Phase 5 (I-501)
    ├── members/               # Phase 1 (I-106)
    ├── settings/              # Phase 1 (I-107)
    └── notifications/         # Phase 6 (I-601)
```

Each module:
```
modules/<module>/
├── components/<EntityXxx>.tsx + index.ts
├── hooks/use<Entities>.ts + index.ts
├── schemas/<entity>.schema.ts + index.ts
├── services/<entities>Api.ts + index.ts
├── types/<entity>.ts + index.ts
└── index.ts                   # barrel
```

## Boundaries

- **Không deep import chéo module.** Luôn qua barrel: `import { EventCard } from "@/modules/events"`.
  Enforce bởi ESLint `no-restricted-imports`.
- **`src/lib/`** chỉ utility generic, KHÔNG business logic.
- **`src/modules/_shared/`** chứa coordinator (API client, env validation, providers).
- **`src/app/`** chỉ chứa route shell + layout + page wrapper mỏng.

## Design system

- Aurora tokens ở `src/app/globals.css`.
- **Dùng semantic tokens**: `bg-primary`, `text-foreground`, `border-border`. KHÔNG dùng
  `bg-indigo-500`, `text-gray-900`, ... (D11).
- shadcn components: add qua CLI, customize bằng wrapper ở `modules/<module>/components/`.

## Health check

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"web","timestamp":"..."}
```

## Docker

```bash
docker build -t saas-checkin-web:dev -f apps/web/Dockerfile .
docker run -p 3000:3000 saas-checkin-web:dev
```
