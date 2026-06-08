using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Npgsql;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.EntityFrameworkCore.Interceptors;

/// <summary>
/// RLS interceptor — fires on every connection open. Sets Postgres session vars
/// <c>app.current_tenant = '{tenantId}'</c> và <c>app.user_id = '{userId}'</c>
/// từ <see cref="ICurrentTenant"/>.
///
/// Nếu TenantId = null → set empty (no rows match tenant policy). Tuy nhiên
/// nếu UserId được set (vd. login flow trước khi biết tenant), user-scoped
/// RLS policy (vd. memberships_self_read) vẫn match và user đọc được
/// memberships của chính mình.
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

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
        // Set sau khi connection open xong (ConnectionOpeningAsync chạy trước khi mở).
        await SetTenantSessionVarAsync(connection, cancellationToken);
        await SetUserSessionVarAsync(connection, cancellationToken);
    }

    private async Task SetTenantSessionVarAsync(DbConnection connection, CancellationToken ct)
    {
        try
        {
            var tenantId = _currentTenant.TenantId;
            var value = tenantId?.ToString() ?? string.Empty;
            // `set_config(setting, value, is_local=false)` — session-scoped,
            // persist trong connection lifetime (EF Core pool).
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

    private async Task SetUserSessionVarAsync(DbConnection connection, CancellationToken ct)
    {
        try
        {
            var userId = _currentTenant.UserId;
            if (!userId.HasValue)
            {
                // Không set khi UserId = null (tránh '' = anything ở các policy
                // tương lai). User-scoped RLS policies tự skip khi setting null.
                return;
            }
            const string sql = "SELECT set_config('app.user_id', @p, false)";
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = sql;
            var p = cmd.CreateParameter();
            p.ParameterName = "p";
            p.Value = userId.Value.ToString();
            cmd.Parameters.Add(p);
            await cmd.ExecuteScalarAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to set app.user_id on connection (current user: {UserId})",
                _currentTenant.UserId);
        }
    }
}
