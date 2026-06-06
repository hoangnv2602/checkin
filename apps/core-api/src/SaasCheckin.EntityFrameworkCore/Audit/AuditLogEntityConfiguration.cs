using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Audit;

/// <summary>
/// audit_log — INSERT-only. RLS-enforced. Bảng này phải REVOKE UPDATE, DELETE
/// ở runtime role `app_runtime` (chỉ cho phép INSERT). checkin-admin role
/// (BYPASSRLS) đọc được toàn bộ qua /v1/audit endpoints.
/// </summary>
public sealed class AuditLogEntityConfiguration
    : IEntityTypeConfiguration<AuditLogEntityConfiguration.AuditLogEntity>
{
    public void Configure(EntityTypeBuilder<AuditLogEntity> b)
    {
        b.ToTable("audit_log");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        b.Property(x => x.ActorUserId).HasColumnName("actor_user_id").IsRequired();
        b.Property(x => x.ActorRole).HasColumnName("actor_role").HasMaxLength(40).IsRequired();
        b.Property(x => x.Action).HasColumnName("action").HasMaxLength(80).IsRequired();
        b.Property(x => x.EntityType).HasColumnName("entity_type").HasMaxLength(80).IsRequired();
        b.Property(x => x.EntityId).HasColumnName("entity_id").HasMaxLength(64).IsRequired();
        b.Property(x => x.MetadataJson).HasColumnName("metadata").HasColumnType("jsonb");
        b.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
        b.Property(x => x.UserAgent).HasColumnName("user_agent").HasMaxLength(500);
        b.Property(x => x.OccurredAt).HasColumnName("occurred_at").IsRequired();

        b.HasIndex(x => new { x.TenantId, x.OccurredAt })
            .HasDatabaseName("IX_audit_log_tenant_id_occurred_at");
        b.HasIndex(x => new { x.TenantId, x.ActorUserId, x.OccurredAt })
            .HasDatabaseName("IX_audit_log_tenant_id_actor_occurred_at");
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId })
            .HasDatabaseName("IX_audit_log_tenant_id_entity");
    }

    public sealed class AuditLogEntity
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid ActorUserId { get; set; }
        public string ActorRole { get; set; } = default!;
        public string Action { get; set; } = default!;
        public string EntityType { get; set; } = default!;
        public string EntityId { get; set; } = default!;
        public string? MetadataJson { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public DateTimeOffset OccurredAt { get; set; }
    }
}
