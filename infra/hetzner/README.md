# infra/hetzner/ — Phase 0 placeholder (I-017)

> Tạo Hetzner Cloud project + 3 VPS.
> **CẦN tài khoản Hetzner thật + API token** — Phase 0 chỉ document workflow.

## Workflow (sau khi có Hetzner account)

1. **Tạo Hetzner Cloud project** ở https://console.hetzner.cloud
2. **Tạo API token** với scope Read + Write → lưu vào GitHub Actions secret `HETZNER_TOKEN`
3. **Tạo 3 VPS:**
   - `htz-app-1` (CCX23 — 4 vCPU / 16 GB / 160 GB SSD) — app servers
   - `htz-db-1` (CCX13 — 2 vCPU / 8 GB / 80 GB SSD) — postgres + redis
   - `htz-staging-1` (CX22 — 2 vCPU / 4 GB / 40 GB SSD) — staging full stack
4. **Update `inventories/staging/hosts.yml`** với IP public từng VPS
5. **Chạy `ansible-playbook playbooks/staging.yml`** từ CI hoặc local

## Tạo qua hcloud CLI (recommended)

```bash
# Install: brew install hcloud
hcloud context create saas-checkin
# → paste API token

# SSH key (upload 1 lần)
hcloud ssh-key create --name ansible --public-key-from-file ~/.ssh/ansible_id_rsa.pub

# Tạo VPS
hcloud server create --name htz-staging-1 --type cx22 --image ubuntu-24.04 \
  --location fsn1 --ssh-key ansible
hcloud server create --name htz-app-1 --type ccx23 --image ubuntu-24.04 \
  --location fsn1 --ssh-key ansible
hcloud server create --name htz-db-1 --type ccx13 --image ubuntu-24.04 \
  --location fsn1 --ssh-key ansible
```

## Cost estimate (monthly)

- CCX23 (4 vCPU, 16GB): ~€15
- CCX13 (2 vCPU, 8GB): ~€8
- CX22 (2 vCPU, 4GB): ~€4
- Total: ~€27/month cho 3 VPS

Phase 0: chỉ staging (htz-staging-1) ~€4. App + DB chỉ tạo khi cần scale.
