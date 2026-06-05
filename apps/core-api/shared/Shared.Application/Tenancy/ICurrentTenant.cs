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
/// </summary>
public interface ICurrentTenant
{
    Guid? TenantId { get; }

    /// <summary>Set bởi middleware lúc request start. AsyncLocal cho phép
    /// EF interceptor đọc cùng scope mà không cần DI service locator.</summary>
    void SetTenant(Guid? tenantId);
}

public sealed class CurrentTenant : ICurrentTenant
{
    private static readonly AsyncLocal<Guid?> _current = new();

    public Guid? TenantId => _current.Value;

    public void SetTenant(Guid? tenantId) => _current.Value = tenantId;
}
