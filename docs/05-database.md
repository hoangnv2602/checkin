# 05 · Database (PostgreSQL 16)

> Mô hình đa tenant: **row-level tenancy** + **Postgres RLS**. Mọi bảng nghiệp vụ có `tenant_id` và policy so sánh nó với `current_setting('app.tenant_id')`. Xem ADR-0003.

## Topology

- 1 instance Postgres 16 / môi trường (local / staging / prod)
- 1 database / môi trường, **1 schema** (`public`) — tất cả bảng nằm trong `public`
- Extension: `pgcrypto`, `citext`, `pg_stat_statements`
- Connection pool: PgBouncer ở transaction-pool mode trước Postgres (prod)

## Pattern kết nối (bắt buộc)

### Tenant audience (default — `app_runtime`)

```csharp
// shared/Shared.EntityFrameworkCore/TenantDbConnectionInterceptor.cs
// Mỗi khi EF Core mở connection, tự động set session var:
public override async Task ConnectionOpenedAsync(
    DbConnection connection, ConnectionEventData eventData, CancellationToken ct = default)
{
    await using var cmd = connection.CreateCommand();
    cmd.CommandText = "SELECT set_config('app.current_tenant', @t, false)";
    var p = cmd.CreateParameter();
    p.ParameterName = "@t";
    p.Value = (object?)_currentTenant.Id?.ToString() ?? DBNull.Value;
    cmd.Parameters.Add(p);
    await cmd.ExecuteNonQueryAsync(ct);
    await base.ConnectionOpenedAsync(connection, eventData, ct);
}
```

Trong NestJS gRPC client → Core API (.NET), `tenant_id` được lan truyền qua gRPC metadata, middleware phía Host resolve thành `ICurrentTenant.Id` → interceptor set `app.current_tenant` ở connection open.

### Platform audience (`app_platform_owner`)

`SaasCheckin.HttpApi.Host` có **2 connection factory** trong DI:

| Factory | Postgres role | Bật RLS | Bật `TenantDbConnectionInterceptor` | Metadata key gRPC inbound |
|---|---|---|---|---|
| `RuntimeDbContextFactory` | `app_runtime` | Có (`FORCE ROW LEVEL SECURITY`) | Có | (mặc định) |
| `PlatformDbContextFactory` | `app_platform_owner` | Có, **NHƯNG role có `BYPASSRLS`** ở schema `public` NGOẠI TRỪ table `platform_audit_log` (xem dưới) | **Không** — không set `app.current_tenant` | `x-platform-role: true` (gRPC metadata) |

`apps/api-gateway/src/modules/checkin-admin/platform-grpc.client.ts` mỗi RPC set header `x-platform-role: true` + kèm JWT audience `checkin-admin`. .NET middleware inspect metadata, chọn factory tương ứng.

**Quy tắc bất di bất dịch:**
- `app_platform_owner` KHÔNG BAO GIỜ dùng connection `app_runtime` (audit log sẽ ghi nhầm `tenant_id` null).
- `app_runtime` KHÔNG BAO GIỜ dùng connection `app_platform_owner` (RLS bypass có thể leak chéo).
- Mỗi khi `PlatformDbContext` save change, **trigger Postgres** insert 1 row vào `platform_audit_log` (cấu hình ở DB level qua `CREATE TRIGGER` trong migration).
- `platform_audit_log` table GRANT INSERT cho `app_platform_owner`, GRANT SELECT cho `app_runtime` (audit view cho tenant — chỉ thấy action liên quan đến tenant mình), GRANT UPDATE/DELETE = không có.

```sql
-- Migration: tạo role + grant
CREATE ROLE app_runtime LOGIN PASSWORD '...' IN ROLE app_user;
CREATE ROLE app_platform_owner LOGIN PASSWORD '...' IN ROLE app_user BYPASSRLS;

-- app_platform_owner KHÔNG được xoá audit log
REVOKE UPDATE, DELETE ON platform_audit_log FROM app_platform_owner;
REVOKE UPDATE, DELETE ON platform_audit_log FROM app_runtime;

-- app_runtime chỉ xem audit log của tenant mình (RLS trên platform_audit_log)
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_audit_view ON platform_audit_log
    FOR SELECT
    USING (
        target_tenant_id::text = current_setting('app.current_tenant', true)
        OR current_setting('app.is_platform_call', true) = 'true'
    );
```

## Schema

```
public (một schema, được bảo vệ bằng RLS)
├── organizations            -- bảng tenant gốc (không RLS — super user table)
├── plans                    -- billing plan (không RLS)
├── users
├── memberships              -- user ↔ org
├── events
├── sessions
├── venues
├── ticket_types
├── orders
├── registrations            -- attendee + vé
├── check_in_records         -- immutable, append-only
├── outbox_messages          -- domain event outbox (MassTransit-compatible)
├── subscriptions
├── invoices
├── payments
├── audit_log                -- audit log trong tenant (RLS theo tenant_id)
├── platform_users           -- checkin-admin user (KHÔNG RLS, không tenant_id)
├── platform_sessions        -- session checkin-admin (KHÔNG RLS)
├── platform_audit_log       -- audit log cho checkin-admin mutation (RLS đặc biệt: tenant xem được của mình, platform xem tất cả)
└── idempotency_keys
```

> `organizations` và `plans` là 2 bảng duy nhất **trong tenant scope** không có `tenant_id` vì chúng là nguồn của tenant identity và product catalog. Platform-scope tables (`platform_*`) tách hẳn, không RLS theo tenant_id, audience là role `app_platform_owner`. Mọi truy cập đều qua repository guard.

