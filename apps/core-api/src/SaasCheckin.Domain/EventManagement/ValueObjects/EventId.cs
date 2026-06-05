namespace SaasCheckin.Domain.EventManagement.ValueObjects;

public readonly record struct EventId
{
    public Guid Value { get; }
    private EventId(Guid value) => Value = value;
    public static EventId New() => new(Guid.NewGuid());
    public static EventId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("EventId cannot be empty") : new EventId(value);
    public static implicit operator Guid(EventId id) => id.Value;
    public static explicit operator EventId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
