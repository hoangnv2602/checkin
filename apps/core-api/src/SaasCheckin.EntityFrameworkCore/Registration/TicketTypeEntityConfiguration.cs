using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Registration;

/// <summary>
/// ticket_types — RLS-enforced (xem migration InitialRegistration). Index theo
/// (tenant_id, event_id) phục vụ "list ticket types of event" — trang /e/[slug].
/// </summary>
public sealed class TicketTypeEntityConfiguration
    : IEntityTypeConfiguration<TicketTypeEntityConfiguration.TicketTypeEntity>
{
    public void Configure(EntityTypeBuilder<TicketTypeEntity> b)
    {
        b.ToTable("ticket_types");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        b.Property(x => x.EventId).HasColumnName("event_id").IsRequired();
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        b.Property(x => x.Description).HasColumnName("description");
        b.Property(x => x.PriceAmountMinor).HasColumnName("price_amount_minor").IsRequired();
        b.Property(x => x.PriceCurrency).HasColumnName("price_currency").HasMaxLength(3).IsRequired();
        b.Property(x => x.Capacity).HasColumnName("capacity").IsRequired();
        b.Property(x => x.SoldCount).HasColumnName("sold_count").IsRequired();
        b.Property(x => x.SaleStartsAt).HasColumnName("sale_starts_at").IsRequired();
        b.Property(x => x.SaleEndsAt).HasColumnName("sale_ends_at").IsRequired();
        b.Property(x => x.IsActive).HasColumnName("is_active").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.HasIndex(x => new { x.TenantId, x.EventId })
            .HasDatabaseName("IX_ticket_types_tenant_id_event_id");
    }

    public sealed class TicketTypeEntity
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid EventId { get; set; }
        public string Name { get; set; } = default!;
        public string? Description { get; set; }
        public long PriceAmountMinor { get; set; }
        public string PriceCurrency { get; set; } = default!;
        public int Capacity { get; set; }
        public int SoldCount { get; set; }
        public DateTimeOffset SaleStartsAt { get; set; }
        public DateTimeOffset SaleEndsAt { get; set; }
        public bool IsActive { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
