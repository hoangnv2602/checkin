using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Billing;

public sealed class InvoiceEntityConfiguration
    : IEntityTypeConfiguration<InvoiceEntityConfiguration.InvoiceEntity>
{
    public void Configure(EntityTypeBuilder<InvoiceEntity> b)
    {
        b.ToTable("invoices");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.OrganizationId).HasColumnName("organization_id").IsRequired();
        b.Property(x => x.SubscriptionId).HasColumnName("subscription_id").IsRequired();
        b.Property(x => x.AmountMinor).HasColumnName("amount_minor").IsRequired();
        b.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        b.Property(x => x.ProviderInvoiceId).HasColumnName("provider_invoice_id").HasMaxLength(200);
        b.Property(x => x.IssuedAt).HasColumnName("issued_at").IsRequired();
        b.Property(x => x.PaidAt).HasColumnName("paid_at");
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }

    public sealed class InvoiceEntity
    {
        public Guid Id { get; set; }
        public Guid OrganizationId { get; set; }
        public Guid SubscriptionId { get; set; }
        public long AmountMinor { get; set; }
        public string Currency { get; set; } = default!;
        public string? ProviderInvoiceId { get; set; }
        public DateTimeOffset IssuedAt { get; set; }
        public DateTimeOffset? PaidAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
