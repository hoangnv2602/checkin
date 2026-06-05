using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace SaasCheckin.Shared.EntityFrameworkCore.Interceptors;

/// <summary>
/// TenantDbConnectionInterceptor — Phase 0 stub.
/// Phase 1+ sẽ:
///   - OnConnectionOpened: SET LOCAL app.current_tenant = '<tenant-id>'
///   - Lấy tenant_id từ IHttpContextAccessor hoặc MediatR UserContext
///   - Đảm bảo mọi query qua RLS filter theo tenant (D1 + ADR-0003)
///
/// Phase 0 chỉ khai báo interface; chưa wire vào DbContext.
/// </summary>
public sealed class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    public override async ValueTask<InterceptionResult> ConnectionOpeningAsync(
        DbConnection connection,
        ConnectionEventData eventData,
        InterceptionResult result,
        CancellationToken cancellationToken = default)
    {
        return await base.ConnectionOpeningAsync(connection, eventData, result, cancellationToken);
    }
}
