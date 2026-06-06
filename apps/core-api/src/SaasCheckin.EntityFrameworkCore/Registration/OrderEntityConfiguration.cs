using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Registration;

/// <summary>
/// orders — RLS-enforced. Index (tenant_id, event_id, status) phục vụ
/// "list orders of event". Index (provider_session_id) unique — idempotency
/// cho webhook (Stripe/VNPay có thể gửi lại cùng event id).
/// </summary>
public sealed class OrderEntityConfiguration
    : IEntityTypeConfiguration<OrderEntityConfiguration.OrderEntity>
{
    public void Configure(EntityTypeBuilder<OrderEntity> b)
    {
        b.ToTable("orders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        b.Property(x => x.EventId).HasColumnName("event_id").IsRequired();
        b.Property(x => x.TicketTypeId).HasColumnName("ticket_type_id").IsRequired();
        b.Property(x => x.Quantity).HasColumnName("quantity").IsRequired();
        b.Property(x => x.BuyerEmail).HasColumnName("buyer_email").HasMaxLength(254).IsRequired();
        b.Property(x => x.BuyerName).HasColumnName("buyer_name").HasMaxLength(200).IsRequired();
        b.Property(x => x.SubtotalAmountMinor).HasColumnName("subtotal_amount_minor").IsRequired();
        b.Property(x => x.DiscountAmountMinor).HasColumnName("discount_amount_minor").IsRequired();
        b.Property(x => x.TotalAmountMinor).HasColumnName("total_amount_minor").IsRequired();
        b.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        b.Property(x => x.DiscountCode).HasColumnName("discount_code").HasMaxLength(50);
        b.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(20).IsRequired();
        b.Property(x => x.ProviderSessionId).HasColumnName("provider_session_id").HasMaxLength(200);
        b.Property(x => x.Status).HasColumnName("status").IsRequired();
        b.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.HasIndex(x => new { x.TenantId, x.EventId, x.Status })
            .HasDatabaseName("IX_orders_tenant_id_event_id_status");
        b.HasIndex(x => x.ProviderSessionId)
            .HasDatabaseName("IX_orders_provider_session_id");
        b.HasIndex(x => new { x.Status, x.ExpiresAt })
            .HasDatabaseName("IX_orders_status_expires_at");
    }

    public sealed class OrderEntity
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid EventId { get; set; }
        public Guid TicketTypeId { get; set; }
        public int Quantity { get; set; }
        public string BuyerEmail { get; set; } = default!;
        public string BuyerName { get; set; } = default!;
        public long SubtotalAmountMinor { get; set; }
        public long DiscountAmountMinor { get; set; }
        public long TotalAmountMinor { get; set; }
        public string Currency { get; set; } = default!;
        public string? DiscountCode { get; set; }
        public string Provider { get; set; } = default!;   // "stripe" | "vnpay"
        public string? ProviderSessionId { get; set; }
        public int Status { get; set; }                    // 0=Pending, 1=Paid, 2=Failed, 3=Refunded
        public DateTimeOffset ExpiresAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
