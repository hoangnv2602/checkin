namespace SaasCheckin.Domain.Billing.ValueObjects;

public readonly record struct PlanId
{
    public Guid Value { get; }
    private PlanId(Guid value) => Value = value;
    public static PlanId New() => new(Guid.NewGuid());
    public static PlanId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("PlanId cannot be empty") : new PlanId(value);
    public static implicit operator Guid(PlanId id) => id.Value;
    public static explicit operator PlanId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}

public readonly record struct SubscriptionId
{
    public Guid Value { get; }
    private SubscriptionId(Guid value) => Value = value;
    public static SubscriptionId New() => new(Guid.NewGuid());
    public static SubscriptionId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("SubscriptionId cannot be empty") : new SubscriptionId(value);
    public static implicit operator Guid(SubscriptionId id) => id.Value;
    public static explicit operator SubscriptionId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}

public readonly record struct InvoiceId
{
    public Guid Value { get; }
    private InvoiceId(Guid value) => Value = value;
    public static InvoiceId New() => new(Guid.NewGuid());
    public static InvoiceId From(Guid value) =>
        value == Guid.Empty ? throw new ArgumentException("InvoiceId cannot be empty") : new InvoiceId(value);
    public static implicit operator Guid(InvoiceId id) => id.Value;
    public static explicit operator InvoiceId(Guid v) => From(v);
    public override string ToString() => Value.ToString();
}
