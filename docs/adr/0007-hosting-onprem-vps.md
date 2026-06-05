# 0007. Hosting: on-prem / VPS (Hetzner)

- **Status:** Accepted (D6)
- **Date:** 2026-06-04

## Context

Ba lựa chọn cho production hosting:
- **Managed cloud (AWS / GCP / Azure)** — HA turnkey, nhưng đắt gấp ~2.5× so với tự quản
- **PaaS (Fly.io / Render / Railway)** — deploy dễ, nhưng control hạn chế và có thể không có region VN
- **Self-managed VPS (Hetzner / DigitalOcean / OVH)** — full control, chi phí thấp nhất, nhiều công sức vận hành hơn

Budget ban đầu chật; team quen Linux + Docker; data residency ở EU chấp nhận được; audience mục tiêu là VN + khu vực (một region ổn ở MVP).

## Decision

Host trên **Hetzner Cloud VPS** với **Docker Compose** (không Kubernetes ở MVP) và **Ansible** cho provisioning.

- 3 VPS: `htz-app-1` (CCX23), `htz-db-1` (CCX13), `htz-staging-1` (CX22)
- Hetzner Volume cho dữ liệu Postgres, Hetzner Storage Box cho backup
- Caddy reverse proxy + Let's Encrypt + HTTP/3
- Cloudflare proxy + free WAF rule ở phía trước
- GH Actions → build image → push GHCR → SSH deploy

Chi phí ước tính: **~120 USD / tháng** ở scale MVP (~1k MAU), so với ~290 USD cho managed cloud.

## Consequences

### Positive
- Chi phí thấp nhất; bill hàng tháng dự đoán được.
- Full control: kernel tuning, cấu hình Postgres, network policy.
- Portable: khi chuyển sang AWS, image container + file compose vẫn dùng được.
- Data residency EU mặc định; Hetzner có region SG/VN nếu cần.

### Negative
- Một region (không HA xuyên DC ở MVP). Chấp nhận được vì RTO target là 4 giờ.
- Công sức vận hành: security patch, verify backup, capacity planning đều do team.
- Postgres là single instance (không streaming replica ở MVP). Giảm thiểu bằng WAL streaming về Storage Box.
- Nếu Hetzner có outage vùng, không có chỗ fail over.

### Neutral
- Cloudflare ở phía trước nghĩa là hầu hết DDoS được hấp thụ ở edge.
- Ansible playbook commit trong `infra/ansible/`; onboard VPS mới tốn ~15 phút.

## Alternatives considered

- **AWS ECS / EKS** — chắc chắn nhưng đắt hơn; team sẽ vừa làm vừa học (overhead).
- **Fly.io** — DX hấp dẫn nhưng pricing theo region và control hạn chế cho Postgres HA.
- **On-prem tại văn phòng** — không có redundancy điện/cooling; bị loại.

## Trigger migrate

- > 5k MAU hoặc sustained > 70% CPU trên bất kỳ VPS → tách ra app node thứ 3.
- Yêu cầu HA (multi-AZ) → chuyển Postgres sang managed (RDS / Cloud SQL).
- Khiếu nại latency VN → thêm `htz-app-sg` (Singapore) và route user VN qua GeoDNS.
- Compliance (PCI, HIPAA) → chuyển AWS với segmentation đúng chuẩn.

## Security baseline

- SSH key-only, không root, không password
- UFW: 22, 80, 443
- fail2ban cho SSH
- Scan image container (Trivy) mỗi build
- Dependabot + audit
- Ansible Vault cho secret trong repo
- LUKS trên Hetzner Volume cho data at rest
