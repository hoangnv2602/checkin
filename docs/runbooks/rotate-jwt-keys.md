# Runbook: Rotate JWT signing keys

Thay key RSA signing JWT định kỳ (Phase 7 security review) hoặc khi compromise.

## Steps

```bash
# 1. SSH htz-app-1
ssh htz-app-1

# 2. Generate new RSA key
cd /etc/api-gateway/keys
openssl genpkey -algorithm RSA -out saas_jwt_new.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in saas_jwt_new.pem -pubout -out saas_jwt_new.pub

# 3. Add to JWKS alongside old key (grace period 24h)
#    Update api-gateway env: JWT_PUBLIC_KEYS=[new_pub, old_pub]
sudo systemctl edit api-gateway
#    [Service]
#    Environment="JWT_PUBLIC_KEYS=new_pub,old_pub"
sudo systemctl restart api-gateway

# 4. Wait 24h for token cache to expire
sleep 86400

# 5. Remove old key
sudo systemctl edit api-gateway
#    Environment="JWT_PUBLIC_KEYS=new_pub"
sudo systemctl restart api-gateway

# 6. Verify tokens signed with new key
curl -fsS -X POST http://localhost:5050/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.access_token' \
  | cut -d. -f1 | base64 -d | jq .iss
```

## Verify on staging first

```bash
# Test trên staging
ssh htz-staging-1
# ... same steps
# Login, hit /v1/identity/whoami, verify 200
```
