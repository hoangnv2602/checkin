using FluentAssertions;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.Registration;

public class OrderTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EventId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid TtId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly FixedClock Clock = new(Now);

    private static Order NewPending() => Order.Create(
        OrgId, EventId, TtId, 2, "buyer@example.com", "Jane Doe",
        Money.Of(10000, "USD"), Money.Of(0, "USD"), Money.Of(10000, "USD"),
        null, PaymentProvider.Stripe, TimeSpan.FromMinutes(10), Clock);

    [Fact]
    public void Create_initializes_pending_state()
    {
        var o = NewPending();
        o.Status.Should().Be(OrderStatus.Pending);
        o.Quantity.Should().Be(2);
        o.Total.AmountMinor.Should().Be(10000);
        o.ProviderSessionId.Should().BeNull();
    }

    [Fact]
    public void Create_rejects_total_mismatch()
    {
        Action act = () => Order.Create(
            OrgId, EventId, TtId, 1, "a@b.c", "X",
            Money.Of(100, "USD"), Money.Of(0, "USD"), Money.Of(200, "USD"),
            null, PaymentProvider.Stripe, TimeSpan.FromMinutes(10), Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_rejects_currency_mismatch()
    {
        Action act = () => Order.Create(
            OrgId, EventId, TtId, 1, "a@b.c", "X",
            Money.Of(100, "USD"), Money.Of(0, "EUR"), Money.Of(100, "USD"),
            null, PaymentProvider.Stripe, TimeSpan.FromMinutes(10), Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void AttachProviderSession_sets_id()
    {
        var o = NewPending();
        o.AttachProviderSession("cs_test_123", Clock);
        o.ProviderSessionId.Should().Be("cs_test_123");
    }

    [Fact]
    public void MarkPaid_transitions_to_paid_and_raises_event()
    {
        var o = NewPending();
        o.MarkPaid("cs_test_123", Clock);
        o.Status.Should().Be(OrderStatus.Paid);
        o.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "OrderPaid");
    }

    [Fact]
    public void MarkPaid_rejects_double_paid()
    {
        var o = NewPending();
        o.MarkPaid("cs_1", Clock);
        Action act = () => o.MarkPaid("cs_2", Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkFailed_transitions_to_failed_and_raises_event()
    {
        var o = NewPending();
        o.MarkFailed("card_declined", Clock);
        o.Status.Should().Be(OrderStatus.Failed);
        o.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "OrderFailed");
    }

    [Fact]
    public void IsExpiredAt_returns_true_when_pending_and_past_expiry()
    {
        var o = NewPending();
        o.IsExpiredAt(Now.AddMinutes(20)).Should().BeTrue();
    }

    [Fact]
    public void IsExpiredAt_returns_false_for_paid_order()
    {
        var o = NewPending();
        o.MarkPaid("cs", Clock);
        o.IsExpiredAt(Now.AddMinutes(20)).Should().BeFalse();
    }
}
