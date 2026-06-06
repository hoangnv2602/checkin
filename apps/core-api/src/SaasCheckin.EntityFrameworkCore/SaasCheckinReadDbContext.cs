// apps/core-api/src/SaasCheckin.EntityFrameworkCore/SaasCheckinReadDbContext.cs
// I-805 — Read-only DbContext pointing to Postgres replica.
// Same model, different connection string. AsNoTracking() enforced.
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SaasCheckin.Shared.EntityFrameworkCore;

namespace SaasCheckin.EntityFrameworkCore;

/// <summary>
/// Read replica DbContext. Kế thừa cùng model với SaasCheckinDbContext nhưng
/// connection string tới replica + AsNoTracking bắt buộc.
/// </summary>
public sealed class SaasCheckinReadDbContext : SharedDbContext
{
    public SaasCheckinReadDbContext(
        DbContextOptions<SaasCheckinReadDbContext> options,
        IEnumerable<IInterceptor> interceptors)
        : base(options, interceptors)
    {
        ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SaasCheckinReadDbContext).Assembly);
    }
}
