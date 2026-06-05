# Tài liệu Database Schema

> **Mục đích file:** reference đầy đủ DDL để review. Thiết kế tổng quan ở [`05-database.md`](./05-database.md); file này là **nguồn DDL chi tiết** cho từng bảng theo bounded context.
>
> **Stack:** PostgreSQL 16, extensions `pgcrypto`, `citext`, `pg_stat_statements`.
> **Tenancy:** row-level + RLS (ADR-0003). Mọi bảng nghiệp vụ đều có `tenant_id UUID NOT NULL` + `ENABLE + FORCE ROW LEVEL SECURITY`.
> **Soft-delete:** không dùng cột `deleted_at`; aggregate tự quản lý trạng thái qua `status`, `cancelled_at`, `revoked_at`.
> **Audit fields:** `created_at`, `updated_at` (tự động). Một số bảng thêm `created_by`, `updated_by` (UUID → `users.id`).

---

## 1. Quy ước chung

| Quy tắc | Giá trị |
|---|---|
| Khóa chính | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| Khóa ngoại | `<entity>_id UUID NOT NULL REFERENCES <table>(id)` |
| Timestamps | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| Email | `CITEXT NOT NULL` (không phân biệt hoa/thường) |
| Tiền tệ | số nguyên **cents** (BIGINT) + cột `currency CHAR(3)` riêng; không dùng `MONEY`/`NUMERIC` cho business field |
| JSON | `JSONB NOT NULL` (mặc định `'{}'::jsonb`) |
| Tên bảng | snake_case, số ít |
| Tên index | `idx_<tbl>_<tenant>_<cols>` hoặc `uq_<tbl>_<cols>` |
| RLS | `ENABLE` + `FORCE` + 1 policy `tenant_isolation` |
| Enum | đặt ở đầu file, dùng chung |

```sql
-- Bật extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
```

---

## 2. ENUMs (dùng chung)

```sql
-- Identity & Tenancy
CREATE TYPE membership_role     AS ENUM ('owner','admin','organizer','staff','viewer');
CREATE TYPE invitation_status   AS ENUM ('pending','accepted','expired','revoked');

-- Event Management
CREATE TYPE event_status        AS ENUM ('draft','published','live','ended','cancelled');
CREATE TYPE session_status       AS ENUM ('scheduled','live','ended','cancelled');

-- Ticketing
CREATE TYPE ticket_type_status  AS ENUM ('active','paused','archived');
CREATE TYPE discount_kind       AS ENUM ('percent','fixed_amount');
CREATE TYPE order_status        AS ENUM ('pending','paid','failed','refunded','cancelled');
CREATE TYPE registration_status AS ENUM ('issued','revoked','refunded');

-- Check-in
CREATE TYPE checkin_status      AS ENUM ('success','rejected','duplicate');

-- Billing
CREATE TYPE plan_interval       AS ENUM ('monthly','yearly');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','cancelled','expired');
CREATE TYPE payment_provider    AS ENUM ('stripe','vnpay');
CREATE TYPE payment_status      AS ENUM ('pending','succeeded','failed','refunded');
CREATE TYPE invoice_status      AS ENUM ('draft','open','paid','void','uncollectible');

-- Notification
CREATE TYPE notification_channel AS ENUM ('email','sms');
CREATE TYPE notification_status AS ENUM ('queued','sent','failed','bounced');

-- Webhooks
CREATE TYPE webhook_direction   AS ENUM ('inbound','outbound');
```

---

## 3. Hạ tầng ngang (cross-cutting)

> Các bảng ngang, KHÔNG thuộc aggregate nghiệp vụ nào. Hầu hết có RLS, trừ `jwks_keys`.

### 3.1 `organizations` (bảng tenant gốc — KHÔNG RLS)

```sql
CREATE TABLE organizations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug               VARCHAR(60)  NOT NULL UNIQUE,             -- /[orgSlug] URL segment
    name               VARCHAR(200) NOT NULL,
    default_locale     VARCHAR(10)  NOT NULL DEFAULT 'en',
    default_currency   CHAR(3)      NOT NULL DEFAULT 'USD',
    timezone           VARCHAR(60)  NOT NULL DEFAULT 'UTC',
    trial_ends_at      TIMESTAMPTZ,
    suspended_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_org_slug ON organizations(LOWER(slug));
```

