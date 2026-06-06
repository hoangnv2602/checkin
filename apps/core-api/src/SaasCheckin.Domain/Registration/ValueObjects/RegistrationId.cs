namespace SaasCheckin.Domain.Registration.ValueObjects;

public readonly record struct RegistrationId
{
    public Guid Value { get; }
    private RegistrationId(Guid value) => Value = value;
    public static RegistrationId New() => new(Guid.NewGuid());
    public static RegistrationId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("RegistrationId cannot be empty") : new RegistrationId(value);
    public static implicit operator Guid(RegistrationId id) => id.Value;
    public static explicit operator RegistrationId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
