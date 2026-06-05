using FluentAssertions;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.CheckIn;

internal sealed class FixedClock : IClock
{
    public FixedClock(DateTimeOffset now) => UtcNow = now;
    public DateTimeOffset UtcNow { get; }
}

public class CheckInRecordTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EventId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid RegId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid Jti = Guid.NewGuid();
    private static readonly GateId Gate = GateId.New();
    private static readonly Guid Staff = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly FixedClock Clock = new(Now);

    [Fact]
    public void Success_creates_record_with_AttendeeCheckedIn_event()
    {
        var rec = CheckInRecord.Success(OrgId, EventId, RegId, Jti, Gate, Staff, Now, Clock);
        rec.Status.Should().Be(CheckInStatus.Success);
        rec.RejectReason.Should().BeNull();
        rec.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "AttendeeCheckedIn");
    }

    [Fact]
    public void Rejected_requires_reason()
    {
        Action act = () => CheckInRecord.Rejected(
            OrgId, EventId, RegId, Jti, Gate, Staff, "", Now, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Rejected_stores_reason_and_raises_event()
    {
        var rec = CheckInRecord.Rejected(OrgId, EventId, RegId, Jti, Gate, Staff,
            "Invalid signature", Now, Clock);
        rec.Status.Should().Be(CheckInStatus.Rejected);
        rec.RejectReason.Should().Be("Invalid signature");
        rec.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "CheckInRejected");
    }

    [Fact]
    public void Duplicate_records_preset_reason_and_raises_suspicious_event()
    {
        var rec = CheckInRecord.Duplicate(OrgId, EventId, RegId, Jti, Gate, Staff, Now, Clock);
        rec.Status.Should().Be(CheckInStatus.Duplicate);
        rec.RejectReason.Should().Contain("Already checked in");
        rec.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "SuspiciousDuplicate");
    }

    [Fact]
    public void All_factory_methods_reject_empty_organization_id()
    {
        Action act = () => CheckInRecord.Success(Guid.Empty, EventId, RegId, Jti, Gate, Staff, Now, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void All_factory_methods_reject_empty_jti()
    {
        Action act = () => CheckInRecord.Success(OrgId, EventId, RegId, Guid.Empty, Gate, Staff, Now, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void All_factory_methods_reject_empty_staff_id()
    {
        Action act = () => CheckInRecord.Success(OrgId, EventId, RegId, Jti, Gate, Guid.Empty, Now, Clock);
        act.Should().Throw<ArgumentException>();
    }
}
