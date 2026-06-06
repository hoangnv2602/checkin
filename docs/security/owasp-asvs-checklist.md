# OWASP ASVS 4.0 L2 Security Review Checklist (I-701)

Phase 7 pre-launch security gate. Run **mỗi release lớn** hoặc trước khi ship production.

## V1: Architecture

- [ ] Threat model updated (data flow + trust boundaries)
- [ ] Security controls documented in ADR
- [ ] Dependency tree scanned (`npm audit`, `dotnet list package --vulnerable`, `dart pub outdated`)
- [ ] Third-party JS chỉ load qua SRI hash
- [ ] No high/critical CVE trong deps

## V2: Authentication

- [ ] Custom JWT RS256 only, no NextAuth / Passport-local (D5)
- [ ] Refresh token rotated mỗi lần dùng
- [ ] Password min 12 chars, BCrypt cost 12+
- [ ] Failed login lockout sau 5 attempts trong 15 phút
- [ ] MFA TOTP bắt buộc cho checkin-admin (I-108)
- [ ] JWT `aud` claim distinct per audience (tenant-web / checkin-admin / mobile)
- [ ] No JWT in localStorage — chỉ httpOnly cookies

## V3: Session Management

- [ ] Session token entropy ≥ 128 bits
- [ ] Session timeout: 15 phút access, 30 ngày refresh
- [ ] Logout invalidates refresh token ngay
- [ ] CSRF token ở form mutations (SameSite=Strict)
- [ ] CORS chỉ allow explicit origins

## V4: Access Control

- [ ] RBAC matrix documented (Owner/Admin/Organizer/Staff/Viewer)
- [ ] Permission check ở mỗi use case handler (PermissionBehavior<,>)
- [ ] checkin-admin app isolated audience + BFF + Postgres role
- [ ] No IDOR: tất cả query có organization_id filter
- [ ] Plan limit enforcer ở mutate paths

## V5: Validation, Sanitization, Encoding

- [ ] All input validated ở BFF (class-validator / zod)
- [ ] SQL queries dùng parameterized (EF Core / Drizzle)
- [ ] HTML output escaped (React default)
- [ ] URL params validated
- [ ] File upload (Phase 6+): mime check, size limit, scan

## V6: Cryptography

- [ ] TLS 1.2+ only (Cloudflare SSL Full Strict)
- [ ] No custom crypto — chỉ dùng audited libs
- [ ] Ed25519 cho QR signing (NSec)
- [ ] AES-GCM cho at-rest encryption
- [ ] Key rotation runbook tested (rotate-jwt-keys.md)

## V7: Error Handling & Logging

- [ ] No stack traces ở prod response
- [ ] Generic error message cho user
- [ ] Sentry captures full context nhưng redact PII
- [ ] Audit log immutable (INSERT-only)
- [ ] No secrets ở logs (Stripe keys, JWT secrets)

## V8: Data Protection

- [ ] PII encrypted at rest (DB-level)
- [ ] Backups encrypted
- [ ] Data retention policy documented
- [ ] GDPR right-to-delete implemented
- [ ] Email/SMS opt-in explicit

## V9: Communications

- [ ] HSTS enabled
- [ ] CSP header configured
- [ ] X-Frame-Options DENY
- [ ] Referrer-Policy strict-origin-when-cross-origin
- [ ] Permissions-Policy minimal

## V10: Malicious Code

- [ ] No eval / new Function
- [ ] No innerHTML without sanitization
- [ ] No unsafe-eval in CSP
- [ ] npm packages signed (npm@8+ default)
- [ ] Container images scanned (Trivy) — see I-701 step 4

## V11: Business Logic

- [ ] Discount code không dùng nhiều lần (max_redemptions)
- [ ] Order pending timeout 10 phút enforced
- [ ] Plan limit ở mỗi mutate, không chỉ UI
- [ ] Race conditions covered (SELECT FOR UPDATE, partial unique index)
- [ ] Idempotency key cho webhook handlers

## V12: File & Resources

- [ ] File upload size limit (10MB cho QR, 5MB cho avatar)
- [ ] Mime type whitelist
- [ ] No path traversal ở file serving
- [ ] S3 bucket private ACL (signed URL 15 min expiry)

## V13: API & Web Service

- [ ] Rate limit ở BFF (token bucket per IP/user)
- [ ] OpenAPI 3.1 spec, validate inbound
- [ ] No GraphQL (D7)
- [ ] Webhook signatures verify (Stripe-Signature, vnp_SecureHash)

## V14: Configuration

- [ ] No default credentials
- [ ] Secrets qua Doppler / Ansible Vault (D6)
- [ ] .env.example tracked, .env ignored
- [ ] Production debug = false
- [ ] Health endpoints không leak version info

## Pen-test manual probes (mỗi release)

- [ ] SQLi: `' OR 1=1 --` trên mọi input
- [ ] XSS: `<script>alert(1)</script>` ở form fields
- [ ] CSRF: POST without token
- [ ] IDOR: GET /v1/events/{otherTenantId}
- [ ] Auth bypass: skip auth header, expired token
- [ ] Rate limit: 1000 req/s từ 1 IP
- [ ] JWT confusion: kid='../../etc/passwd'
- [ ] Path traversal: GET /v1/files/../../etc/shadow

## Container scan (Trivy)

```bash
# Trên CI hoặc local
trivy image ghcr.io/<org>/api-gateway:dev
trivy image ghcr.io/<org>/core-api:dev
trivy image ghcr.io/<org>/web:dev
trivy image ghcr.io/<org>/checkin-admin:dev
trivy image ghcr.io/<org>/mobile:dev  # nếu build container
```

Pass criteria: 0 CRITICAL, 0 HIGH. MEDIUM/LOW đánh dấu + fix trong sprint tiếp.

## Sign-off

| Reviewer | Role | Date | Status |
|----------|------|------|--------|
| Tech lead | Architecture | ___ | ☐ |
| Security eng | Pentest | ___ | ☐ |
| DevOps | Infra | ___ | ☐ |
| Product | GDPR/privacy | ___ | ☐ |
