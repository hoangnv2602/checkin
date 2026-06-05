using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace SaasCheckin.Shared.EntityFrameworkCore.Interceptors;

/// <summary>
/// TenantDbConnectionInterceptor - Phase 0 stub.
/// Phase 1+ sẽ set app.current_tenant on connection open (D1 + ADR-0003).
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
