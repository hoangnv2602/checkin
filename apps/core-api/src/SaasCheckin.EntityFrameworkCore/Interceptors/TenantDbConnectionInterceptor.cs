using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Npgsql;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.EntityFrameworkCore.Interceptors;

/// <summary>
/// RLS interceptor — fires on every connection open. Sets Postgres session var
/// <c>app.current_tenant = '{tenantId}'</c> từ <see cref="ICurrentTenant"/>.
/// Nếu TenantId = null → set empty string (no rows match RLS policy).
///
/// Phase 1: synchronous SET statement sau khi connection open. Nếu EF Core
/// dùng connection pooling (default), mỗi "physical" connection chỉ set 1 lần
/// (Postgres session vars persist trong connection lifetime).
/// </summary>
public sealed class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<TenantDbConnectionInterceptor> _logger;

    public TenantDbConnectionInterceptor(
        ICurrentTenant currentTenant,
        ILogger<TenantDbConnectionInterceptor> logger)
    {
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public override async ValueTask<InterceptionResult> ConnectionOpeningAsync(
        DbConnection connection,
        ConnectionEventData eventData,
        InterceptionResult result,
        CancellationToken cancellationToken = default)
    {
        var baseResult = await base.ConnectionOpeningAsync(connection, eventData, result, cancellationToken);
        await SetTenantSessionVarAsync(connection, cancellationToken);
        return baseResult;
    }

    private async Task SetTenantSessionVarAsync(DbConnection connection, CancellationToken ct)
    {
        try
        {
            var tenantId = _currentTenant.TenantId;
            var value = tenantId?.ToString() ?? string.Empty;
            // `set_config(setting, value, is_local=true)` — transaction-scoped
            // (false = session-scoped). Phase 1 dùng false để persist trong pool.
            const string sql = "SELECT set_config('app.current_tenant', @p, false)";
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = sql;
            var p = cmd.CreateParameter();
            p.ParameterName = "p";
            p.Value = value;
            cmd.Parameters.Add(p);
            await cmd.ExecuteScalarAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to set app.current_tenant on connection (current tenant: {TenantId})",
                _currentTenant.TenantId);
        }
    }
}
