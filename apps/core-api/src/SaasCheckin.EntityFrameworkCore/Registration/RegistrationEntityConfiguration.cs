using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Registration;

/// <summary>
/// registrations — RLS-enforced. Unique index trên (tenant_id, jti) — JTI
/// single-use invariant (check-in dùng JTI, không được phép trùng).
/// Index (tenant_id, event_id, status) cho dashboard queries.
/// </summary>
public sealed class RegistrationEntityConfiguration
    : IEntityTypeConfiguration<RegistrationEntityConfiguration.RegistrationEntity>
{
    public void Configure(EntityTypeBuilder<RegistrationEntity> b)
    {
        b.ToTable("registrations");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        b.Property(x => x.EventId).HasColumnName("event_id").IsRequired();
        b.Property(x => x.OrderId).HasColumnName("order_id").IsRequired();
        b.Property(x => x.TicketTypeId).HasColumnName("ticket_type_id").IsRequired();
        b.Property(x => x.Jti).HasColumnName("jti").IsRequired();
        b.Property(x => x.AttendeeEmail).HasColumnName("attendee_email").HasMaxLength(254).IsRequired();
        b.Property(x => x.AttendeeName).HasColumnName("attendee_name").HasMaxLength(200).IsRequired();
        b.Property(x => x.AttendeePhone).HasColumnName("attendee_phone").HasMaxLength(40);
        b.Property(x => x.Status).HasColumnName("status").IsRequired();
        b.Property(x => x.IssuedAt).HasColumnName("issued_at").IsRequired();
        b.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
        b.Property(x => x.CheckedInAt).HasColumnName("checked_in_at");
        b.Property(x => x.QrImageUrl).HasColumnName("qr_image_url").HasMaxLength(500);
        b.Property(x => x.Signature).HasColumnName("signature").HasMaxLength(200);
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.HasIndex(x => new { x.TenantId, x.Jti })
            .IsUnique()
            .HasDatabaseName("IX_registrations_tenant_id_jti");
        b.HasIndex(x => new { x.TenantId, x.EventId, x.Status })
            .HasDatabaseName("IX_registrations_tenant_id_event_id_status");
        b.HasIndex(x => new { x.TenantId, x.AttendeeEmail })
            .HasDatabaseName("IX_registrations_tenant_id_attendee_email");
        b.HasIndex(x => new { x.TenantId, x.OrderId })
            .HasDatabaseName("IX_registrations_tenant_id_order_id");
    }

    public sealed class RegistrationEntity
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid EventId { get; set; }
        public Guid OrderId { get; set; }
        public Guid TicketTypeId { get; set; }
        public Guid Jti { get; set; }
        public string AttendeeEmail { get; set; } = default!;
        public string AttendeeName { get; set; } = default!;
        public string? AttendeePhone { get; set; }
        public int Status { get; set; }    // 0=Active, 1=CheckedIn, 2=Revoked, 3=Expired
        public DateTimeOffset IssuedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
        public DateTimeOffset? CheckedInAt { get; set; }
        public string? QrImageUrl { get; set; }
        public string? Signature { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
