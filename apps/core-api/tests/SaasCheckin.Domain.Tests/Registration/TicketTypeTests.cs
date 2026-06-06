using FluentAssertions;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.Registration;

internal sealed class FixedClock : IClock
{
    public FixedClock(DateTimeOffset now) => UtcNow = now;
    public DateTimeOffset UtcNow { get; }
}

public class TicketTypeTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EventId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly FixedClock Clock = new(Now);

    private static TicketType NewTicketType(int capacity = 100, long price = 5000) =>
        TicketType.Create(
            OrgId, EventId, "Standard", "General admission",
            Money.Of(price, "USD"),
            capacity,
            Now.AddDays(-1), Now.AddDays(30),
            Clock);

    [Fact]
    public void Create_sets_initial_state()
    {
        var tt = NewTicketType();
        tt.Id.Value.Should().NotBe(Guid.Empty);
        tt.OrganizationId.Should().Be(OrgId);
        tt.EventId.Should().Be(EventId);
        tt.Name.Should().Be("Standard");
        tt.Price.AmountMinor.Should().Be(5000);
        tt.Price.Currency.Should().Be("USD");
        tt.Capacity.Should().Be(100);
        tt.SoldCount.Should().Be(0);
        tt.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Create_rejects_invalid_capacity()
    {
        Action act = () => TicketType.Create(
            OrgId, EventId, "X", null, Money.Of(100, "USD"),
            0, Now, Now.AddDays(1), Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_rejects_inverted_sale_window()
    {
        Action act = () => TicketType.Create(
            OrgId, EventId, "X", null, Money.Of(100, "USD"),
            10, Now.AddDays(1), Now, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ReserveSeats_increments_sold_count()
    {
        var tt = NewTicketType();
        tt.ReserveSeats(5, Clock);
        tt.SoldCount.Should().Be(5);
    }

    [Fact]
    public void ReserveSeats_rejects_overflow()
    {
        var tt = NewTicketType(capacity: 10);
        Action act = () => tt.ReserveSeats(11, Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void ReserveSeats_rejects_outside_sale_window()
    {
        var clock = new FixedClock(Now.AddDays(60));
        var tt = NewTicketType();
        Action act = () => tt.ReserveSeats(1, clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void ReleaseSeats_decrements_sold_count()
    {
        var tt = NewTicketType();
        tt.ReserveSeats(5, Clock);
        tt.ReleaseSeats(2, Clock);
        tt.SoldCount.Should().Be(3);
    }

    [Fact]
    public void ReleaseSeats_rejects_negative()
    {
        var tt = NewTicketType();
        Action act = () => tt.ReleaseSeats(1, Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Deactivate_raises_domain_event()
    {
        var tt = NewTicketType();
        tt.Deactivate(Clock);
        tt.IsActive.Should().BeFalse();
        tt.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "TicketTypeDeactivated");
    }
}
