using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Billing;

public sealed class SubscriptionEntityConfiguration
    : IEntityTypeConfiguration<SubscriptionEntityConfiguration.SubscriptionEntity>
{
    public void Configure(EntityTypeBuilder<SubscriptionEntity> b)
    {
        b.ToTable("subscriptions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.OrganizationId).HasColumnName("organization_id").IsRequired();
        b.Property(x => x.PlanId).HasColumnName("plan_id").IsRequired();
        b.Property(x => x.State).HasColumnName("state").IsRequired();
        b.Property(x => x.CurrentPeriodStart).HasColumnName("current_period_start").IsRequired();
        b.Property(x => x.CurrentPeriodEnd).HasColumnName("current_period_end").IsRequired();
        b.Property(x => x.TrialEndsAt).HasColumnName("trial_ends_at");
        b.Property(x => x.CancelledAt).HasColumnName("cancelled_at");
        b.Property(x => x.ExternalSubscriptionId).HasColumnName("external_subscription_id").HasMaxLength(200);
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.HasIndex(x => x.OrganizationId)
            .IsUnique()
            .HasDatabaseName("IX_subscriptions_organization_id");
    }

    public sealed class SubscriptionEntity
    {
        public Guid Id { get; set; }
        public Guid OrganizationId { get; set; }
        public Guid PlanId { get; set; }
        public int State { get; set; }  // 0=Trial, 1=Active, 2=PastDue, 3=Cancelled
        public DateTimeOffset CurrentPeriodStart { get; set; }
        public DateTimeOffset CurrentPeriodEnd { get; set; }
        public DateTimeOffset? TrialEndsAt { get; set; }
        public DateTimeOffset? CancelledAt { get; set; }
        public string? ExternalSubscriptionId { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