### 3.2 `org_settings` (cấu hình riêng từng tenant)

```sql
CREATE TABLE org_settings (
    tenant_id            UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    default_provider     payment_provider NOT NULL DEFAULT 'stripe',
    enabled_providers    payment_provider[] NOT NULL DEFAULT '{stripe}',
    qr_signing_key_id    VARCHAR(64),                            -- FK logic tới jwks_keys.id (không FK cứng vì global)
    branding             JSONB NOT NULL DEFAULT '{}'::jsonb,     -- logo url, override màu primary
    notify_from_email    VARCHAR(254),
    notify_from_sms      VARCHAR(40),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON org_settings
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 3.3 `outbox_events` (publish domain event ít-nhất-một-lần)

```sql
CREATE TABLE outbox_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    aggregate_type VARCHAR(80)  NOT NULL,    -- 'Registration', 'Order', 'Subscription', ...
    aggregate_id   UUID         NOT NULL,
    event_type     VARCHAR(120) NOT NULL,    -- 'TicketIssued', 'OrderPaid', ...
    payload        JSONB        NOT NULL,
    occurred_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ,
    attempts       INT          NOT NULL DEFAULT 0,
    last_error     TEXT
);
CREATE INDEX idx_outbox_unpublished
    ON outbox_events(occurred_at)
    WHERE published_at IS NULL;
CREATE INDEX idx_outbox_tenant_aggregate
    ON outbox_events(tenant_id, aggregate_type, aggregate_id);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON outbox_events
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 3.4 `idempotency_keys`

