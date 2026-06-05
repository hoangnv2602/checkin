# infra/cloudflare/ — Phase 0 placeholder (I-019)

> Cloudflare setup cho 3 subdomain: `web.*`, `admin.*`, `api.*`.
> **CẦN domain đã mua** (vd `saas-checkin.com` qua Cloudflare Registrar hoặc external).

## Workflow

1. **Thêm domain** vào Cloudflare account
2. **DNS records** (proxied = orange cloud):
   ```
   web.saas-checkin.com       CNAME  htz-staging-1.IP_OR_CNAME
   admin.saas-checkin.com     CNAME  htz-staging-1.IP_OR_CNAME
   api.saas-checkin.com       CNAME  htz-staging-1.IP_OR_CNAME
   ```
3. **SSL/TLS:** Full (Strict)
4. **WAF:** bật free rules + custom rule IP allowlist cho `admin.*`:
   ```
   (http.host eq "admin.saas-checkin.com" and not ip.src in $office_ips)
   ```
5. **Rate limiting:** 100 req/min cho `/api/*` paths

## Phase 0 status

- [x] Document workflow
- [ ] Thực hiện khi có domain thật
