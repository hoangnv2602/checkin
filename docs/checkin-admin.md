# Check-in Admin App — `apps/checkin-admin`

> Tài liệu đặc tả cho **platform owner / support / engineer console** — chạy SaaS xuyên suốt các tenant. Tách hẳn khỏi `apps/web` (tenant-facing) vì lý do security boundary, release cadence, scale độc lập. ADR: [`0014-checkin-admin-app.md`](./adr/0014-checkin-admin-app.md).

## Tại sao tách app

| Lý do | Mô tả |
|---|---|
| **Security boundary** | 2 JWT signing key audience khác nhau (`web` vs `checkin-admin`), 2 cookie domain khác nhau, 2 deployment. 1 bug XSS ở `apps/web` không tự động escalate lên quyền checkin-admin. |
| **MFA + IP allowlist bắt buộc** | TOTP từ lần login đầu, refresh token TTL 8h (vs 30 ngày tenant), IP allowlist ở Cloudflare WAF cho `admin.*`. |
| **BYPASSRLS cô lập** | Postgres role `app_platform_owner` chỉ dùng trong gRPC channel riêng từ BFF module `checkin-admin/`. Không bao giờ lẫn vào code path tenant. |
| **Audit forensic** | Mọi mutation cross-tenant ghi `platform_audit_log` (append-only, không ai UPDATE/DELETE). Compliance / debug dễ. |
| **Release độc lập** | Update UI tenant không sợ break checkin-admin. Platform team ship feature gấp không cần chờ release tenant. |
| **Scale độc lập** | Super-admin traffic thấp (vài user), 1 replica là đủ. Tenant traffic scale 2+ replicas riêng. |
| **2 audience khác nhau** | Organizer (của 1 org) vs Platform Owner (của cả SaaS) — UX flow khác nhau, layout khác nhau, data model khác nhau. |

## Bối cảnh trong kiến trúc

