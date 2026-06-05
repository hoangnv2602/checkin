using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.ValueObjects;

/// <summary>
/// DiscountCode — campaign code. Pure (no I/O); validation ở Order aggregate.
/// Stored uppercased; case-insensitive lookup.
/// </summary>
public sealed record DiscountCode
{
    public string Code { get; }
    public DiscountKind Kind { get; }
    public long ValueMinor { get; }      // percent (1..100) hoặc fixed amount
    public DateTimeOffset ExpiresAt { get; }
    public int? MaxRedemptions { get; }

    private DiscountCode(
        string code,
        DiscountKind kind,
        long valueMinor,
        DateTimeOffset expiresAt,
        int? maxRedemptions)
    {
        Code = code;
        Kind = kind;
        ValueMinor = valueMinor;
        ExpiresAt = expiresAt;
        MaxRedemptions = maxRedemptions;
    }

    public static DiscountCode Create(
        string code,
        DiscountKind kind,
        long valueMinor,
        DateTimeOffset expiresAt,
        int? maxRedemptions = null)
    {
        Guard.NotNullOrWhiteSpace(code, nameof(code));
        if (code.Length > 50) throw new ArgumentException("Code > 50 chars", nameof(code));
        if (valueMinor <= 0) throw new ArgumentException("Value must be > 0", nameof(valueMinor));
        if (kind == DiscountKind.Percentage && valueMinor > 100)
            throw new ArgumentException("Percentage discount cannot exceed 100", nameof(valueMinor));
        if (maxRedemptions is <= 0)
            throw new ArgumentException("MaxRedemptions must be > 0 if set", nameof(maxRedemptions));

        return new DiscountCode(code.Trim().ToUpperInvariant(), kind, valueMinor, expiresAt, maxRedemptions);
    }

    public bool IsActiveAt(DateTimeOffset now) => now < ExpiresAt;
}

public enum DiscountKind
{
    Percentage = 0,
    FixedAmount = 1
}
