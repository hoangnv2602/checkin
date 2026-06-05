using SaasCheckin.Shared.Domain;          // strongly-typed id pattern (Entity<TKey>)

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// Strongly-typed ID cho <see cref="Aggregates.User"/>. Tránh nhầm lẫn giữa
/// UserId và MembershipId, OrganizationId, etc. Lưu DB dưới dạng UUID.
/// </summary>
public readonly record struct UserId
{
    public Guid Value { get; }

    private UserId(Guid value) => Value = value;

    public static UserId New() => new(Guid.NewGuid());

    public static UserId From(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("UserId không được empty.", nameof(value));
        return new UserId(value);
    }

    public static implicit operator Guid(UserId id) => id.Value;
    public static explicit operator UserId(Guid value) => From(value);

    public override string ToString() => Value.ToString();
}
