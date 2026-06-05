using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.Aggregates;

/// <summary>
/// Organization aggregate root — đại diện cho 1 tenant (acme, contoso, ...).
/// Tất cả dữ liệu business KHÁC (events, registrations, ...) đều thuộc về Organization
/// qua tenant_id. Organization KHÔNG có tenant_id (vì chính nó là tenant).
///
/// Tạo cùng lúc với Owner user đầu tiên qua <see cref="Create"/>.
/// </summary>
public sealed class Organization : AggregateRoot<OrganizationId>
{
    public string Name { get; private set; } = default!;
    public OrgSlug Slug { get; private set; } = default!;
    public string DefaultLocale { get; private set; } = "en";
    public string DefaultCurrency { get; private set; } = "USD";
    public string Timezone { get; private set; } = "UTC";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private Organization() : base(default!) { }

    private Organization(
        OrganizationId id,
        string name,
        OrgSlug slug,
        string defaultLocale,
        string defaultCurrency,
        string timezone,
        IClock clock) : base(id)
    {
        Name = name;
        Slug = slug;
        DefaultLocale = defaultLocale;
        DefaultCurrency = defaultCurrency;
        Timezone = timezone;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// Factory duy nhất để tạo Organization. Emit <see cref="OrgCreated"/>
    /// domain event (in-process) + <see cref="OrgCreatedIntegrationEvent"/>
    /// (cross-context qua outbox).
    /// </summary>
    public static Organization Create(
        string name,
        OrgSlug slug,
        IClock clock,
        string defaultLocale = "en",
        string defaultCurrency = "USD",
        string timezone = "UTC")
    {
        Guard.NotNullOrWhiteSpace(name);
        Guard.NotNull(slug);
        Guard.NotNull(clock);

        if (name.Length > 200)
            throw new ArgumentException("Organization name quá dài (>200 ký tự).", nameof(name));
        if (defaultLocale.Length > 10)
            throw new ArgumentException("DefaultLocale quá dài (>10 ký tự).", nameof(defaultLocale));
        if (defaultCurrency.Length != 3)
            throw new ArgumentException("DefaultCurrency phải là ISO 4217 code 3 ký tự.", nameof(defaultCurrency));
        if (timezone.Length > 64)
            throw new ArgumentException("Timezone quá dài (>64 ký tự).", nameof(timezone));

        var org = new Organization(
            OrganizationId.New(),
            name.Trim(),
            slug,
            defaultLocale.Trim().ToLowerInvariant(),
            defaultCurrency.Trim().ToUpperInvariant(),
            timezone.Trim(),
            clock);

        org.AddDomainEvent(new OrgCreated(org.Id, org.Name, org.Slug, clock.UtcNow));

        return org;
    }

    public void UpdateSettings(
        string? defaultLocale,
        string? defaultCurrency,
        string? timezone,
        IClock clock)
    {
        if (defaultLocale is not null)
        {
            if (defaultLocale.Length > 10)
                throw new ArgumentException("DefaultLocale quá dài (>10 ký tự).");
            DefaultLocale = defaultLocale.Trim().ToLowerInvariant();
        }
        if (defaultCurrency is not null)
        {
            if (defaultCurrency.Length != 3)
                throw new ArgumentException("DefaultCurrency phải là ISO 4217 code 3 ký tự.");
            DefaultCurrency = defaultCurrency.Trim().ToUpperInvariant();
        }
        if (timezone is not null)
        {
            if (timezone.Length > 64)
                throw new ArgumentException("Timezone quá dài (>64 ký tự).");
            Timezone = timezone.Trim();
        }
        Touch(clock);
    }

    private void Touch(IClock clock) => UpdatedAt = clock.UtcNow;
}
