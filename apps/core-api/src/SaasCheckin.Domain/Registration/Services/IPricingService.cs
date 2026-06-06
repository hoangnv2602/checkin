using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Domain.Registration.Services;

/// <summary>
/// IPricingService — domain service tính subtotal/discount/total.
/// Inject qua DI; implementation sống ở SaasCheckin.Application hoặc Infrastructure.
/// Stateless, pure (no I/O trừ repository lookup nếu cần).
/// </summary>
public interface IPricingService
{
    /// <summary>
    /// Quote cho 1 yêu cầu mua vé. Tính subtotal = unitPrice × quantity, áp
    /// discount nếu có (resolve qua <paramref name="discountCode"/>), trả total.
    /// Trả null nếu discount code không hợp lệ / hết hạn.
    /// </summary>
    PricingQuote Quote(
        TicketType ticketType,
        int quantity,
        string? discountCode,
        DateTimeOffset now);
}

public sealed record PricingQuote(
    Money Subtotal,
    Money Discount,
    Money Total,
    string? AppliedDiscountCode,
    string? FailureReason)
{
    public bool IsValid => FailureReason is null && !Total.IsZero;
    public static PricingQuote Invalid(string reason, string currency) =>
        new(Money.Zero(currency), Money.Zero(currency), Money.Zero(currency), null, reason);
}