```
┌──────────────────────────────────────────────────────────────────────┐
│ apps/checkin-admin (Next.js)                                           │
│   - MFA TOTP login                                                    │
│   - Tenant list / detail / suspend / impersonate                     │
│   - Subscription list / refund / cancel                               │
│   - Plan CRUD / feature flags / global metrics                        │
│   - Audit log viewer (cross-tenant)                                   │
└─────────────┬────────────────────────────────────────────────────────┘
              │ HTTPS (cookie: sa_pa_session, domain .admin.saas-checkin.com)
              │ JWT aud: 'checkin-admin', role: platform_owner|...
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ apps/api-gateway (NestJS, cùng process)                              │
│   modules/checkin-admin/  ──── gRPC channel riêng ──┐                   │
│   PlatformAdminAuthGuard  (verify role + MFA +    │                   │
│   IpAllowlistGuard         IP allowlist)          │                   │
└──────────────────────────────────────────────────│───────────────────┘
                                                   │ mTLS
                                                   │ service-account
                                                   │ aud: 'core-api-platform'
                                                   │ scope: app_platform_owner
                                                   │ metadata: x-platform-role: true
                                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ SaasCheckin.HttpApi.Host (.NET)                                      │
│   PlatformDbContextFactory  ──→  Postgres role app_platform_owner    │
│                                  BYPASSRLS (NGOẠI TRỪ platform_audit_log)│
│                                  Trigger audit log row mỗi save     │
└──────────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Choice | Lý do |
|---|---|---|
| Framework | Next.js 16.2.x (App Router + RSC) | Cùng version `apps/web`, cùng ecosystem |
| Auth | Custom JWT (RS256) + TOTP MFA (RFC 6238) | Dùng chung library `Microsoft.IdentityModel.JsonWebTokens` (verify ở BFF); MFA library `Otp.NET` ở .NET + `otplib` ở Next.js |
| UI | Tailwind 4 + shadcn/ui (CLI) + Radix | Cùng design system Aurora |
| State | TanStack Query + Zustand | Giống `apps/web` |
| Form | react-hook-form + zod | Giống `apps/web` |
| i18n | **Không cần MVP** (chỉ EN) | Platform team nhỏ, tiết kiệm effort |
| Realtime | **Không cần** (không có Socket.IO) | Audit log / metrics đủ dùng polling hoặc manual refresh |
| Testing | Vitest + Playwright | Cùng `apps/web` |

> **KHÔNG share** với `apps/web`: `components/ui/` (shadcn install riêng), `lib/` (chỉ những utility generic giống copy), `globals.css` (chỉ Aurora tokens copy).

## Layout thư mục

```
apps/checkin-admin/
├── src/
│   ├── app/
│   │   ├── globals.css                       # copy Aurora tokens từ apps/web
│   │   ├── layout.tsx                        # root layout
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx                # email + password + TOTP 1 form
│   │   │   └── mfa-setup/page.tsx            # QR code + verify code
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                    # sidebar + topbar
│   │   │   ├── page.tsx                      # overview (active tenants, MRR, alerts)
│   │   │   ├── tenants/
│   │   │   │   ├── page.tsx                  # list all tenants
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx              # detail
│   │   │   │       ├── events/page.tsx
│   │   │   │       ├── members/page.tsx
│   │   │   │       ├── billing/page.tsx
│   │   │   │       └── usage/page.tsx
│   │   │   ├── subscriptions/
│   │   │   │   ├── page.tsx                  # list cross-tenant
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── refund/page.tsx
│   │   │   ├── plans/
│   │   │   │   ├── page.tsx                  # CRUD plan
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── audit/
│   │   │   │   ├── page.tsx                  # filter + table
│   │   │   │   └── [id]/page.tsx             # detail payload
│   │   │   ├── impersonate/
│   │   │   │   ├── page.tsx                  # form tenantId + userId + reason
│   │   │   │   └── active/page.tsx           # session hiện tại
│   │   │   ├── metrics/
│   │   │   │   ├── page.tsx                  # overview
│   │   │   │   └── timeseries/page.tsx
│   │   │   ├── feature-flags/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [key]/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx                  # profile + change password
│   │   │       └── ip-allowlist/page.tsx     # (chỉ platform_owner)
│   │   └── api/
│   │       └── health/route.ts
│   ├── components/
│   │   └── ui/                               # shadcn components (CLI install)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── table.tsx                     # data table (TanStack Table)
│   │       ├── badge.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── select.tsx
│   │       ├── toast.tsx                     # notification
│   │       └── ...
│   ├── lib/
│   │   ├── utils.ts                          # shadcn cn() helper (CLI-managed)
│   │   ├── date.ts                           # date-fns helper
│   │   ├── format.ts                         # number/currency
│   │   ├── validate.ts                       # zod schema generic
│   │   ├── permissions.ts                    # check role platform_*
│   │   └── totp.ts                           # TOTP code gen/verify (otplib)
│   └── modules/                              # Feature module (D10)
│       ├── tenants/
│       │   ├── components/
│       │   │   ├── TenantTable.tsx
│       │   │   ├── TenantDetailCard.tsx
│       │   │   ├── SuspendTenantDialog.tsx
│       │   │   ├── TenantFilters.tsx
│       │   │   ├── TenantsPage.tsx           # page-level composition
│       │   │   └── index.ts
│       │   ├── hooks/
│       │   │   ├── useTenants.ts             # TanStack Query
│       │   │   ├── useSuspendTenant.ts       # mutation
│       │   │   ├── useImpersonateTenant.ts
│       │   │   └── index.ts
│       │   ├── schemas/
│       │   │   ├── tenant.schema.ts          # zod
│       │   │   └── index.ts
│       │   ├── services/
│       │   │   ├── tenantsApi.ts             # gọi api-gateway /v1/admin/tenants
│       │   │   └── index.ts
│       │   ├── types/
│       │   │   ├── tenant.ts                 # Tenant, TenantStatus, TenantSummary
│       │   │   └── index.ts
│       │   └── index.ts                      # barrel
│       ├── subscriptions/                    # list, view, refund, cancel
│       ├── plans/                            # CRUD plan
│       ├── audit/                            # view platform_audit_log
│       ├── impersonate/                      # generate short-lived tenant JWT
│       ├── metrics/                          # global: MAU, MRR, churn
│       ├── feature-flags/                    # rollout flag
│       └── _shared/
│           ├── api/                          # fetch client, retry, error mapping
│           ├── auth/                         # JWT decode, MFA check, session
│           ├── config/                       # env, route constants
│           └── providers/                    # QueryClientProvider, ThemeProvider
├── public/
├── components.json                           # cấu hình shadcn (D11) — KHÁC apps/web
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                             # path alias: @/* → src/*
├── package.json
├── Dockerfile                                # node:22-alpine multi-stage
└── README.md
```

## Permission matrix

| Action | `platform_owner` | `platform_support` | `platform_engineer` |
|---|:---:|:---:|:---:|
| Login + MFA | ✅ | ✅ | ✅ |
| View tenant list / detail | ✅ | ✅ | ❌ (chỉ metrics) |
| Suspend / reactivate tenant | ✅ | ❌ | ❌ |
| View subscriptions | ✅ | ✅ | ❌ |
| Refund / cancel subscription | ✅ | ✅ (refund ≤ 100 USD tự động, > 100 USD cần owner duyệt) | ❌ |
| CRUD plan | ✅ | ❌ | ❌ |
| Feature flag toggle | ✅ | ❌ | ✅ |
| View audit log (cross-tenant) | ✅ | ✅ (read-only) | ✅ (read-only) |
| Impersonate | ✅ (max 30 phút) | ✅ (max 15 phút) | ❌ |
| View metrics | ✅ | ✅ | ✅ |
| Reset platform user password | ✅ | ❌ | ❌ |
| Lock / unlock platform user | ✅ | ❌ | ❌ |
| Manage IP allowlist | ✅ | ❌ | ❌ |
| Rotate JWT signing key | ✅ | ❌ | ❌ |

## Auth flow chi tiết

### Login (lần đầu, chưa có MFA)

```
1. User → /login (email + password)
2. POST /v1/admin/auth/login {email, password}
   → Backend: verify password; check mfa_enabled
   → If false: return {mfaRequired: false, mfaSetupToken: '...'}
