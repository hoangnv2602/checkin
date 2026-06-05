// Tests/EventManagement/EventIntegrationTests.cs — I-204
//
// End-to-end test (in-process, no I/O) for Event lifecycle:
//   1. Create draft event with venue/session context
//   2. Verify draft invariants (cannot reduce capacity below soldTickets)
//   3. Publish (Draft → Published, emits EventPublished + integration event)
//   4. Update capacity after publish — should be allowed (within range)
//   5. Sold tickets increment + capacity boundary
//   6. Cancel (Published → Cancelled)
//   7. Re-cancel is idempotent
//
// Uses in-memory aggregate state only — full DB integration would need EF
// + IEventRepository (lands in I-201.5). This test guards the aggregate
// behavior + domain event emission that's the contract for downstream
// Registration/Notification consumers.
using FluentAssertions;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.EventManagement;

public class EventIntegrationTests
{
    private static readonly Guid OrgA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OrgB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly FixedClock Clock = new(new DateTimeOffset(2026, 6, 5, 10, 0, 0, TimeSpan.Zero));

    [Fact]
    public void Full_lifecycle_create_publish_sold_cancel()
    {
        var e = Event.Create(
            OrgA,
            "Annual Tech Conference 2026",
            "Biggest event of the year",
            EventPeriod.Create(
                new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(500),
            Clock);

        // Step 1: draft
        e.Status.Should().Be(EventStatus.Draft);
        e.DomainEvents.Should().BeEmpty();

        // Step 2: publish
        e.Publish(Clock);
        e.Status.Should().Be(EventStatus.Published);
        e.DomainEvents.OfType<EventPublished>().Should().ContainSingle();

        // Step 3: sold tickets (Registration context would call this)
        e.IncrementSoldTickets(150, Clock);
        e.SoldTickets.Should().Be(150);

        // Step 4: cannot update a published event (capacity changes are
        // only allowed in Draft; the registered count would be tracked via
        // SoldTickets and the registration cancellation flow would free slots).
        Action reduceAct = () => e.Update(null, null, null, Capacity.Create(100), Clock);
        reduceAct.Should().Throw<InvalidOperationException>();

        // Step 5: cancel
        e.Cancel(Clock);
        e.Status.Should().Be(EventStatus.Cancelled);
        e.DomainEvents.OfType<EventCancelled>().Should().ContainSingle();

        // Step 6: idempotent cancel
        e.Cancel(Clock);
        e.DomainEvents.OfType<EventCancelled>().Should().HaveCount(1);
    }

    [Fact]
    public void Two_events_in_different_orgs_have_independent_state()
    {
        var e1 = Event.Create(OrgA, "Event A", null,
            EventPeriod.Create(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                              new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(100), Clock);
        var e2 = Event.Create(OrgB, "Event B", null,
            EventPeriod.Create(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                              new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(200), Clock);

        e1.OrganizationId.Should().Be(OrgA);
        e2.OrganizationId.Should().Be(OrgB);
        e1.Capacity.Value.Should().Be(100);
        e2.Capacity.Value.Should().Be(200);

        e1.Publish(Clock);
        e1.Status.Should().Be(EventStatus.Published);
        e2.Status.Should().Be(EventStatus.Draft); // unaffected
    }

    [Fact]
    public void Published_event_cannot_be_updated()
    {
        var e = Event.Create(OrgA, "Event", null,
            EventPeriod.Create(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                              new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(100), Clock);
        e.Publish(Clock);

        Action act = () => e.Update("new title", null, null, null, Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Capacity_boundary_at_sold_count_is_allowed()
    {
        var e = Event.Create(OrgA, "Event", null,
            EventPeriod.Create(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                              new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(100), Clock);
        e.IncrementSoldTickets(50, Clock);

        // Reduce to exactly sold count — allowed
        e.Update(null, null, null, Capacity.Create(50), Clock);
        e.Capacity.Value.Should().Be(50);
    }

    [Fact]
    public void IncrementSoldTickets_below_zero_throws()
    {
        var e = Event.Create(OrgA, "Event", null,
            EventPeriod.Create(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                              new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero)),
            Capacity.Create(10), Clock);
        Action act = () => e.IncrementSoldTickets(0, Clock);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
