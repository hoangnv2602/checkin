# Initial Deploy Runbook (I-020)

> Stack chạy lần đầu trên `htz-staging-1`. Mục tiêu: 5 service (web, checkin-admin, api-gateway, core-api, mobile-build) lên + health check pass + HTTPS xanh.

## Prerequisites

- [ ] Hetzner project + API token (xem `infra/hetzner/README.md`)
- [ ] Domain đã mua + DNS trỏ về Hetzner IP (xem `infra/cloudflare/README.md`)
- [ ] GitHub secrets set:
  - `HETZNER_TOKEN`
  - `REGISTRY_TOKEN` (GHCR write)
  - `CLOUDFLARE_API_TOKEN` (DNS automation, optional Phase 0)
- [ ] Đã chạy `ansible-galaxy install geerlingguy.docker` 1 lần

## Steps

### 1. Provision VPS

```bash
cd infra/ansible
# Update inventories/staging/hosts.yml với IP thật (sau khi hcloud create)
ansible all -m ping
```

### 2. Run full stack provisioning

```bash
ansible-playbook playbooks/staging.yml -i inventories/staging/hosts.yml
# → Install Docker, UFW, fail2ban ở tất cả VPS
# → Render docker-compose cho db + app
# → Pull images từ GHCR
# → Start stack
```

### 3. Verify

```bash
# Trên VPS:
docker compose -f /opt/saas-checkin/docker-compose.yml ps
docker compose -f /opt/saas-checkin/docker-compose.yml logs --tail=100

# Health checks
curl https://web.saas-checkin.com/api/health       # → 200 ok
curl https://admin.saas-checkin.com/api/health    # → 200 ok
curl https://api.saas-checkin.com/health/live      # → 200 ok
curl https://api.saas-checkin.com/health/ready    # → 200 ok
```

### 4. Run DB migrations

```bash
# Trên app VPS (sau khi core-api image pull xong)
docker run --rm \
  -e ConnectionStrings__Default="Host=htz-db-1;Port=5432;Database=saas_checkin;Username=app_runtime;Password=$APP_RUNTIME_PW" \
  ghcr.io/hoangnv2602/core-api:dev \
  dotnet SaasCheckin.DbMigrator.dll
```

### 5. Seed data (optional, dev only)

```bash
# Phase 0: skip — chỉ run khi cần dev data
task db:seed
```

## Rollback

Nếu deploy fail:

```bash
# 1. Stop stack
ansible app -m community.docker.docker_compose_v2 -a "project_src=/opt/saas-checkin state=absent"

# 2. Revert image tag trong docker-compose → previous version
ansible app -m template -a "src=docker-compose.app.yml.j2 dest=/opt/saas-checkin/docker-compose.yml"

# 3. Restart
ansible app -m community.docker.docker_compose_v2 -a "project_src=/opt/saas-checkin pull=always state=present"
```

## Smoke test script

```bash
bash tools/scripts/smoke-test.sh https://staging.saas-checkin.com
```

(Xem `tools/scripts/smoke-test.sh` — check 4 health endpoints, 1 page load, 1 login flow.)

## Phase 0 status

- [x] Document workflow
- [ ] Chạy thật khi có VPS + domain
