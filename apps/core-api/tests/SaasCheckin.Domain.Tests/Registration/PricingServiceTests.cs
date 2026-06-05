using FluentAssertions;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.Registration;

public class PricingServiceTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EventId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly FixedClock Clock = new(Now);

    private static TicketType NewTicketType(long priceMinor = 5000) =>
        TicketType.Create(OrgId, EventId, "Standard", null,
            Money.Of(priceMinor, "USD"), 100, Now.AddDays(-1), Now.AddDays(30), Clock);

    [Fact]
    public void Quote_returns_subtotal_for_valid_quantity_no_discount()
    {
        var tt = NewTicketType(priceMinor: 5000);
        var svc = new PricingService(Clock);
        var q = svc.Quote(tt, 3, null, Now);

        q.IsValid.Should().BeTrue();
        q.Subtotal.AmountMinor.Should().Be(15000);
        q.Discount.AmountMinor.Should().Be(0);
        q.Total.AmountMinor.Should().Be(15000);
        q.AppliedDiscountCode.Should().BeNull();
    }

    [Fact]
    public void Quote_rejects_zero_quantity()
    {
        var tt = NewTicketType();
        var svc = new PricingService(Clock);
        var q = svc.Quote(tt, 0, null, Now);
        q.IsValid.Should().BeFalse();
        q.FailureReason.Should().Contain("Quantity");
    }

    [Fact]
    public void Quote_applies_percentage_discount()
    {
        var tt = NewTicketType(priceMinor: 10000);
        var code = DiscountCode.Create("SUMMER20", DiscountKind.Percentage, 20,
            Now.AddDays(1), maxRedemptions: null);
        var svc = new PricingService(Clock, (_, _) => code);
        var q = svc.Quote(tt, 2, "summer20", Now);

        q.IsValid.Should().BeTrue();
        q.Subtotal.AmountMinor.Should().Be(20000);
        q.Discount.AmountMinor.Should().Be(4000);  // 20% of 20000
        q.Total.AmountMinor.Should().Be(16000);
        q.AppliedDiscountCode.Should().Be("SUMMER20");
    }

    [Fact]
    public void Quote_applies_fixed_amount_discount()
    {
        var tt = NewTicketType(priceMinor: 5000);
        var code = DiscountCode.Create("FLAT5", DiscountKind.FixedAmount, 500,
            Now.AddDays(1), maxRedemptions: null);
        var svc = new PricingService(Clock, (_, _) => code);
        var q = svc.Quote(tt, 3, "flat5", Now);

        q.IsValid.Should().BeTrue();
        q.Discount.AmountMinor.Should().Be(500);
        q.Total.AmountMinor.Should().Be(14500);
    }

    [Fact]
    public void Quote_caps_fixed_discount_at_subtotal()
    {
        var tt = NewTicketType(priceMinor: 1000);
        var code = DiscountCode.Create("BIG", DiscountKind.FixedAmount, 9999,
            Now.AddDays(1), maxRedemptions: null);
        var svc = new PricingService(Clock, (_, _) => code);
        var q = svc.Quote(tt, 1, "big", Now);

        q.IsValid.Should().BeTrue();
        q.Discount.AmountMinor.Should().Be(1000);
        q.Total.AmountMinor.Should().Be(0);
    }

    [Fact]
    public void Quote_rejects_unknown_discount_code()
    {
        var tt = NewTicketType();
        var svc = new PricingService(Clock, (_, _) => null);
        var q = svc.Quote(tt, 1, "NOPE", Now);
        q.IsValid.Should().BeFalse();
        q.FailureReason.Should().Contain("not found");
    }

    [Fact]
    public void Quote_rejects_expired_discount_code()
    {
        var tt = NewTicketType();
        var code = DiscountCode.Create("OLD", DiscountKind.Percentage, 10,
            Now.AddDays(-1), maxRedemptions: null);
        var svc = new PricingService(Clock, (_, _) => code);
        var q = svc.Quote(tt, 1, "old", Now);
        q.IsValid.Should().BeFalse();
        q.FailureReason.Should().Contain("expired");
    }

    [Fact]
    public void Quote_normalizes_code_case()
    {
        var tt = NewTicketType();
        DiscountCode? captured = null;
        var svc = new PricingService(Clock, (code, _) =>
        {
            captured = DiscountCode.Create(code, DiscountKind.Percentage, 10, Now.AddDays(1), null);
            return captured;
        });
        svc.Quote(tt, 1, "MixedCase", Now);
        captured!.Code.Should().Be("MIXEDCASE");
    }
}