```sql
CREATE TABLE idempotency_keys (
    tenant_id     UUID         NOT NULL,
    key           VARCHAR(120) NOT NULL,    -- header Idempotency-Key client gửi
    request_hash  CHAR(64)     NOT NULL,    -- sha256 của body
    response_code SMALLINT,
    response_body JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, key)
);
CREATE INDEX idx_idem_created ON idempotency_keys(tenant_id, created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON idempotency_keys
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 3.5 `audit_log` (hành động bảo mật + admin)

```sql
CREATE TYPE audit_category AS ENUM ('auth','admin','billing','data','security');

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    actor_id    UUID,                                  -- users.id; null = hệ thống
    category    audit_category NOT NULL,
    action      VARCHAR(80)  NOT NULL,                 -- 'login','password_change','plan_upgraded', ...
    target_type VARCHAR(80),                           -- 'User','Subscription','Event'
    target_id   UUID,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,    -- ip, user-agent, diff
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_time   ON audit_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_tenant_target ON audit_log(tenant_id, target_type, target_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

> Chỉ ghi thêm (append-only): không có `updated_at`; thu hồi quyền `UPDATE/DELETE` ở tầng app role.

### 3.6 `jwks_keys` (xoay vòng khóa ký — global, KHÔNG RLS)

```sql
CREATE TABLE jwks_keys (
    id           VARCHAR(64) PRIMARY KEY,                -- kid
    alg          VARCHAR(10)  NOT NULL,                 -- 'RS256' / 'Ed25519'
    purpose      VARCHAR(20)  NOT NULL,                 -- 'jwt' | 'qr'
    public_jwk   JSONB        NOT NULL,
    private_pem  TEXT,                                  -- null sau khi rotate-out
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    rotated_out_at TIMESTAMPTZ
);
CREATE INDEX idx_jwks_active ON jwks_keys(purpose, is_active) WHERE is_active = TRUE;
```

### 3.7 `webhook_endpoints` + `webhook_events`

```sql
-- Webhook đi (org subscribe các event của platform)
CREATE TABLE webhook_endpoints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    url         TEXT NOT NULL,
    secret      VARCHAR(80) NOT NULL,                    -- HMAC key (server generate)
    events      TEXT[] NOT NULL,                        -- ['TicketIssued','OrderPaid',...]
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wh_ep_tenant ON webhook_endpoints(tenant_id) WHERE is_active = TRUE;

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON webhook_endpoints
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Webhook đến từ provider (Stripe / VNPay) — lưu để replay + debug
CREATE TABLE webhook_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID,                                  -- nullable vì đôi lúc IPN chưa map được tenant
    provider     payment_provider NOT NULL,
    external_id  VARCHAR(120) NOT NULL,                  -- Stripe event id / vnp_TxnRef
    direction    webhook_direction NOT NULL DEFAULT 'inbound',
    event_type   VARCHAR(80) NOT NULL,
    payload      JSONB NOT NULL,
    signature_ok BOOLEAN NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    UNIQUE (provider, external_id)
);
CREATE INDEX idx_wh_evt_tenant_unproc
    ON webhook_events(tenant_id, received_at DESC)
    WHERE processed_at IS NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON webhook_events
    USING      (tenant_id IS NULL
                OR tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id IS NULL
                OR tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 4. Identity & Tenancy

### 4.1 `users` (global, KHÔNG RLS — định danh user tách khỏi tenancy)

```sql
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             CITEXT UNIQUE NOT NULL,
    email_verified_at TIMESTAMPTZ,
    full_name         VARCHAR(200) NOT NULL,
    password_hash     TEXT,                             -- null nếu chỉ login qua OAuth/SSO (phase 2+)
    avatar_url        TEXT,
    locale            VARCHAR(10),
    last_login_at     TIMESTAMPTZ,
    locked_until      TIMESTAMPTZ,                      -- khóa sau 5 lần fail (ADR-0004)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 `memberships` (user ↔ org, có RLS)

```sql
CREATE TABLE memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        membership_role NOT NULL DEFAULT 'staff',
    invited_by  UUID REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_member_tenant_role
    ON memberships(tenant_id, role) WHERE revoked_at IS NULL;
CREATE INDEX idx_member_user
    ON memberships(user_id) WHERE revoked_at IS NULL;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 4.3 `invitations`

```sql
CREATE TABLE invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    email       CITEXT NOT NULL,
    role        membership_role NOT NULL,
    token_hash  CHAR(64) NOT NULL UNIQUE,               -- sha256(token); token chỉ gửi qua email
    invited_by  UUID NOT NULL REFERENCES users(id),
    status      invitation_status NOT NULL DEFAULT 'pending',
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email, status) DEFERRABLE INITIALLY DEFERRED  -- 1 pending/email
);
CREATE INDEX idx_inv_tenant_status ON invitations(tenant_id, status);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invitations
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 4.4 `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwd_tenant_user ON password_reset_tokens(tenant_id, user_id);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON password_reset_tokens
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 4.5 `email_verifications`

```sql
CREATE TABLE email_verifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID,                                   -- null khi user chưa thuộc org nào
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email   CITEXT NOT NULL,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON email_verifications
    USING      (tenant_id IS NULL
                OR tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id IS NULL
                OR tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 5. Event Management

### 5.1 `venues`

```sql
CREATE TABLE venues (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        VARCHAR(200) NOT NULL,
    address     TEXT,
    city        VARCHAR(120),
    country     CHAR(2),                                -- ISO-3166-1 alpha-2
    geo         POINT,                                  -- (lon, lat)
    timezone    VARCHAR(60) NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_venues_tenant ON venues(tenant_id);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON venues
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 5.2 `events`

```sql
CREATE TABLE events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    venue_id      UUID NOT NULL REFERENCES venues(id),
    title         VARCHAR(200) NOT NULL,
    slug          VARCHAR(120) NOT NULL,                -- unique trong (tenant, slug)
    description   TEXT,
    cover_url     TEXT,
    start_at      TIMESTAMPTZ NOT NULL,
    end_at        TIMESTAMPTZ NOT NULL,
    timezone      VARCHAR(60) NOT NULL,                 -- snapshot venue.timezone
    capacity      INT NOT NULL CHECK (capacity > 0),
    status        event_status NOT NULL DEFAULT 'draft',
    public        BOOLEAN NOT NULL DEFAULT FALSE,       -- liệt kê trên /e/...
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at  TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,
    CHECK (start_at < end_at),
    UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_events_tenant_status ON events(tenant_id, status);
CREATE INDEX idx_events_tenant_start  ON events(tenant_id, start_at DESC);
CREATE INDEX idx_events_tenant_pub    ON events(tenant_id, start_at)
    WHERE status IN ('published','live') AND public = TRUE;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON events
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 5.3 `sessions` (sub-event / khung giờ của event)

```sql
CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    start_at    TIMESTAMPTZ NOT NULL,
    end_at      TIMESTAMPTZ NOT NULL,
    capacity    INT CHECK (capacity IS NULL OR capacity > 0),
    status      session_status NOT NULL DEFAULT 'scheduled',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_at < end_at)
);
CREATE INDEX idx_sessions_tenant_event ON sessions(tenant_id, event_id, start_at);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sessions
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 5.4 `gates` (cổng vào của venue)

```sql
CREATE TABLE gates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    code        VARCHAR(40)  NOT NULL,                  -- mã ngắn staff dùng khi login
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue_id, code)
);
CREATE INDEX idx_gates_tenant_venue ON gates(tenant_id, venue_id) WHERE is_active = TRUE;

