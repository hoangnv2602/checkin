namespace SaasCheckin.Domain.EventManagement.ValueObjects;

public readonly record struct VenueId
{
    public Guid Value { get; }
    private VenueId(Guid value) => Value = value;
    public static VenueId New() => new(Guid.NewGuid());
    public static VenueId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("VenueId cannot be empty") : new VenueId(value);
    public static implicit operator Guid(VenueId id) => id.Value;
    public static explicit operator VenueId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
