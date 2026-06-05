using FluentAssertions;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.EventManagement;

internal sealed class FixedClock : IClock
{
    public FixedClock(DateTimeOffset now) => UtcNow = now;
    public DateTimeOffset UtcNow { get; }
}

/// <summary>
/// Unit tests for Event aggregate (I-201).
/// </summary>
public class EventTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly FixedClock Clock = new(new DateTimeOffset(2026, 6, 5, 10, 0, 0, TimeSpan.Zero));

    private static Event NewEvent() =>
        Event.Create(
            OrgId,
            "Tech Conference 2026",
            "Annual tech event",
            EventPeriod.Create(
                new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(500),
            Clock);

    [Fact]
    public void Create_returns_draft_event_with_id_and_organization()
    {
        var e = NewEvent();
        e.Id.Value.Should().NotBe(Guid.Empty);
        e.OrganizationId.Should().Be(OrgId);
        e.Status.Should().Be(EventStatus.Draft);
        e.SoldTickets.Should().Be(0);
        e.CreatedAt.Should().Be(Clock.UtcNow);
    }

    [Fact]
    public void Create_rejects_empty_organization_id()
    {
        Action act = () => Event.Create(
            Guid.Empty,
            "T",
            null,
            EventPeriod.Create(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(1)),
            Capacity.Create(10),
            Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_rejects_empty_title()
    {
        Action act = () => Event.Create(
            OrgId, "", null,
            EventPeriod.Create(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(1)),
            Capacity.Create(10),
            Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_rejects_title_over_200_chars()
    {
        Action act = () => Event.Create(
            OrgId, new string('x', 201), null,
            EventPeriod.Create(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(1)),
            Capacity.Create(10),
            Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Publish_transitions_Draft_to_Published_and_emits_event()
    {
        var e = NewEvent();
        e.Publish(Clock);
        e.Status.Should().Be(EventStatus.Published);
        e.DomainEvents.OfType<EventPublished>().Should().ContainSingle();
    }

    [Fact]
    public void Publish_throws_when_already_published()
    {
        var e = NewEvent();
        e.Publish(Clock);
        Action act = () => e.Publish(Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Cancel_transitions_to_Cancelled_and_is_idempotent()
    {
        var e = NewEvent();
        e.Publish(Clock);
        e.Cancel(Clock);
        e.Status.Should().Be(EventStatus.Cancelled);
        e.DomainEvents.OfType<EventCancelled>().Should().ContainSingle();

        // Idempotent
        e.Cancel(Clock);
        e.DomainEvents.OfType<EventCancelled>().Should().HaveCount(1);
    }

    [Fact]
    public void Update_rejects_when_published()
    {
        var e = NewEvent();
        e.Publish(Clock);
        Action act = () => e.Update("New title", null, null, null, Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Update_changes_fields_when_draft()
    {
        var e = NewEvent();
        e.Update("Updated", "New desc", null, Capacity.Create(800), Clock);
        e.Title.Should().Be("Updated");
        e.Description.Should().Be("New desc");
        e.Capacity.Value.Should().Be(800);
    }

    [Fact]
    public void Update_rejects_capacity_below_sold_tickets()
    {
        var e = NewEvent();
        e.IncrementSoldTickets(100, Clock);
        Action act = () => e.Update(null, null, null, Capacity.Create(50), Clock);
        act.Should().Throw<InvalidOperationException>().WithMessage("*below sold tickets*");
    }

    [Fact]
    public void IncrementSoldTickets_increments_and_validates_capacity()
    {
        var e = NewEvent();
        e.IncrementSoldTickets(10, Clock);
        e.SoldTickets.Should().Be(10);

        Action act = () => e.IncrementSoldTickets(1000, Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void EventPeriod_rejects_end_before_start()
    {
        Action act = () => EventPeriod.Create(
            new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero));
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Capacity_rejects_zero_and_negative()
    {
        Action act1 = () => Capacity.Create(0);
        act1.Should().Throw<ArgumentException>();
        Action act2 = () => Capacity.Create(-1);
        act2.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void GeoLocation_rejects_out_of_range()
    {
        Action act1 = () => GeoLocation.Create(91, 0);
        act1.Should().Throw<ArgumentException>();
        Action act2 = () => GeoLocation.Create(0, -181);
        act2.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void GeoLocation_accepts_valid_values()
    {
        var g = GeoLocation.Create(10.762622, 106.660172);
        g.Latitude.Should().Be(10.762622);
        g.Longitude.Should().Be(106.660172);
    }
}