3. User redirect → /mfa-setup?token=...
4. /mfa-setup page: GET /v1/admin/auth/mfa/setup (kèm mfaSetupToken)
   → Backend: generate TOTP secret, return {secret, otpauthUrl}
5. Frontend render QR code từ otpauthUrl
6. User scan QR bằng Authenticator app, nhập 6-digit code
7. POST /v1/admin/auth/mfa/verify {mfaSetupToken, totpCode}
   → Backend: verify TOTP, set mfa_enabled=true, issue JWT + refresh
   → Return {accessToken, refreshToken}
8. Save tokens in HttpOnly cookie:
   - sa_pa_session (JWT, 30 phút, secure, httpOnly, sameSite=strict, domain .admin.saas-checkin.com)
   - sa_pa_refresh (refresh, 8h, same flags)
9. Redirect → / (dashboard)
```

### Login (đã có MFA)

```
1. User → /login (email + password + 6-digit TOTP)
2. POST /v1/admin/auth/login {email, password, totp}
   → Backend: verify password + TOTP (±1 step skew); issue JWT + refresh
3. Same as step 8-9 ở trên
```

### Mọi request sau đó

```
1. Middleware Next.js: đọc cookie sa_pa_session
2. Nếu không có → redirect /login
3. Nếu có nhưng exp < 5 phút → silent refresh từ sa_pa_refresh
4. Verify JWT (signature + aud: 'checkin-admin' + mfa: true)
5. Set request headers: x-platform-user-id, x-platform-role
6. Gọi API qua fetch client với Bearer token
7. Api-gateway: PlatformAdminAuthGuard verify + IpAllowlistGuard check IP
8. Api-gateway gRPC → core-api với metadata x-platform-role: true
9. Core-api dùng PlatformDbContextFactory (BYPASSRLS)
10. Mọi save change trigger platform_audit_log row
```

## Setup design system

```bash
cd apps/checkin-admin
yarn dlx shadcn@latest init
# Trả lời:
#   - components: src/components/ui
#   - utils: src/lib/utils
#   - css: src/app/globals.css
#   - baseColor: (chọn Slate — sẽ override sau)
#   - CSS variables: yes

