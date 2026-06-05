namespace SaasCheckin.Domain.PlatformOperations.ValueObjects;

public readonly record struct PlatformSessionId
{
    public Guid Value { get; }

    private PlatformSessionId(Guid value) => Value = value;

    public static PlatformSessionId New() => new(Guid.NewGuid());

    public static PlatformSessionId From(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("PlatformSessionId không được empty.", nameof(value));
        return new PlatformSessionId(value);
    }

    public static implicit operator Guid(PlatformSessionId id) => id.Value;
    public static explicit operator PlatformSessionId(Guid value) => From(value);

    public override string ToString() => Value.ToString();
}
