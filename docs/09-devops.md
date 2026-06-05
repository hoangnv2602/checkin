# 09 · DevOps & Hạ tầng

> On-prem / VPS tự quản. Hetzner Cloud làm primary, có lộ trình document sang AWS/GCP khi scale đòi hỏi. Xem ADR-0007.

## Môi trường

| Env | Mục đích | Hạ tầng |
|-----|----------|---------|
| local | Dev | docker-compose (postgres 16, redis 7, mailhog, minio) |
| ci | Test | GH Actions + ephemeral service containers |
| staging | UAT/QA | 1 VPS Hetzner CX22 (2 vCPU / 4GB) |
| prod | Production | 2 VPS Hetzner (app + db) + Cloudflare proxy |

## Topology production (D6)

```
htz-app-1 (Hetzner CCX23, 4 vCPU / 16GB / NVMe)
    Ubuntu 24.04 LTS
    ├── caddy                 (reverse proxy + Let's Encrypt, HTTP/3)
    │   ├── web.saas-checkin.com         → web (tenant)
    │   ├── admin.saas-checkin.com      → checkin-admin (D12)
    │   └── api.saas-checkin.com         → api-gateway (gRPC+REST, private subnet)
    ├── api-gateway           (NestJS, 2 replicas)
    ├── web                   (Next.js standalone, 2 replicas)
    ├── checkin-admin           (Next.js standalone, 1 replica — traffic thấp, D12, ADR-0014)
    ├── core-api              (.NET Core 10 + Kestrel, 2 replicas)
    ├── worker                (BullMQ consumer)
    └── monitoring            (Uptime Kuma + Grafana + Loki + Promtail)

htz-db-1 (Hetzner CCX13, 2 vCPU / 8GB / NVMe)
    Ubuntu 24.04 LTS
    ├── postgres 16           (single instance, WAL streaming; 2 role: app_runtime + app_platform_owner)
    ├── redis 7               (AOF + RDB; key namespace `sess:rt:*` cho tenant, `sess:pa:*` cho platform)
    └── pgbouncer             (transaction pool)

htz-staging-1 (Hetzner CX22, 2 vCPU / 4GB)
    ├── full stack qua docker-compose :staging tag
    └── postgres + redis volume riêng

Hetzner Storage Box (1TB, tài khoản riêng)
    └── pgbackrest WAL archive + full backups

Hetzner Volume (200GB)
    └── mount vào htz-db-1 cho dữ liệu postgres
```

**Phân tách network:**
- `web.saas-checkin.com` — public, Caddy + Cloudflare proxy, chỉ serve static + SSR cho tenant.
- `admin.saas-checkin.com` — public, Caddy + Cloudflare proxy, **IP allowlist bổ sung** ở Cloudflare WAF (chỉ IP team + IP VPN support), MFA bắt buộc ở app layer.
- `api.saas-checkin.com` — **private** (chỉ Caddy + cluster truy cập), không public. Caddy terminate TLS rồi reverse proxy sang `api-gateway:3000` nội bộ. Worker gRPC từ `core-api` không qua Caddy.

## Orchestration

- **Tool:** Docker Compose (không Kubernetes ở MVP)
- **Mỗi service:** một Dockerfile (base distroless)
- **Deployment unit:** project `docker compose` (hoặc `blue`/`green` cho zero-downtime swap)
- **Stage migration:** container riêng chạy `dotnet run --project src/SaasCheckin.DbMigrator` (hoặc `dotnet ef database update`) trước khi image mới nhận traffic. Migration chạy sequential, idempotent.
- **Tương lai:** khi > 3 node hoặc > 100k MAU, migrate sang **K3s** (single-binary k8s) trên cùng Hetzner

## Provisioning (Ansible)

```
infra/ansible/
├── inventories/
│   ├── production/
│   │   ├── htz-app-1.yml
│   │   ├── htz-db-1.yml
│   │   └── htz-staging-1.yml
│   └── staging/
├── playbooks/
│   ├── common.yml        -- docker, ufw, fail2ban, users, ssh keys
│   ├── app.yml           -- app-specific (docker-compose, caddy)
│   ├── db.yml            -- postgres, redis, pgbouncer, pgbackrest
│   └── staging.yml
├── group_vars/
│   ├── all.yml
│   ├── production.yml
│   └── staging.yml
├── roles/
│   ├── common/
│   ├── docker/
│   ├── postgres/
│   ├── redis/
│   ├── caddy/
│   └── pgbackrest/
└── ansible.cfg
```

