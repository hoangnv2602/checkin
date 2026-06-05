namespace SaasCheckin.Domain.Registration.ValueObjects;

public readonly record struct TicketTypeId
{
    public Guid Value { get; }
    private TicketTypeId(Guid value) => Value = value;
    public static TicketTypeId New() => new(Guid.NewGuid());
    public static TicketTypeId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("TicketTypeId cannot be empty") : new TicketTypeId(value);
    public static implicit operator Guid(TicketTypeId id) => id.Value;
    public static explicit operator TicketTypeId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
