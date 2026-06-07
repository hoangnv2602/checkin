# White-label custom domain runbook (I-804)

> **Phase 8 — Scale.** Enterprise tenant có `customDomain` field.
> Caddy auto-issue Let's Encrypt cert on-demand qua Cloudflare DNS-01.

## Flow

1. **Tenant config** — Enterprise customer vào `web.saas-checkin.com/settings/domain`,
   nhập `events.acme-corp.com`, click "Activate". Web gọi
   `POST /v1/internal/domain/cache` với `{ host, tenantId, plan: "enterprise" }`.
2. **DNS setup** — Tenant tạo CNAME record:
   `events.acme-corp.com → cname.saas-checkin.com`
3. **First request** — Caddy thấy SNI `events.acme-corp.com`, chưa có cert.
   on_demand_tls: gọi whitelist check API (returns 200 nếu domain trong cache).
   Nếu OK → Caddy issue cert qua Cloudflare DNS-01 (~30s).
4. **Subsequent requests** — cert cached, auto-renew 30 ngày trước expiry.
5. **Tenant middleware** — BFF `DomainResolverMiddleware` (apps/api-gateway/.../domain-resolver.middleware.ts)
   resolve Host header → tenantId, gắn vào `req.headers["x-tenant-id"]` cho
   rate limit guard + plan limit guard pick up.

## Plan gate

Chỉ `Enterprise` plan mới được enable customDomain. Nếu tenant upgrade từ
Pro → Enterprise, cache entry sẽ được re-cache bằng plan mới. Nếu downgrade
Enterprise → Pro, customDomain sẽ bị **denied** ở lần resolve kế tiếp (log warning).

## Caddy config

`infra/caddy/Caddyfile.whitelabel`:

```caddyfile
{
  email ops@saas-checkin.com
  acme_dns cloudflare {
    api_token {$CF_API_TOKEN}
  }
}

# Shared domain — wildcard cert
*.saas-checkin.com, saas-checkin.com {
  tls {
    dns cloudflare
  }
  reverse_proxy api-gateway:3001
  reverse_proxy web:3000
}

# Custom domain — on-demand TLS
:443 {
  tls {
    on_demand
  }
  reverse_proxy api-gateway:3001
}
```

## Cloudflare DNS module setup

1. Cloudflare account → My Profile → API Tokens → Create Token
2. Permissions: `Zone:DNS:Edit` (scoped to `saas-checkin.com` zone)
3. Set `CF_API_TOKEN` env trong Caddy container
4. Caddy restart → Cloudflare module loads

## Caddy image

`caddy:2-builder` (cần build với cloudflare DNS module):

```dockerfile
FROM caddy:2.7-builder AS builder
RUN caddy build-modules --with github.com/caddy-dns/cloudflare

FROM caddy:2.7
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

## Verification

Sau khi config, kiểm tra:

```bash
# 1. DNS resolve
dig CNAME events.acme-corp.com

# 2. TLS cert issued
echo | openssl s_client -connect events.acme-corp.com:443 -servername events.acme-corp.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer

# 3. Tenant resolved
curl -H "Host: events.acme-corp.com" https://cname.saas-checkin.com/v1/health/ready
# Expect: 200 + X-Forwarded-Tenant: tenant-acme header
```

## Failure modes

- **DNS chưa propagate** (TTL cũ) → Caddy 521 / 525. Wait 5-30 min.
- **Cloudflare token revoke** → cert renewal fail. Caddy logs `acme: error presenting challenge`.
  Fix: rotate token, restart Caddy.
- **Tenant plan downgrade** → middleware returns null → 404 cho custom domain.
  Cache invalidation: `POST /v1/internal/domain/cache` với plan mới.
- **First request latency** (cert issue) → ~30s spike. Mitigate: pre-warm certs
  cho top 100 Enterprise tenants (script + cron).

## Rollout checklist

- [ ] Caddy image built với cloudflare module
- [ ] CF_API_TOKEN set trong deployment env
- [ ] Wildcard cert `*.saas-checkin.com` issued
- [ ] DomainAdminController exposed internal-only
- [ ] DomainResolverMiddleware applied globally trong main.ts
- [ ] Web settings UI cho phép tenant config customDomain
- [ ] Audit log: ghi mỗi domain add/remove (Phase 6 AuditModule)
