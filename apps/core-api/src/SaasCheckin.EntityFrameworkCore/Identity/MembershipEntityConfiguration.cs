using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Identity;

public static class MembershipEntityConfiguration
{
    public sealed class MembershipEntity
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid TenantId { get; set; }   // = organization id
        public string Role { get; set; } = default!;
        public int Status { get; set; }      // 0=Pending, 1=Active, 2=Revoked
        public DateTimeOffset InvitedAt { get; set; }
        public DateTimeOffset? JoinedAt { get; set; }
        public DateTimeOffset? RevokedAt { get; set; }
    }

    public static void Configure(EntityTypeBuilder<MembershipEntity> b)
    {
        b.ToTable("memberships");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        b.Property(x => x.TenantId).HasColumnName("tenant_id").IsRequired();
        b.Property(x => x.Role).HasColumnName("role").HasMaxLength(40).IsRequired();
        b.Property(x => x.Status).HasColumnName("status").IsRequired();
        b.Property(x => x.InvitedAt).HasColumnName("invited_at").IsRequired();
        b.Property(x => x.JoinedAt).HasColumnName("joined_at");
        b.Property(x => x.RevokedAt).HasColumnName("revoked_at");

        // Unique: 1 user chỉ có 1 membership / org.
        b.HasIndex(x => new { x.TenantId, x.UserId }).IsUnique();
        // Index phụ trợ cho query "list members of org"
        b.HasIndex(x => x.TenantId);
        // Index phụ trợ cho query "list orgs of user"
        b.HasIndex(x => x.UserId);
    }
}
