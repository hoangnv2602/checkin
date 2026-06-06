using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SaasCheckin.EntityFrameworkCore.Billing;
using SaasCheckin.EntityFrameworkCore.CheckIn;
using SaasCheckin.EntityFrameworkCore.Identity;
using SaasCheckin.EntityFrameworkCore.PlatformOperations;
using SaasCheckin.EntityFrameworkCore.Registration;
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

    public DbSet<TicketTypeEntityConfiguration.TicketTypeEntity> TicketTypes
        => Set<TicketTypeEntityConfiguration.TicketTypeEntity>();

    public DbSet<OrderEntityConfiguration.OrderEntity> Orders
        => Set<OrderEntityConfiguration.OrderEntity>();

    public DbSet<RegistrationEntityConfiguration.RegistrationEntity> Registrations
        => Set<RegistrationEntityConfiguration.RegistrationEntity>();

    public DbSet<CheckInRecordEntityConfiguration.CheckInRecordEntity> CheckInRecords
        => Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>();

    public DbSet<PlanEntityConfiguration.PlanEntity> Plans
        => Set<PlanEntityConfiguration.PlanEntity>();

    public DbSet<SubscriptionEntityConfiguration.SubscriptionEntity> Subscriptions
        => Set<SubscriptionEntityConfiguration.SubscriptionEntity>();

    public DbSet<InvoiceEntityConfiguration.InvoiceEntity> Invoices
        => Set<InvoiceEntityConfiguration.InvoiceEntity>();

    // I-107: Platform admin tables (no tenant_id, no RLS — global context).
    public DbSet<PlatformUserEntityConfiguration.PlatformUserEntity> PlatformUsers
        => Set<PlatformUserEntityConfiguration.PlatformUserEntity>();

    public DbSet<PlatformSessionEntityConfiguration.PlatformSessionEntity> PlatformSessions
        => Set<PlatformSessionEntityConfiguration.PlatformSessionEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SaasCheckinDbContext).Assembly);
    }
}
