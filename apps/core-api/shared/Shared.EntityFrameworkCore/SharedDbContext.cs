using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace SaasCheckin.Shared.EntityFrameworkCore;

/// <summary>
/// SharedDbContext — base class cho SaasCheckinDbContext.
/// Phase 0: chỉ pass interceptors. Phase 1+ sẽ wire TenantDbConnectionInterceptor
/// (set app.current_tenant mỗi connection open theo D1 RLS).
/// </summary>
public abstract class SharedDbContext : DbContext
{
    protected SharedDbContext(
        DbContextOptions options,
        IEnumerable<IInterceptor> interceptors)
        : base(options)
    {
        // Phase 1+: thêm TenantDbConnectionInterceptor vào options
        // và OnConfiguring để enforce RLS context.
    }
}