## Ví dụ RLS (bắt buộc trên mọi bảng có `tenant_id`)

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;     -- owner role cũng bị chặn

CREATE POLICY tenant_isolation ON events
    USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Pattern test migration: spin up 2 tenant, thử query chéo, assert 0 dòng.

## Bảng cốt lõi (DDL sketch)

### `events`
```sql
CREATE TYPE event_status AS ENUM ('draft','published','cancelled');

CREATE TABLE events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    venue_id      UUID NOT NULL REFERENCES venues(id),
    start_at      TIMESTAMPTZ NOT NULL,
    end_at        TIMESTAMPTZ NOT NULL,
    capacity      INT NOT NULL CHECK (capacity > 0),
    status        event_status NOT NULL DEFAULT 'draft',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_at < end_at)
);
CREATE INDEX idx_events_tenant_status ON events(tenant_id, status);
CREATE INDEX idx_events_tenant_start  ON events(tenant_id, start_at DESC);
```

### `registrations`
```sql
CREATE TYPE registration_status AS ENUM ('issued','revoked','refunded');

CREATE TABLE registrations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    event_id       UUID NOT NULL REFERENCES events(id),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
    order_id       UUID REFERENCES orders(id),
    attendee_email CITEXT NOT NULL,
    attendee_name  VARCHAR(200) NOT NULL,
    qr_payload     JSONB NOT NULL,            -- {regId, eventId, issuedAt, exp, jti}
    qr_signature   BYTEA NOT NULL,            -- chữ ký Ed25519
    status         registration_status NOT NULL DEFAULT 'issued',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_tenant_event ON registrations(tenant_id, event_id);
CREATE UNIQUE INDEX uq_reg_qr_sig ON registrations(qr_signature);
```

### `check_in_records` (immutable, append-only)
```sql
CREATE TYPE checkin_status AS ENUM ('success','rejected','duplicate');

CREATE TABLE check_in_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    registration_id UUID NOT NULL REFERENCES registrations(id),
    event_id        UUID NOT NULL,
    gate_id         UUID NOT NULL,
    scanned_by      UUID NOT NULL REFERENCES users(id),
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          checkin_status NOT NULL,
    reason          VARCHAR(100),
    client_meta     JSONB,                   -- device, geo, photo url
    CONSTRAINT uq_one_success UNIQUE (registration_id) -- chỉ 'success' row; enforce bằng partial index
);
CREATE UNIQUE INDEX uq_chk_one_success
    ON check_in_records(registration_id)
    WHERE status = 'success';
CREATE INDEX idx_chk_tenant_event_gate_time
    ON check_in_records(tenant_id, event_id, gate_id, scanned_at);
```

### `outbox_messages` (at-least-once publish domain event)
```sql
CREATE TABLE outbox_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    message_type    VARCHAR(200) NOT NULL,   -- assembly-qualified type name
    payload         JSONB NOT NULL,
    conversation_id UUID,
    correlation_id  UUID,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    retry_count     INT NOT NULL DEFAULT 0,
    last_error      TEXT
);
CREATE INDEX idx_outbox_unpublished
    ON outbox_messages(occurred_at)
    WHERE processed_at IS NULL;
```

> **Convention:** bảng `outbox_messages` (không phải `outbox_events`) để tương thích với MassTransit Entity Framework outbox convention. Mặc định `OutboxRelayService` trong `SaasCheckin.Infrastructure` poll mỗi 1s, publish qua `IIntegrationEventBus`, retry exponential.

## Sử dụng Redis

| Mục đích | Pattern key | TTL |
|----------|-------------|-----|
| Refresh token store | `rt:{tokenId}` | 30 ngày |
| Access token blacklist | `bl:{jti}` | = remaining access TTL |
| Rate limit | `rl:{ip}:{route}:{window}` | window |
| Realtime channel | Pub/Sub `event:{eventId}:checkin` | — |
| Domain event stream | Stream `domain-events` (MassTransit publish) + RabbitMQ `saas-checkin.events` exchange | — |
| BullMQ queue | `bull:<queue>:*` | — |
| Hot cache | `event:{id}:summary` | 5 phút |
| Cửa sổ chống replay QR | `qr:{sig}:{gateId}` SETNX | 2s |

## Migration

- Tool: **EF Core Migrations** cho Core API (.NET), generate qua `dotnet ef migrations add <Name> -p src/SaasCheckin.EntityFrameworkCore -s src/SaasCheckin.DbMigrator`
- Apply qua: `dotnet run --project src/SaasCheckin.DbMigrator` (chạy trong CI/CD stage, không trong runtime container)
- Đặt tên file: `<Timestamp>_<Name>.cs` (vd `20260604_AddOutboxMessages.cs`)
- Mọi migration phải **backward compatible** — pattern expand/contract:
  1. Thêm cột nullable
  2. Backfill theo batch
  3. Chuyển NOT NULL
  4. (migration sau) drop cột cũ
- Migration chạy ở stage CI riêng **trước** khi swap container

## Backup

- **Tool:** `pgbackrest` (PITR capable)
- **Daily full** + **WAL streaming** → Hetzner Storage Box
- **Retention:** 7 daily, 4 weekly, 6 monthly
- **Restore drill:** mỗi quý, trên một staging DB riêng

## Mục tiêu hiệu năng

- p95 query time < 50 ms (có index)
- Connection pool: 20 / app instance, max 200 toàn cục
- Slow query log threshold: 200 ms

> File DDL đầy đủ cho từng bảng xem [`database-schema.md`](./database-schema.md).
