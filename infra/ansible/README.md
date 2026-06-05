# infra/ansible/ — Phase 0 skeleton (I-018)

> Ansible playbooks để provision Hetzner VPS.
> **Phase 0:** scaffold + placeholder hosts. **Phase 0+ (I-017):** chạy thật sau khi tạo Hetzner project.

## Layout

```
infra/ansible/
├── ansible.cfg                      # default inventory + SSH settings
├── inventories/
│   ├── staging/hosts.yml            # 3 VPS placeholder IPs
│   └── production/hosts.yml         # empty — sẽ fill sau staging smoke test
├── playbooks/
│   ├── common.yml                   # Docker, UFW, fail2ban, user ansible
│   ├── db.yml                       # Postgres + Redis + pgBackRest
│   ├── app.yml                      # Caddy + docker-compose deploy
│   └── staging.yml                  # full stack
└── roles/                           # tùy chỉnh (Phase 1+)
```

## Quick start (sau I-017)

```bash
cd infra/ansible
ansible-galaxy install geerlingguy.docker

# Verify connectivity
ansible all -m ping

# Provision tất cả
ansible-playbook playbooks/staging.yml
```

## Required Ansible collections

- `community.docker` (docker_compose_v2)
- `community.general` (ufw)
- `geerlingguy.docker` (Docker install)
- `community.crypto` (SSH keys)