# Copy Aurora tokens từ apps/web
cp ../../apps/web/src/app/globals.css src/app/globals.css
# Sửa baseColor → Aurora (Electric Indigo primary, Sunset Coral accent)
# Verify KHÔNG còn token baseColor: neutral

# Add component cần cho MVP
yarn dlx shadcn@latest add button input label card dialog table badge dropdown-menu select toast
```

> **KHÔNG share** `apps/web/src/components/ui/` qua path alias TS. Mỗi app tự quản component UI.

## CI / CD

`.github/workflows/ci.yml` thêm job `checkin-admin` (song song với `web`):

```yaml
checkin-admin:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
      with: { version: 9 }
    - run: pnpm install --frozen-lockfile
    - run: cd apps/checkin-admin && pnpm lint
    - run: cd apps/checkin-admin && pnpm typecheck
    - run: cd apps/checkin-admin && pnpm test
    - run: cd apps/checkin-admin && pnpm build
    - run: cd apps/checkin-admin && pnpm audit:secrets    # custom check: không có tenant JWT secret
```

Deploy riêng:

```yaml
deploy-checkin-admin-prod:
  needs: [checkin-admin, checkin-admin-image]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: SSH deploy
      run: ./scripts/deploy-checkin-admin.sh production
```

## Phase roadmap

| Phase | Task | Issue |
|---|---|---|
| 0 | Skeleton Next.js, login placeholder, MFA setup placeholder | I-013b |
| 1 | PlatformUser + PlatformSession aggregate; BFF auth module; Next.js auth pages; Postgres role `app_platform_owner` | I-106, I-107, I-108 |
| 1 | MFA setup flow + IP allowlist guard + audit log tạm qua `outbox_messages` | I-106, I-107 |
| 5 | Full features: tenants list, subscriptions, plans CRUD, refund, suspend, impersonation | (issue mới ở phase 5) |
| 6 | PlatformAuditEntry aggregate (thay outbox tạm); feature flags; global metrics dashboard; audit log viewer | (issue mới ở phase 6) |
| 8+ | Session recording; SIEM log shipping; HITRUST controls | deferred |

## Anti-pattern

- ❌ Import từ `apps/web/src/...` vào `apps/checkin-admin/src/...` (ESLint rule cấm)
- ❌ Share `sa_pa_session` cookie với `saas-checkin.com` domain — chỉ `.admin.saas-checkin.com`
- ❌ Dùng JWT signing key của tenant cho checkin-admin (audience khác nhau)
- ❌ Cho phép login không MFA — Phase 1 trở đi MFA bắt buộc
- ❌ Skip audit log — mọi POST/PATCH/DELETE đều ghi `platform_audit_log` qua trigger + middleware
- ❌ Direct query `SELECT * FROM users` từ checkin-admin — phải qua repository guard có audit log
- ❌ Bypass IP allowlist ở local dev — chỉ tắt qua env `DISABLE_PLATFORM_IP_ALLOWLIST=true` ở dev, không commit

## Open questions

- [ ] Có cần tách `apps/checkin-admin-api` BFF NestJS riêng nếu team platform > 3 người? (Phase 8+ revisit)
- [ ] Có share `packages/ui/` ở Phase 6+ nếu duplication > 5 component/tháng? (revisit risk #22)
- [ ] SOC 2 / ISO 27001 compliance có cần HITRUST controls? (revisit risk trigger)
- [ ] Có cần session recording cho checkin-admin (GDPR / compliance)? (Phase 8+)

## References

- [`docs/adr/0014-checkin-admin-app.md`](./adr/0014-checkin-admin-app.md) — ADR chính
- [`docs/01-architecture.md`](./01-architecture.md) — sơ đồ tổng
- [`docs/05-database.md`](./05-database.md) § Pattern kết nối — 2 Postgres role
- [`docs/06-api.md`](./06-api.md) § Super-admin — REST endpoint list
- [`docs/04-bounded-contexts.md`](./04-bounded-contexts.md) § PlatformOperations
- [`docs/11-risks.md`](./11-risks.md) — risk #18-23
- [`docs/issues/phase-0-foundation.md`](./issues/phase-0-foundation.md) § I-013b
- [`docs/issues/phase-1-identity.md`](./issues/phase-1-identity.md) § I-106, I-107, I-108
