using FluentAssertions;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.Specifications;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.CheckIn;

internal sealed class CanCheckInFixedClock : IClock
{
    public CanCheckInFixedClock(DateTimeOffset now) => UtcNow = now;
    public DateTimeOffset UtcNow { get; }
}

public class CanCheckInSpecificationTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EventId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly CanCheckInFixedClock Clock = new(Now);

    private static Event PublishedEvent() => CreateEvent(EventStatus.Published);

    private static Event CreateEvent(EventStatus status)
    {
        var e = Event.Create(OrgId, "T", null,
            EventPeriod.Create(Now.AddHours(-1), Now.AddHours(2)),
            Capacity.Create(100), Clock);
        if (status == EventStatus.Published) e.Publish(Clock);
        return e;
    }

    private static SaasCheckin.Domain.Registration.Aggregates.Registration ActiveRegistration() => SaasCheckin.Domain.Registration.Aggregates.Registration.Issue(
        OrgId, EventId, Guid.NewGuid(), Guid.NewGuid(),
        "a@b.c", "X", null, TimeSpan.FromDays(1), Clock);

    [Fact]
    public void Satisfied_when_event_live_registration_active_no_prior_success()
    {
        var spec = new CanCheckInSpecification();
        var ok = spec.IsSatisfiedBy(PublishedEvent(), ActiveRegistration(),
            Array.Empty<CheckInRecord>(), Now);
        ok.Should().BeTrue();
    }

    [Fact]
    public void Rejected_when_event_not_published()
    {
        var spec = new CanCheckInSpecification();
        var ok = spec.IsSatisfiedBy(CreateEvent(EventStatus.Draft), ActiveRegistration(),
            Array.Empty<CheckInRecord>(), Now);
        ok.Should().BeFalse();
    }

    [Fact]
    public void Rejected_when_outside_event_window()
    {
        var spec = new CanCheckInSpecification();
        var ok = spec.IsSatisfiedBy(PublishedEvent(), ActiveRegistration(),
            Array.Empty<CheckInRecord>(), Now.AddDays(5));
        ok.Should().BeFalse();
    }

    [Fact]
    public void Rejected_when_registration_already_checked_in()
    {
        var spec = new CanCheckInSpecification();
        var rec = CheckInRecord.Success(OrgId, EventId, Guid.NewGuid(), Guid.NewGuid(),
            GateId.New(), Guid.NewGuid(), Now, Clock);
        var ok = spec.IsSatisfiedBy(PublishedEvent(), ActiveRegistration(),
            new[] { rec }, Now);
        ok.Should().BeFalse();
    }

    [Fact]
    public void Rejected_when_registration_revoked()
    {
        var spec = new CanCheckInSpecification();
        var reg = ActiveRegistration();
        reg.Revoke("test", Clock);
        var ok = spec.IsSatisfiedBy(PublishedEvent(), reg, Array.Empty<CheckInRecord>(), Now);
        ok.Should().BeFalse();
    }
}