ALTER TABLE gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gates
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 6. Registration & Ticketing

### 6.1 `ticket_types`

```sql
CREATE TABLE ticket_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    price_cents     BIGINT NOT NULL CHECK (price_cents >= 0),
    currency        CHAR(3) NOT NULL,
    quantity_total  INT NOT NULL CHECK (quantity_total > 0),
    quantity_sold   INT NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
    sale_starts_at  TIMESTAMPTZ,
    sale_ends_at    TIMESTAMPTZ,
    min_per_order   INT NOT NULL DEFAULT 1 CHECK (min_per_order > 0),
    max_per_order   INT NOT NULL DEFAULT 10 CHECK (max_per_order >= min_per_order),
    status          ticket_type_status NOT NULL DEFAULT 'active',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (quantity_sold <= quantity_total),
    CHECK (sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_starts_at < sale_ends_at)
);
CREATE INDEX idx_tt_tenant_event ON ticket_types(tenant_id, event_id) WHERE status = 'active';

ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ticket_types
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 6.2 `discount_codes`

```sql
CREATE TABLE discount_codes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    event_id          UUID REFERENCES events(id) ON DELETE CASCADE,  -- null = dùng cho cả tenant
    code              VARCHAR(60) NOT NULL,
    kind              discount_kind NOT NULL,
    amount            INT NOT NULL CHECK (amount >= 0),              -- % (0–100) hoặc cents
    max_redemptions   INT CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    redeemed_count    INT NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
    expires_at        TIMESTAMPTZ,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, event_id, code),
    CHECK (kind <> 'percent' OR amount <= 100)
);
CREATE INDEX idx_disc_tenant_event ON discount_codes(tenant_id, event_id) WHERE is_active = TRUE;

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON discount_codes
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 6.3 `orders`

```sql
CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    event_id            UUID NOT NULL REFERENCES events(id),
    buyer_email         CITEXT NOT NULL,
    buyer_name          VARCHAR(200) NOT NULL,
    status              order_status NOT NULL DEFAULT 'pending',
    subtotal_cents      BIGINT NOT NULL CHECK (subtotal_cents >= 0),
    discount_cents      BIGINT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
    tax_cents           BIGINT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    total_cents         BIGINT NOT NULL CHECK (total_cents >= 0),
    currency            CHAR(3) NOT NULL,
    discount_code_id    UUID REFERENCES discount_codes(id),
    provider            payment_provider,                              -- set khi tạo PaymentIntent
    provider_session_id VARCHAR(200),                                  -- Stripe cs_ / VNPay txn
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at          TIMESTAMPTZ NOT NULL,                          -- pending TTL ~15 phút
    paid_at             TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (total_cents = subtotal_cents - discount_cents + tax_cents)
);
CREATE INDEX idx_orders_tenant_event_status ON orders(tenant_id, event_id, status);
CREATE INDEX idx_orders_tenant_buyer        ON orders(tenant_id, buyer_email);
CREATE INDEX idx_orders_pending_expiry
    ON orders(expires_at) WHERE status = 'pending';

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 6.4 `order_items`

```sql
CREATE TABLE order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    ticket_type_id    UUID NOT NULL REFERENCES ticket_types(id),
    quantity          INT NOT NULL CHECK (quantity > 0),
    unit_price_cents  BIGINT NOT NULL CHECK (unit_price_cents >= 0),
    line_total_cents  BIGINT NOT NULL CHECK (line_total_cents >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (line_total_cents = unit_price_cents * quantity)
);
CREATE INDEX idx_oi_tenant_order ON order_items(tenant_id, order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 6.5 `registrations` (attendee + QR — bám sát `05-database.md`)

```sql
CREATE TABLE registrations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    event_id       UUID NOT NULL REFERENCES events(id),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
    order_id       UUID REFERENCES orders(id),
    attendee_email CITEXT NOT NULL,
    attendee_name  VARCHAR(200) NOT NULL,
    qr_payload     JSONB NOT NULL,                      -- {regId, eventId, issuedAt, exp, jti}
    qr_signature   BYTEA NOT NULL,                      -- chữ ký Ed25519 (64 bytes)
    qr_image_url   TEXT,                                -- URL S3/MinIO render PNG (worker I-304)
    jti            UUID NOT NULL UNIQUE,                -- single-use cho scan
    status         registration_status NOT NULL DEFAULT 'issued',
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at     TIMESTAMPTZ,
    refunded_at    TIMESTAMPTZ
);
CREATE INDEX idx_reg_tenant_event  ON registrations(tenant_id, event_id);
CREATE INDEX idx_reg_tenant_email  ON registrations(tenant_id, attendee_email);
CREATE INDEX idx_reg_tenant_status ON registrations(tenant_id, status);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON registrations
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 7. Check-in (chỉ ghi thêm, append-only)

```sql
CREATE TABLE check_in_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    registration_id UUID NOT NULL REFERENCES registrations(id),
    event_id        UUID NOT NULL,
    gate_id         UUID NOT NULL REFERENCES gates(id),
    scanned_by      UUID NOT NULL REFERENCES users(id),
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          checkin_status NOT NULL,
    reason          VARCHAR(100),                        -- 'already_checked_in','bad_signature','event_not_live',...
    client_meta     JSONB                                -- thiết bị, geo, url ảnh
);
-- Chỉ 1 success / 1 registration (theo Phase 4)
CREATE UNIQUE INDEX uq_chk_one_success
    ON check_in_records(registration_id)
    WHERE status = 'success';
