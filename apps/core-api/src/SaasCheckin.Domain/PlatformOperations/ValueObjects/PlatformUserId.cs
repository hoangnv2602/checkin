namespace SaasCheckin.Domain.PlatformOperations.ValueObjects;

/// <summary>
/// Strongly-typed ID cho <see cref="Aggregates.PlatformUser"/>.
/// </summary>
public readonly record struct PlatformUserId
{
    public Guid Value { get; }

    private PlatformUserId(Guid value) => Value = value;

    public static PlatformUserId New() => new(Guid.NewGuid());

    public static PlatformUserId From(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("PlatformUserId không được empty.", nameof(value));
        return new PlatformUserId(value);
    }

    public static implicit operator Guid(PlatformUserId id) => id.Value;
    public static explicit operator PlatformUserId(Guid value) => From(value);

    public override string ToString() => Value.ToString();
}
