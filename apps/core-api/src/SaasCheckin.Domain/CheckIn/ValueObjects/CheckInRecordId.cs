namespace SaasCheckin.Domain.CheckIn.ValueObjects;

public readonly record struct CheckInRecordId
{
    public Guid Value { get; }
    private CheckInRecordId(Guid value) => Value = value;
    public static CheckInRecordId New() => new(Guid.NewGuid());
    public static CheckInRecordId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("CheckInRecordId cannot be empty") : new CheckInRecordId(value);
    public static implicit operator Guid(CheckInRecordId id) => id.Value;
    public static explicit operator CheckInRecordId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
