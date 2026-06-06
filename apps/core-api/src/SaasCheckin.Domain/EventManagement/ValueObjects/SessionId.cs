namespace SaasCheckin.Domain.EventManagement.ValueObjects;

public readonly record struct SessionId
{
    public Guid Value { get; }
    private SessionId(Guid value) => Value = value;
    public static SessionId New() => new(Guid.NewGuid());
    public static SessionId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("SessionId cannot be empty") : new SessionId(value);
    public static implicit operator Guid(SessionId id) => id.Value;
    public static explicit operator SessionId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
