using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SaasCheckin.EntityFrameworkCore.Identity;

public static class OrganizationEntityConfiguration
{
    public sealed class OrganizationEntity
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = default!;
        public string Slug { get; set; } = default!;
        public string DefaultLocale { get; set; } = "en";
        public string DefaultCurrency { get; set; } = "USD";
        public string Timezone { get; set; } = "UTC";
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public static void Configure(EntityTypeBuilder<OrganizationEntity> b)
    {
        b.ToTable("organizations");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        b.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(40).IsRequired();
        b.HasIndex(x => x.Slug).IsUnique();
        b.Property(x => x.DefaultLocale).HasColumnName("default_locale").HasMaxLength(10).IsRequired();
        b.Property(x => x.DefaultCurrency).HasColumnName("default_currency").HasMaxLength(3).IsRequired();
        b.Property(x => x.Timezone).HasColumnName("timezone").HasMaxLength(64).IsRequired();
        b.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }
}
