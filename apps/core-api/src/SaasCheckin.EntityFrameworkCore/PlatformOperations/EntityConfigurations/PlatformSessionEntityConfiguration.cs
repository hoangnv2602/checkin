using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.PlatformOperations;

/// <summary>
/// PlatformSession — refresh-token session for platform admin (I-107, D12).
/// 8h TTL. DB-backed (vs Identity's Redis-backed 30-day sessions) — privileged audience.
/// </summary>
public sealed class PlatformSessionEntityConfiguration : IEntityTypeConfiguration<PlatformSessionEntityConfiguration.PlatformSessionEntity>
{
    public void Configure(EntityTypeBuilder<PlatformSessionEntity> b)
    {
        b.ToTable("platform_sessions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        b.HasIndex(x => x.UserId).HasDatabaseName("IX_platform_sessions_user_id");
        b.Property(x => x.RefreshTokenHash).HasColumnName("refresh_token_hash").HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.RefreshTokenHash).IsUnique().HasDatabaseName("IX_platform_sessions_refresh_token_hash");
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
        b.Property(x => x.RevokedAt).HasColumnName("revoked_at");
        b.Property(x => x.CreatedFromIp).HasColumnName("created_from_ip").HasMaxLength(64);
    }

    public sealed class PlatformSessionEntity
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string RefreshTokenHash { get; set; } = default!;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
        public DateTimeOffset? RevokedAt { get; set; }
        public string? CreatedFromIp { get; set; }
    }
}
