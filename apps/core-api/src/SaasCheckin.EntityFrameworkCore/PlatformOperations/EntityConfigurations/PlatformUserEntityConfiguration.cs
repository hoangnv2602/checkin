using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.PlatformOperations;

/// <summary>
/// PlatformUser — global table (no tenant_id, no RLS).
/// D12/ADR-0014: platform admin context accesses via <c>app_platform_owner</c> role (BYPASSRLS).
/// </summary>
public sealed class PlatformUserEntityConfiguration : IEntityTypeConfiguration<PlatformUserEntityConfiguration.PlatformUserEntity>
{
    public void Configure(EntityTypeBuilder<PlatformUserEntity> b)
    {
        b.ToTable("platform_users");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Email).HasColumnName("email").HasColumnType("citext").IsRequired();
        b.HasIndex(x => x.Email).IsUnique().HasDatabaseName("IX_platform_users_email");
        b.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200).IsRequired();
        b.Property(x => x.PasswordHash).HasColumnName("password_hash").IsRequired();
        b.Property(x => x.Role).HasColumnName("role").HasConversion<int>().IsRequired();
        b.Property(x => x.MfaEnabled).HasColumnName("mfa_enabled").IsRequired();
        b.Property(x => x.MfaSecretBase32).HasColumnName("mfa_secret_base32").HasMaxLength(64);
        b.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
        b.Property(x => x.LockedUntil).HasColumnName("locked_until");
        b.Property(x => x.FailedLoginCount).HasColumnName("failed_login_count").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }

    public sealed class PlatformUserEntity
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = default!;
        public string FullName { get; set; } = default!;
        public string PasswordHash { get; set; } = default!;
        public int Role { get; set; }
        public bool MfaEnabled { get; set; }
        public string? MfaSecretBase32 { get; set; }
        public DateTimeOffset? LastLoginAt { get; set; }
        public DateTimeOffset? LockedUntil { get; set; }
        public int FailedLoginCount { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
