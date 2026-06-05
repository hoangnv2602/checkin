using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SaasCheckin.EntityFrameworkCore.Identity;
using SaasCheckin.Shared.EntityFrameworkCore;
using SaasCheckin.Shared.EntityFrameworkCore.Interceptors;

namespace SaasCheckin.EntityFrameworkCore;

/// <summary>
/// SaasCheckinDbContext — root DbContext.
/// Phase 0: chỉ register User (Identity context). Các aggregate khác
/// (Organization, Event, ...) thêm ở Phase tương ứng.
/// </summary>
public sealed class SaasCheckinDbContext : SharedDbContext
{
    public SaasCheckinDbContext(
        DbContextOptions<SaasCheckinDbContext> options,
        IEnumerable<IInterceptor> interceptors)
        : base(options, interceptors)
    {
    }

    // Identity context
    public DbSet<UserEntityConfiguration.UserEntity> Users => Set<UserEntityConfiguration.UserEntity>();
}
