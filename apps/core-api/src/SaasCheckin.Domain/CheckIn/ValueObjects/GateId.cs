namespace SaasCheckin.Domain.CheckIn.ValueObjects;

public readonly record struct GateId
{
    public Guid Value { get; }
    private GateId(Guid value) => Value = value;
    public static GateId New() => new(Guid.NewGuid());
    public static GateId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("GateId cannot be empty") : new GateId(value);
    public static implicit operator Guid(GateId id) => id.Value;
    public static explicit operator GateId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