Thứ tự chạy cho prod node mới:
```bash
ansible-playbook playbooks/common.yml -l htz-app-1
ansible-playbook playbooks/app.yml    -l htz-app-1
```

## CI / CD (GitHub Actions)

```
.github/workflows/
├── ci.yml                -- matrix test + lint + typecheck
├── release.yml           -- semantic-release + GHCR push
├── deploy-staging.yml    -- push vào develop → staging
└── deploy-prod.yml       -- tag v* → production (manual approval)
```

**Stage pipeline** (chạy tuần tự):
1. `test` — unit, integration, lint, typecheck
2. `build` — image cho mỗi service, push lên `ghcr.io/<org>/<service>:<sha>`
3. `migrate` — chạy .NET EF Core migrations qua `SaasCheckin.DbMigrator` trên DB đích
4. `deploy` — SSH, `docker compose pull && docker compose up -d`
5. `smoke` — gọi `/healthz` và `/readyz` trên tất cả service

## Backups (RPO 1h, RTO 4h)

- **Tool:** `pgbackrest`
- **Daily full** + **WAL streaming** về Hetzner Storage Box
- **Retention:** 7 daily / 4 weekly / 6 monthly
- **Restore drill:** mỗi quý trên một staging DB riêng
- **File config / cert:** mã hoá Ansible Vault, đẩy về Storage Box

## Security baseline

- Chỉ HTTPS, HSTS preload, TLS 1.3
- Cloudflare proxy + free WAF rules ở edge
- UFW: mở 22 (fail2ban), 80, 443
- SSH: key-only, không password, không cho root login
- Secrets: Ansible Vault cho OS, `/etc/<service>/.env` (mode 600)
- Postgres at-rest: LUKS trên Hetzner volume; cân nhắc cloud-managed disk encryption khi migrate
- GDPR: endpoint export data, xoá account, bảng `audit_log` immutable
- Dependabot + `npm audit` + `dotnet list package --vulnerable` + `dotnet outdated` hàng tuần
- Scan container image bằng Trivy trong CI

## Observability

- **Logs:** pino (NestJS) + Serilog (.NET) → OpenTelemetry OTLP → Loki qua Promtail
- **Metrics:** Prometheus + Grafana (self-hosted)
- **Tracing:** OpenTelemetry OTLP → Tempo
- **Errors:** Sentry (web, mobile, api-gateway, core-api)
- **Uptime:** Uptime Kuma → cảnh báo Telegram / Discord
- **Dashboards:** Grafana folder theo từng service

## Ước tính chi phí (prod, ~1000 MAU, on-prem Hetzner)

| Hạng mục | EUR/tháng (ước tính) |
|----------|----------------------|
| Hetzner CCX23 app (4 vCPU / 16GB / NVMe) | 30 |
| Hetzner CCX13 db (2 vCPU / 8GB / NVMe) | 15 |
| Hetzner CX22 staging (2 vCPU / 4GB) | 5 |
| Hetzner Volume 200GB (dữ liệu Postgres) | 7 |
| Hetzner Storage Box 1TB (backup + artifacts) | 3.5 |
| Cloudflare Pro (WAF, DDoS, Workers) | 20 |
| Domain (.com / .vn) | 1 |
| Email (Resend Pro, 50k email) | 20 |
| SMS (Twilio, ~1k SMS VN) | 10 |
| Sentry self-host (Loki + Grafana thay thế) | 0 |
| **Tổng** | **~110 EUR / ~120 USD** |

so với ~290 USD/tháng cho managed cloud. Tiết kiệm ~58% đổi lại công sức vận hành. Migrate AWS/GCP khi cần HA multi-region hoặc yêu cầu compliance.

## Lộ trình migrate lên cloud (khi cần)

- Container image đã portable
- `docker-compose.yml` chuyển thành Kubernetes manifest (Kompose hỗ trợ, hoặc viết K3s YAML thẳng)
- Postgres: `pgbackrest` restore sang RDS / Cloud SQL
- Redis: AOF dump sang ElastiCache / Memorystore
- Cutover DNS: đổi A record trong Cloudflare, giữ TTL thấp trong lúc chuyển

## Dev local (docker-compose)

`infra/docker/docker-compose.dev.yml` bao gồm:
- `postgres` (có init script bật RLS template + extensions)
- `redis`
- `mailhog` (SMTP catcher)
- `minio` (S3-compatible để lưu PDF/QR local)

Mỗi app mount source dir riêng. Dùng `task dev:up` từ root.