CREATE INDEX idx_chk_tenant_event_gate_time
    ON check_in_records(tenant_id, event_id, gate_id, scanned_at DESC);
CREATE INDEX idx_chk_tenant_status_time
    ON check_in_records(tenant_id, status, scanned_at DESC);

ALTER TABLE check_in_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON check_in_records
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- Append-only: app role chỉ được INSERT, không UPDATE/DELETE.
```

---

## 8. Billing

### 8.1 `plans` (catalog toàn cục — KHÔNG RLS)

```sql
CREATE TABLE plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(40) UNIQUE NOT NULL,      -- 'free','pro','enterprise'
    name                VARCHAR(120) NOT NULL,
    description         TEXT,
    price_cents         BIGINT NOT NULL CHECK (price_cents >= 0),
    currency            CHAR(3) NOT NULL,
    interval            plan_interval NOT NULL,
    trial_days          INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
    limits              JSONB NOT NULL,                  -- {max_events, max_attendees_per_month, max_staff_seats}
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_active ON plans(sort_order) WHERE is_active = TRUE;
```

### 8.2 `subscriptions`

```sql
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL UNIQUE,         -- 1 sub đang hoạt động / org
    plan_id                 UUID NOT NULL REFERENCES plans(id),
    status                  subscription_status NOT NULL,
    provider                payment_provider,             -- null khi ở free tier
    provider_subscription_id VARCHAR(200),                -- Stripe sub_ / tương đương VNPay
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    trial_ends_at           TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_tenant_status ON subscriptions(tenant_id, status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 8.3 `invoices`

```sql
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    subscription_id     UUID REFERENCES subscriptions(id),
    number              VARCHAR(40) UNIQUE NOT NULL,     -- 'INV-2026-000001'
    status              invoice_status NOT NULL DEFAULT 'draft',
    currency            CHAR(3) NOT NULL,
    subtotal_cents      BIGINT NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents           BIGINT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    total_cents         BIGINT NOT NULL CHECK (total_cents >= 0),
    amount_due_cents    BIGINT NOT NULL CHECK (amount_due_cents >= 0),
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at              TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    voided_at           TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_inv_tenant_status ON invoices(tenant_id, status);
CREATE INDEX idx_inv_tenant_due    ON invoices(tenant_id, due_at) WHERE status = 'open';

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 8.4 `invoice_items`

```sql
CREATE TABLE invoice_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description     VARCHAR(500) NOT NULL,
    quantity        INT NOT NULL CHECK (quantity > 0),
    unit_cents      BIGINT NOT NULL CHECK (unit_cents >= 0),
    amount_cents    BIGINT NOT NULL CHECK (amount_cents >= 0),
    period_start    TIMESTAMPTZ,
    period_end      TIMESTAMPTZ
);
CREATE INDEX idx_ii_tenant_invoice ON invoice_items(tenant_id, invoice_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice_items
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 8.5 `payments` (ghi nhận mọi lần charge — đa provider)

```sql
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    order_id            UUID REFERENCES orders(id),         -- null khi trả cho subscription
    subscription_id     UUID REFERENCES subscriptions(id),  -- null khi trả cho order
    invoice_id          UUID REFERENCES invoices(id),
    provider            payment_provider NOT NULL,
    provider_payment_id VARCHAR(200) NOT NULL,              -- Stripe pi_ / VNPay vnp_TransactionNo
    status              payment_status NOT NULL DEFAULT 'pending',
    amount_cents        BIGINT NOT NULL CHECK (amount_cents > 0),
    currency            CHAR(3) NOT NULL,
    fee_cents           BIGINT CHECK (fee_cents IS NULL OR fee_cents >= 0),
    net_cents           BIGINT,
    raw_response        JSONB,                              -- payload từ provider (đã mask PII)
    idempotency_key     VARCHAR(120),                       -- request key phía client (NULL nếu khởi phát từ webhook)
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    succeeded_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    failure_reason      VARCHAR(200),
    UNIQUE (provider, provider_payment_id)
);
CREATE INDEX idx_pay_tenant_status  ON payments(tenant_id, status);
CREATE INDEX idx_pay_tenant_order   ON payments(tenant_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_pay_tenant_invoice ON payments(tenant_id, invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 8.6 `payment_methods` (vault token, không lưu PAN)

```sql
CREATE TABLE payment_methods (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    provider                payment_provider NOT NULL,
    provider_payment_method_id VARCHAR(200) NOT NULL,       -- Stripe pm_ / token VNPay
    brand                   VARCHAR(40),                   -- 'visa','mcb',...
    last4                   CHAR(4),
    exp_month               SMALLINT CHECK (exp_month IS NULL OR exp_month BETWEEN 1 AND 12),
    exp_year                SMALLINT,
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_payment_method_id)
);
CREATE INDEX idx_pm_tenant ON payment_methods(tenant_id);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_methods
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 8.7 `usage_records` (đếm cho giới hạn plan)

