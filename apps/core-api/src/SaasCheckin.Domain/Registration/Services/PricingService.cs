using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.Services;

/// <summary>
/// Default PricingService — pure domain service, không cần I/O. Tính toán
/// từ unit price + discount code string (campaign lookup delegate cung cấp từ
/// Application layer qua constructor).
/// </summary>
public sealed class PricingService : IPricingService
{
    private readonly Func<string, Guid, DiscountCode?> _discountLookup;
    private readonly IClock _clock;

    public PricingService(IClock clock, Func<string, Guid, DiscountCode?>? discountLookup = null)
    {
        _clock = clock;
        _discountLookup = discountLookup ?? ((_, _) => null);
    }

    public PricingQuote Quote(
        TicketType ticketType,
        int quantity,
        string? discountCode,
        DateTimeOffset now)
    {
        if (quantity <= 0) return PricingQuote.Invalid("Quantity must be > 0", ticketType.Price.Currency);

        var subtotal = ticketType.Price.Multiply(quantity);
        Money discount = Money.Zero(subtotal.Currency);

        if (string.IsNullOrWhiteSpace(discountCode)) return new(subtotal, discount, subtotal, null, null);

        var normalized = discountCode.Trim().ToUpperInvariant();
        var code = _discountLookup(normalized, ticketType.OrganizationId);
        if (code is null) return PricingQuote.Invalid("Discount code not found", subtotal.Currency);
        if (!code.IsActiveAt(now)) return PricingQuote.Invalid("Discount code expired", subtotal.Currency);

        discount = code.Kind switch
        {
            DiscountKind.Percentage => Money.Of(subtotal.AmountMinor * code.ValueMinor / 100, subtotal.Currency),
            DiscountKind.FixedAmount => Money.Of(Math.Min(code.ValueMinor, subtotal.AmountMinor), subtotal.Currency),
            _ => discount
        };

        var total = subtotal.Subtract(discount);
        return new PricingQuote(subtotal, discount, total, code.Code, null);
    }
}
