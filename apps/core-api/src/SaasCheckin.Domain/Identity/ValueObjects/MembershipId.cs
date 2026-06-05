using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// MembershipId — composite identity (UserId, OrganizationId) wrapped in a single Guid.
/// Mỗi user chỉ có 1 membership / org; (user_id, tenant_id) unique ở DB level (xem
/// database-schema.md § 4.2).
/// </summary>
public readonly record struct MembershipId(Guid Value)
{
    public static MembershipId New() => new(Guid.NewGuid());

    public static MembershipId From(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("MembershipId cannot be empty.", nameof(value));
        return new MembershipId(value);
    }

    public static MembershipId From(string value)
    {
        Guard.NotNullOrWhiteSpace(value);
        if (!Guid.TryParse(value, out var guid))
            throw new ArgumentException($"MembershipId không hợp lệ: {value}", nameof(value));
        return From(guid);
    }

    public override string ToString() => Value.ToString();
}
