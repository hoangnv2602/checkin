using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.ValueObjects;

/// <summary>
/// Money — currency-aware amount. Stored in minor units (e.g. cents / xu) to
/// avoid floating-point drift; format on presentation layer.
/// </summary>
public readonly record struct Money
{
    /// <summary>Amount in minor units (e.g. cents). Always non-negative.</summary>
    public long AmountMinor { get; }

    /// <summary>ISO-4217 3-letter code (USD, VND, EUR…). 3-char invariant.</summary>
    public string Currency { get; }

    private Money(long amountMinor, string currency)
    {
        AmountMinor = amountMinor;
        Currency = currency;
    }

    public static Money Of(long amountMinor, string currency)
    {
        if (amountMinor < 0) throw new ArgumentException("Money cannot be negative", nameof(amountMinor));
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            throw new ArgumentException("Currency must be 3-char ISO-4217 code", nameof(currency));
        return new Money(amountMinor, currency.ToUpperInvariant());
    }

    public static Money Zero(string currency) => Of(0, currency);

    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return Of(AmountMinor + other.AmountMinor, Currency);
    }

    public Money Subtract(Money other)
    {
        EnsureSameCurrency(other);
        return Of(AmountMinor - other.AmountMinor, Currency);
    }

    public Money Multiply(int factor)
    {
        if (factor < 0) throw new ArgumentException("Factor must be >= 0", nameof(factor));
        return Of(AmountMinor * factor, Currency);
    }

    public bool IsZero => AmountMinor == 0;

    private void EnsureSameCurrency(Money other)
    {
        if (!string.Equals(Currency, other.Currency, StringComparison.Ordinal))
            throw new InvalidOperationException($"Currency mismatch: {Currency} vs {other.Currency}");
    }

    public override string ToString() => $"{AmountMinor / 100.0:0.00} {Currency}";
}
