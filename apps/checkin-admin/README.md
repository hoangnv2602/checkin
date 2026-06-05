# apps/checkin-admin — Platform Owner Console (D12, ADR-0014)

> Next.js 16.2 — **tách biệt hoàn toàn** với `apps/web`:
> - Project riêng, deploy riêng, domain riêng (`admin.saas-checkin.com`).
> - Cookie riêng (`sa_pa_session`, domain `.admin.saas-checkin.com`).
> - JWT audience riêng (`aud: 'checkin-admin'`).
> - Không share component / file / utility với `apps/web` (Aurora tokens copy thủ công).
> - Không có Socket.IO, không i18n (MVP chỉ EN).
>
> **Audience:** internal platform staff (`@team/platform-eng` trong CODEOWNERS).

## Phase 0 status

- ✅ Skeleton Next.js app + 8 dashboard routes (mock data)
- ✅ Auth route group: `/login` + `/mfa-setup`
- ✅ Middleware stub (Phase 1 mới wire JWT check)
- ✅ Aurora tokens copy
- ✅ Health endpoint
- ⏳ Phase 1+: real API qua `app_platform_owner` role + BYPASSRLS + audit log

## Routes

| Path | Module | Phase |
|---|---|---|
| `/login` | auth | 1 |
| `/mfa-setup` | auth (TOTP) | 1 |
| `/tenants` | tenants | 1 |
| `/subscriptions` | subscriptions | 5 |
| `/plans` | plans | 5 |
| `/audit` | audit | 1 |
| `/impersonate` | impersonate | 1 |
| `/metrics` | metrics | 6 |
| `/feature-flags` | feature-flags | 6 |
| `/settings` | settings | 6 |

## Quick start

```bash
pnpm --filter @saas-checkin/checkin-admin dev
# → http://localhost:3002
```

## Boundaries với apps/web

| Layer | apps/web | apps/checkin-admin |
|---|---|---|
| Domain audience | tenant users | internal staff |
| Auth | JWT `aud: 'web'` | JWT `aud: 'checkin-admin'` + `mfa: true` |
| Cookie domain | `web.saas-checkin.com` | `.admin.saas-checkin.com` |
| BFF endpoint | `/v1/...` (tenant API) | `/admin/v1/...` (BFF `checkin-admin/` module riêng) |
| Postgres role | `app_runtime` (RLS) | `app_platform_owner` (BYPASSRLS + audit) |
| Aurora tokens | source | copy (qua PR riêng) |

## Health check

```bash
curl http://localhost:3002/api/health
# {"status":"ok","service":"checkin-admin","timestamp":"..."}
```