```sql
CREATE TYPE usage_metric AS ENUM ('active_events','attendees_this_month','staff_seats');

CREATE TABLE usage_records (
    tenant_id   UUID NOT NULL,
    metric      usage_metric NOT NULL,
    period      CHAR(7) NOT NULL,                        -- 'YYYY-MM'
    value       BIGINT NOT NULL CHECK (value >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, metric, period)
);
CREATE INDEX idx_usage_tenant_period ON usage_records(tenant_id, period DESC);

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_records
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 9. Notification

### 9.1 `notification_templates`

```sql
CREATE TABLE notification_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    code        VARCHAR(80) NOT NULL,                    -- 'ticket_confirmation','payment_receipt'
    channel     notification_channel NOT NULL,
    subject     VARCHAR(500),                            -- null với SMS
    body        TEXT NOT NULL,                           -- Twig (email) hoặc plain (SMS)
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code, channel)
);
CREATE INDEX idx_nt_tenant ON notification_templates(tenant_id) WHERE is_active = TRUE;

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_templates
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 9.2 `notification_log` (chỉ ghi thêm)

```sql
CREATE TABLE notification_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    template_id  UUID REFERENCES notification_templates(id),
    channel      notification_channel NOT NULL,
    recipient    VARCHAR(254) NOT NULL,                  -- email hoặc số E.164
    payload      JSONB NOT NULL,                         -- biến đã render
    status       notification_status NOT NULL DEFAULT 'queued',
    provider_id  VARCHAR(200),                           -- Resend message id / Twilio sid
    error        TEXT,
    queued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at      TIMESTAMPTZ,
    bounced_at   TIMESTAMPTZ
);
CREATE INDEX idx_nl_tenant_time
    ON notification_log(tenant_id, queued_at DESC);
CREATE INDEX idx_nl_pending
    ON notification_log(queued_at) WHERE status = 'queued';

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_log
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 10. RLS — snippet tiện dụng

```sql
-- Helper: bật RLS + tạo policy tiêu chuẩn trong 1 lần (gọi sau CREATE TABLE)
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'org_settings','outbox_events','idempotency_keys','audit_log',
      'webhook_endpoints','memberships','invitations','password_reset_tokens',
      'venues','events','sessions','gates',
      'ticket_types','discount_codes','orders','order_items','registrations',
      'check_in_records',
      'subscriptions','invoices','invoice_items','payments','payment_methods','usage_records',
      'notification_templates','notification_log'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING      (tenant_id = current_setting(''app.tenant_id'', true)::uuid)
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t);
  END LOOP;
