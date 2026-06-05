using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaasCheckin.Domain.Identity.ValueObjects;

namespace SaasCheckin.EntityFrameworkCore.Identity;

/// <summary>
/// UserEntity — table mapping cho User aggregate.
/// Note: bảng users là GLOBAL (không có tenant_id) — xem docs/database-schema.md §4.1.
/// Tenant context đến qua Membership aggregate riêng.
/// </summary>
public static class UserEntityConfiguration
{
    public sealed class UserEntity
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = default!;
        public DateTimeOffset? EmailVerifiedAt { get; set; }
        public string FullName { get; set; } = default!;
        public string? PasswordHash { get; set; }
        public string? AvatarUrl { get; set; }
        public string? Locale { get; set; }
        public DateTimeOffset? LastLoginAt { get; set; }
        public DateTimeOffset? LockedUntil { get; set; }
        public int FailedLoginCount { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public static void Configure(EntityTypeBuilder<UserEntity> b)
    {
        b.ToTable("users");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Email).HasColumnName("email").HasColumnType("citext").IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.Property(x => x.EmailVerifiedAt).HasColumnName("email_verified_at");
        b.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200).IsRequired();
        b.Property(x => x.PasswordHash).HasColumnName("password_hash");
        b.Property(x => x.AvatarUrl).HasColumnName("avatar_url");
        b.Property(x => x.Locale).HasColumnName("locale").HasMaxLength(10);
        b.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
        b.Property(x => x.LockedUntil).HasColumnName("locked_until");
        b.Property(x => x.FailedLoginCount).HasColumnName("failed_login_count").IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
    }
}
