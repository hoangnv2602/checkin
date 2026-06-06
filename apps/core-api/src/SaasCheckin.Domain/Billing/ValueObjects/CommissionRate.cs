// apps/core-api/src/SaasCheckin.Domain/Billing/ValueObjects/CommissionRate.cs
// I-803 — Commission rate value object. Basis points (5% = 500).
namespace SaasCheckin.Domain.Billing.ValueObjects;

public readonly record struct CommissionRate
{
    public int BasisPoints { get; }
    public decimal Percentage => BasisPoints / 100m;

    private CommissionRate(int basisPoints) => BasisPoints = basisPoints;

    public static CommissionRate FromBasisPoints(int bps) =>
        bps is < 0 or > 10000
            ? throw new ArgumentOutOfRangeException(nameof(bps), "must be 0..10000")
            : new CommissionRate(bps);

    public static CommissionRate FromPercent(decimal pct) =>
        FromBasisPoints((int)Math.Round(pct * 100m));

    public static CommissionRate Zero => new(0);

    /// <summary>
    /// Compute platform fee (application_fee_amount) từ gross amount.
    /// Trả về minor units (cents).
    /// </summary>
    public long ApplicationFee(long grossMinor) =>
        BasisPoints == 0 ? 0 : (grossMinor * BasisPoints) / 10000;

    public long OrganizerNet(long grossMinor) => grossMinor - ApplicationFee(grossMinor);
}
