namespace SaasCheckin.Domain.Registration.ValueObjects;

public readonly record struct OrderId
{
    public Guid Value { get; }
    private OrderId(Guid value) => Value = value;
    public static OrderId New() => new(Guid.NewGuid());
    public static OrderId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("OrderId cannot be empty") : new OrderId(value);
    public static implicit operator Guid(OrderId id) => id.Value;
    public static explicit operator OrderId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
