namespace SaasCheckin.Domain.Billing.ValueObjects;

/// <summary>
/// Money — re-exported from Registration for Billing context. Cùng minor-unit
/// + currency invariant.
/// </summary>
public readonly record struct Money(long AmountMinor, string Currency)
{
    public static Money Of(long amountMinor, string currency)
    {
        if (amountMinor < 0) throw new ArgumentException("Money cannot be negative", nameof(amountMinor));
        if (currency.Length != 3) throw new ArgumentException("Currency must be 3-char", nameof(currency));
        return new Money(amountMinor, currency.ToUpperInvariant());
    }

    public static Money Zero(string currency) => Of(0, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency) throw new InvalidOperationException("Currency mismatch");
        return Of(AmountMinor + other.AmountMinor, Currency);
    }

    public bool IsZero => AmountMinor == 0;
}
