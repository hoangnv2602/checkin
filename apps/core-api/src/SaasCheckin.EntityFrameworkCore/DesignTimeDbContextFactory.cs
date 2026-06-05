using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SaasCheckin.EntityFrameworkCore;

/// <summary>
/// DesignTimeDbContextFactory — cho EF Core CLI tools (migrations).
/// Phase 0 stub: chưa wire connection string, EF tool sẽ fail cho đến Phase 1.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<SaasCheckinDbContext>
{
    public SaasCheckinDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SaasCheckinDbContext>()
            .UseNpgsql("Host=localhost;Database=saas_checkin_design;Username=postgres;Password=postgres")
            .Options;
        return new SaasCheckinDbContext(options, Array.Empty<Microsoft.EntityFrameworkCore.Diagnostics.IInterceptor>());
    }
}
