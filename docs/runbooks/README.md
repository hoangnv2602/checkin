# Runbooks

Tổng hợp các runbook vận hành production. Mỗi runbook giải quyết một tình huống cụ thể, có step-by-step + verification.

## Mục lục

| Runbook | Khi nào dùng |
|---------|--------------|
| [initial-deploy](initial-deploy.md) | Lần đầu deploy stack lên VPS mới. |
| [add-new-vps](add-new-vps.md) | Scale horizontal — thêm VPS vào load balancer. |
| [db-restore](db-restore.md) | Khôi phục database từ backup (PITR hoặc snapshot). |
| [rotate-jwt-keys](rotate-jwt-keys.md) | Rotate cặp RS256 key (access token signing). |
| [incident-response](incident-response.md) | Quy trình chung khi có sự cố P0/P1. |

## Conventions

- Mỗi runbook có format: **Trigger** → **Pre-conditions** → **Steps** → **Verification** → **Rollback**.
- Commands giả định SSH access tới production VPS (`ssh deploy@<vps>`).
- Tất cả secrets lấy từ `doppler secrets` hoặc `ansible-vault`, KHÔNG echo raw value ra terminal.
- Sau mỗi thay đổi infra, ghi incident log vào `#ops` Slack channel.

## Liên hệ

- Incident on-call: rotation list tại PagerDuty schedule `platform-oncall`
- Slack: `#ops-incidents` (P0/P1) / `#ops-general` (P2+)
- Escalation: Tech lead → CTO
