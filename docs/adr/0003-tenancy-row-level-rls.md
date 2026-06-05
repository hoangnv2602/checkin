# 0003. Mô hình tenancy: row-level với Postgres RLS

- **Status:** Accepted (D1)
- **Date:** 2026-06-04

## Context

Nền tảng là SaaS đa tenant: nhiều organization (organizer) chia sẻ một database, nhưng dữ liệu phải cô lập chặt. Một bug làm rò dữ liệu tenant này sang tenant khác là sự cố nghiêm trọng.

Hai chiến lược chính:
- **Schema-per-tenant** — một schema Postgres / org. Cô lập mạnh, backup đơn giản, nhưng đắt khi scale (10k+ tenant = 10k+ schema) và query chéo tenant trở nên bất khả thi.
- **Row-level với discriminator + RLS** — mọi bảng chung schema, mỗi row nghiệp vụ có `tenant_id`, và Postgres Row-Level Security policy enforce cô lập ở cấp DB.

## Decision

Dùng **row-level tenancy với `tenant_id` + Postgres RLS**.

- Mọi bảng nghiệp vụ có `tenant_id UUID NOT NULL` và `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`.
- Một policy so sánh `tenant_id` của row với `current_setting('app.tenant_id', true)::uuid`.
- Mọi request đọc/ghi dữ liệu nghiệp vụ **phải** bắt đầu bằng:
  ```sql
  SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';
  ```
  bên trong một transaction. `LOCAL` scope setting cho transaction để connection pool vẫn an toàn.
- `organizations` và `plans` là 2 bảng duy nhất không RLS — chúng là catalog tenant.
- `TenantDbConnectionInterceptor` của EF Core chạy `set_config('app.current_tenant', ...)` tự động mỗi lần connection open. Kết hợp với `ICurrentTenant` ambient scope (resolve từ JWT claim) ở middleware `SaasCheckin.HttpApi.Host`.

```csharp
// shared/Shared.EntityFrameworkCore/TenantDbConnectionInterceptor.cs
public class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ICurrentTenant _currentTenant;
    public TenantDbConnectionInterceptor(ICurrentTenant currentTenant) => _currentTenant = currentTenant;

    public override async Task ConnectionOpenedAsync(
        DbConnection connection, ConnectionEventData eventData, CancellationToken cancellationToken = default)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_tenant', @t, false)";
        var p = cmd.CreateParameter();
        p.ParameterName = "@t";
        p.Value = (object?)_currentTenant.Id?.ToString() ?? DBNull.Value;
        cmd.Parameters.Add(p);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }
}
```
- Một migration test tạo 2 tenant và assert query từ tenant A không thấy row của tenant B.

## Consequences

### Positive
- Enforce ở cấp DB: kể cả query bug (vd quên `WHERE tenant_id=...`) cũng trả 0 dòng.
- Analytics chéo tenant dễ khi cần (role `bypassrls` chỉ dùng bởi analytics worker).
- Thân thiện connection pool: một pool phục vụ mọi tenant.
- Backup/restore dễ: một database, `pg_dump` tiêu chuẩn.

### Negative
- Mọi dev phải nhớ `SET LOCAL` cho mọi code path mới chạm bảng nghiệp vụ. Rủi ro #13 trong sổ rủi ro.
- Superuser có `BYPASSRLS` sẽ phá bảo vệ — role Postgres dùng bởi app phải non-superuser, không có `BYPASSRLS`.
- Migrate multi-region sau đó cần tenant-routing cẩn thận; tenant ở region khác nhau không được chung DB.

### Neutral
- Index thêm prefix `tenant_id` trên hầu hết query — bình thường và ổn ở scale mình.
- Migration phải giữ `tenant_id NOT NULL` và thêm policy trong cùng migration tạo bảng.

## Alternatives considered

- **Schema-per-tenant** — cô lập mạnh, nhưng mình kỳ vọng lên tới hàng nghìn tenant. Số schema và độ phức tạp migration tăng tuyến tính. Backup / tenant hay nhưng chậm ở scale.
- **Database-per-tenant** — mạnh nhất, nhưng không khả thi vận hành cho SaaS ở scale mình.
- **Chỉ application-layer (không RLS)** — một nguồn bug. Một `where` quên là có leak.

## Revisit if

- Cần cho khách hàng database riêng (compliance). Lúc đó giữ RLS nhưng cho phép per-tenant DB.
- Số tenant > 50k và query pattern nghiêng về single-tenant hot path — cân nhắc sharding theo `tenant_id`.
