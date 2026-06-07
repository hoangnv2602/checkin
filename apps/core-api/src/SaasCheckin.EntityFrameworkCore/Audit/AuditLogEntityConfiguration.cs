using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Audit;

/// <summary>
/// audit_log — INSERT-only. RLS-enforced. Bảng này phải REVOKE UPDATE, DELETE
/// ở runtime role `app_runtime` (chỉ cho phép INSERT). checkin-admin role
/// (BYPASSRLS) đọc được toàn bộ qua /v1/audit endpoints.
///
/// I-908: hash chain integrity — `prev_hash` + `hash` columns. Mỗi row
/// `hash = SHA256(prev_row.hash || id || tenant_id || action || actor_user_id || occurred_at)`.
/// Verify job recompute chain, alert nếu mismatch (sign of tampering).
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
        // I-908: hash chain
        b.Property(x => x.PrevHash).HasColumnName("prev_hash").HasMaxLength(64).IsRequired();
        b.Property(x => x.Hash).HasColumnName("hash").HasMaxLength(64).IsRequired();

        b.HasIndex(x => new { x.TenantId, x.OccurredAt })
            .HasDatabaseName("IX_audit_log_tenant_id_occurred_at");
        b.HasIndex(x => new { x.TenantId, x.ActorUserId, x.OccurredAt })
            .HasDatabaseName("IX_audit_log_tenant_id_actor_occurred_at");
        b.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId })
            .HasDatabaseName("IX_audit_log_tenant_id_entity");
        // I-704: filter by action dropdown (audit viewer) — ASC existing index
        // supports DESC scan natively in Postgres, no need for a second DESC index.
        b.HasIndex(x => new { x.TenantId, x.Action })
            .HasDatabaseName("IX_audit_log_tenant_id_action");
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
        /// <summary>I-908: SHA-256 hex of previous row's hash (64 chars).</summary>
        public string PrevHash { get; set; } = default!;
        /// <summary>I-908: SHA-256 hex of this row's content (64 chars).</summary>
        public string Hash { get; set; } = default!;
    }
}
