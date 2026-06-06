# Runbook: Add new VPS

Thêm 1 VPS mới vào Hetzner pool (cho scale hoặc thay thế).

## Steps

```bash
# 1. Tạo VPS qua Hetzner Cloud Console
#    Type: CCX23 (compute) hoặc CX22 (staging)
#    OS: Ubuntu 24.04
#    Location: fsn1 / nbg1 (match existing)

# 2. Add SSH key
#    Copy từ existing VPS: scp ~/.ssh/id_ed25519.pub root@new-vps:/root/.ssh/authorized_keys

# 3. Set hostname
ssh root@new-vps "hostnamectl set-hostname htz-app-N && echo '127.0.0.1 htz-app-N' >> /etc/hosts"

# 4. Run common playbook
cd infra/ansible
ansible-playbook -i inventories/staging/hosts playbooks/common.yml --limit htz-app-N

# 5. Run app-specific playbook
ansible-playbook -i inventories/staging/hosts playbooks/app.yml --limit htz-app-N

# 6. Update load balancer
#    Caddy upstream: thêm IP mới vào /etc/caddy/Caddyfile
ssh htz-app-1 "systemctl reload caddy"
```

## Verify

```bash
ssh htz-app-N
docker ps
curl -fsS http://localhost:3000/api/health
```

## Update inventory

```bash
# infra/ansible/inventories/staging/hosts
[app]
htz-app-1 ansible_host=...
htz-app-N ansible_host=NEW_IP
```
