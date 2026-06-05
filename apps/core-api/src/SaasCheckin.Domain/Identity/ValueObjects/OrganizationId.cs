using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// OrganizationId — readonly record struct, globally unique (UUID v7).
/// Organization aggregate root PK. KHÔNG dùng cho query — luôn dùng Id.
/// </summary>
public readonly record struct OrganizationId(Guid Value)
{
    public static OrganizationId New() => new(Guid.NewGuid());

    public static OrganizationId From(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("OrganizationId cannot be empty.", nameof(value));
        return new OrganizationId(value);
    }

    public static OrganizationId From(string value)
    {
        Guard.NotNullOrWhiteSpace(value);
        if (!Guid.TryParse(value, out var guid))
            throw new ArgumentException($"OrganizationId không hợp lệ: {value}", nameof(value));
        return From(guid);
    }

    public override string ToString() => Value.ToString();
}
