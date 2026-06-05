using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.CheckIn;

/// <summary>
/// check_in_records — RLS-enforced. Partial unique index trên
/// (tenant_id, registration_id) WHERE status='Success' (mapped bằng
/// HasFilter("status = 0") cho EF Core). Đảm bảo 1 attendee chỉ
/// check-in thành công đúng 1 lần; nhiều attempts Rejected/Duplicate vẫn OK.
/// </summary>
public sealed class CheckInRecordEntityConfiguration
    : IEntityTypeConfiguration<CheckInRecordEntityConfiguration.CheckInRecordEntity>
{
    public void Configure(EntityTypeBuilder<CheckInRecordEntity> b)
    {
        b.ToTable("check_in_records");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        b.Property(x => x.EventId).HasColumnName("event_id").IsRequired();
        b.Property(x => x.RegistrationId).HasColumnName("registration_id").IsRequired();
        b.Property(x => x.Jti).HasColumnName("jti").IsRequired();
        b.Property(x => x.GateId).HasColumnName("gate_id").IsRequired();
        b.Property(x => x.StaffUserId).HasColumnName("staff_user_id").IsRequired();
        b.Property(x => x.Status).HasColumnName("status").IsRequired();
        b.Property(x => x.RejectReason).HasColumnName("reject_reason").HasMaxLength(500);
        b.Property(x => x.ScannedAt).HasColumnName("scanned_at").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        // Index cho "list by event since X" (dashboard rolling 30s)
        b.HasIndex(x => new { x.TenantId, x.EventId, x.ScannedAt })
            .HasDatabaseName("IX_check_in_records_tenant_id_event_id_scanned_at");
        b.HasIndex(x => new { x.TenantId, x.RegistrationId, x.Status })
            .HasFilter("status = 0")  // only Success
            .IsUnique()
            .HasDatabaseName("IX_check_in_records_tenant_id_registration_id_success");
    }

    public sealed class CheckInRecordEntity
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid EventId { get; set; }
        public Guid RegistrationId { get; set; }
        public Guid Jti { get; set; }
        public Guid GateId { get; set; }
        public Guid StaffUserId { get; set; }
        public int Status { get; set; }
        public string? RejectReason { get; set; }
        public DateTimeOffset ScannedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
