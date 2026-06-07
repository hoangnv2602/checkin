# Privacy policy (I-705)

> **Status:** template. Cần legal review trước khi publish. Host tại
> `https://saas-checkin.com/privacy` (sẽ serve từ `apps/web/src/app/(marketing)/privacy/page.tsx`).

## Plain-language template

**SaasCheckin** is a multi-tenant event check-in platform. This policy
explains what data we collect, how we use it, and your rights.

### Data we collect

- **Account** — your email, name, organization name (provided at signup).
- **Events** — event metadata you create (name, venue, dates, ticket types).
- **Registrations** — attendee email, name, ticket type, payment status
  (entered by event organizers or attendees at registration).
- **Check-in records** — timestamp + gate of each scan (event staff only).
- **Usage** — IP address, user agent, audit log (security + debugging).

### How we use data

- **Provide the service** — process check-ins, send registration emails,
  compute event statistics.
- **Billing** — Stripe handles all payment data; we never store card numbers.
- **Security** — detect fraud, prevent abuse, investigate incidents.
- **Improvement** — aggregated, anonymized metrics (no PII).

### Where data is stored

- **Postgres** (Hetzner VPS, encrypted at rest).
- **S3-compatible object storage** (MinIO, EU region).
- **Backups** — encrypted, 90-day retention, EU region only.

### Sub-processors

| Vendor | Purpose | Region |
|---|---|---|
| Stripe | Payment processing | US, EU |
| VNPay | Payment processing (VN) | VN |
| Resend | Transactional email | US |
| Sentry | Error tracking | US, EU |
| Hetzner | Hosting | EU (FSN1, NBG1) |

### Your rights (GDPR / CCPA)

- **Access** — request a copy of your data via `support@saas-checkin.com`.
- **Rectification** — edit most data in-app; contact us for the rest.
- **Erasure** — we delete your account + tenant data within 30 days.
- **Portability** — export events + registrations as JSON / CSV.
- **Object** — opt out of marketing emails (transactional cannot be opted out).

### Data retention

- **Active accounts** — kept while subscribed.
- **Cancelled accounts** — data deleted within 30 days.
- **Audit logs** — 7 years (regulatory requirement).
- **Backups** — 90 days, then overwritten.

### Security

- All data in transit: TLS 1.2+ (Cloudflare SSL Full Strict).
- All data at rest: AES-256 (provider-level + DB-level encryption).
- Access: least-privilege, RBAC (Owner/Admin/Organizer/Staff/Viewer).
- Audit: every privileged action logged in `audit_log`.

### Cookies

- **Essential** — `sa_access_token`, `sa_refresh_token` (httpOnly, SameSite=Strict).
- **Analytics** — none (we use Sentry for crash reporting only).

### Children

SaasCheckin is a B2B platform, not directed at children under 16. We do
not knowingly collect data from children.

### Changes to this policy

We will notify you 30 days before any material change via email + in-app
banner. Continued use after the effective date constitutes acceptance.

### Contact

- **Data Protection Officer:** dpo@saas-checkin.com
- **General:** support@saas-checkin.com
- **Postal:** [registered address — fill in at incorporation]

## Legal review checklist (before publish)

- [ ] Legal counsel sign-off (consultant or in-house)
- [ ] DPA template (Data Processing Agreement) available for Enterprise customers
- [ ] Sub-processor list current
- [ ] Cookie banner match actual cookies used
- [ ] Cross-link Terms of Service
- [ ] Effective date stamped