END $$;
```

---

## 11. Indexes — checklist tổng hợp

| Bảng | Index quan trọng (ngoài PK) |
|---|---|
| `organizations` | `uq_org_slug` (đã nằm trong UNIQUE) |
| `memberships` | `(tenant_id, role)`, `(user_id)` partial |
| `invitations` | `(tenant_id, status)` |
| `events` | `(tenant_id, status)`, `(tenant_id, start_at)`, partial public |
| `sessions` | `(tenant_id, event_id, start_at)` |
| `ticket_types` | `(tenant_id, event_id)` partial active |
| `discount_codes` | `(tenant_id, event_id)` partial active |
| `orders` | `(tenant_id, event_id, status)`, `(tenant_id, buyer_email)`, partial pending expiry |
| `order_items` | `(tenant_id, order_id)` |
| `registrations` | `(tenant_id, event_id)`, `(tenant_id, attendee_email)`, `(tenant_id, status)`, `uq jti` |
| `check_in_records` | partial one-success, `(tenant_id, event_id, gate_id, scanned_at)`, `(tenant_id, status, scanned_at)` |
| `subscriptions` | `(tenant_id, status)` |
| `invoices` | `(tenant_id, status)`, `(tenant_id, due_at)` partial open |
| `payments` | `(tenant_id, status)`, `(tenant_id, order_id)`, `(tenant_id, invoice_id)`, `uq (provider, provider_payment_id)` |
| `outbox_events` | partial unpublished, `(tenant_id, aggregate_type, aggregate_id)` |
| `audit_log` | `(tenant_id, occurred_at)`, `(tenant_id, target_type, target_id)` |
| `idempotency_keys` | `(tenant_id, created_at)` |
| `webhook_events` | partial unprocessed, `uq (provider, external_id)` |
| `notification_log` | `(tenant_id, queued_at)`, partial pending |

---

## 12. Những gì KHÔNG nằm trong Postgres

| Dữ liệu | Nơi lưu | Ghi chú |
|---|---|---|
| Refresh token | Redis `rt:{tokenId}` | TTL 30 ngày (ADR-0004) |
| Access token blacklist | Redis `bl:{jti}` | TTL = thời gian còn lại của access |
| Counter rate limit | Redis `rl:{ip}:{route}:{window}` | sliding/fixed window |
| Realtime fanout | Redis Pub/Sub | namespace `event:{id}:checkin` |
| Domain event stream | Redis Streams | `domain-events` |
| Cửa sổ chống double-scan QR | Redis `qr:{sig}:{gateId}` | SETNX 2s |
| Khóa riêng Ed25519 | Filesystem `/etc/api-gateway/keys/` + `jwks_keys.private_pem` | xoay vòng mỗi 6 tháng |
| Ảnh QR đã render | S3/MinIO | URL lưu ở `registrations.qr_image_url` |
| BullMQ jobs | Redis | `bull:<queue>:*` |

---

## 13. Cân nhắc mở rộng

- **Partitioning `check_in_records` theo `scanned_at` hàng quý** khi vượt 50M rows — dùng `pg_partman`.
- **Archive `audit_log` & `notification_log` > 12 tháng** sang bảng cold / object storage.
- **`orders.provider_session_id`** — cân nhắc tách bảng `payment_intents` nếu một order có nhiều intent (retry).
- **`users.email_verified_at`** — có thể chuyển sang bảng `user_emails` nếu sau này cho phép 1 user nhiều email (kiểu Google "switch account").
- **Soft FK giữa `payments` ↔ `orders`/`subscriptions`/`invoices`** — hiện tại 1 payment chỉ link 1 trong 3; nếu cần split (partial payment cho invoice) thì thêm bảng trung gian `payment_allocations`.
