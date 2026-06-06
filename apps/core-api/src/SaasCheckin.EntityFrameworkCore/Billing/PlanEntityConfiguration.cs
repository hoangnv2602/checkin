using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Billing;

/// <summary>
/// plans — global table (no tenant_id). RLS không cần; chỉ checkin-admin
/// (BYPASSRLS) mới write.
/// </summary>
public sealed class PlanEntityConfiguration
    : IEntityTypeConfiguration<PlanEntityConfiguration.PlanEntity>
{
    public void Configure(EntityTypeBuilder<PlanEntity> b)
    {
        b.ToTable("plans");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        b.Property(x => x.Tier).HasColumnName("tier").IsRequired();
        b.Property(x => x.PriceAmountMinor).HasColumnName("price_amount_minor").IsRequired();
        b.Property(x => x.PriceCurrency).HasColumnName("price_currency").HasMaxLength(3).IsRequired();
        b.Property(x => x.Period).HasColumnName("period").IsRequired();
        b.Property(x => x.MaxActiveEvents).HasColumnName("max_active_events").IsRequired();
        b.Property(x => x.MaxAttendeesPerMonth).HasColumnName("max_attendees_per_month").IsRequired();
        b.Property(x => x.MaxStaffSeats).HasColumnName("max_staff_seats").IsRequired();
        b.Property(x => x.IsDefault).HasColumnName("is_default").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }

    public sealed class PlanEntity
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = default!;
        public int Tier { get; set; }
        public long PriceAmountMinor { get; set; }
        public string PriceCurrency { get; set; } = default!;
        public int Period { get; set; }
        public int MaxActiveEvents { get; set; }
        public int MaxAttendeesPerMonth { get; set; }
        public int MaxStaffSeats { get; set; }
        public bool IsDefault { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
