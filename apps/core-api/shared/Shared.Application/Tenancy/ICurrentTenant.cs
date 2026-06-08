namespace SaasCheckin.Shared.Application.Tenancy;

/// <summary>
/// Resolve tenant hiện tại của request. BFF (NestJS) gửi X-Tenant-Id qua
/// gRPC metadata → Core API middleware extract → set vào ICurrentTenant
/// cho cả request scope.
///
/// EF Core RLS interceptor đọc <see cref="TenantId"/> và set
/// `app.current_tenant` lên mỗi connection (xem
/// shared/Shared.EntityFrameworkCore/Interceptors/TenantDbConnectionInterceptor.cs).
///
/// Nếu TenantId = null → query chỉ trả về data global (users, organizations)
/// hoặc fail nếu bảng enforce RLS.
///
/// <see cref="UserId"/> phục vụ user-scoped RLS policy (vd.
/// memberships_self_read) — cho phép user đọc memberships của chính mình
/// khi chưa có tenant context (login flow, switch org, …).
/// </summary>
public interface ICurrentTenant
{
    Guid? TenantId { get; }
    Guid? UserId { get; }

    /// <summary>Set bởi middleware lúc request start. AsyncLocal cho phép
    /// EF interceptor đọc cùng scope mà không cần DI service locator.</summary>
    void SetTenant(Guid? tenantId);

    /// <summary>Set bởi handler trước khi query cần user-scoped RLS
    /// (vd. LoginCommandHandler trước khi đọc memberships).</summary>
    void SetUser(Guid? userId);
}

public sealed class CurrentTenant : ICurrentTenant
{
    private static readonly AsyncLocal<Guid?> _currentTenant = new();
    private static readonly AsyncLocal<Guid?> _currentUser = new();

    public Guid? TenantId => _currentTenant.Value;
    public Guid? UserId => _currentUser.Value;

    public void SetTenant(Guid? tenantId) => _currentTenant.Value = tenantId;
    public void SetUser(Guid? userId) => _currentUser.Value = userId;
}
