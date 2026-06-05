using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SaasCheckin.EntityFrameworkCore.Identity;
using SaasCheckin.Shared.EntityFrameworkCore;

namespace SaasCheckin.EntityFrameworkCore;

public sealed class SaasCheckinDbContext : SharedDbContext
{
    public SaasCheckinDbContext(
        DbContextOptions<SaasCheckinDbContext> options,
        IEnumerable<IInterceptor> interceptors)
        : base(options, interceptors)
    {
    }

    public DbSet<UserEntityConfiguration.UserEntity> Users
        => Set<UserEntityConfiguration.UserEntity>();

    public DbSet<OrganizationEntityConfiguration.OrganizationEntity> Organizations
        => Set<OrganizationEntityConfiguration.OrganizationEntity>();

    public DbSet<MembershipEntityConfiguration.MembershipEntity> Memberships
        => Set<MembershipEntityConfiguration.MembershipEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SaasCheckinDbContext).Assembly);
    }
}
