using FluentAssertions;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.Registration;

public class RegistrationTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EventId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OrderId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid TtId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly FixedClock Clock = new(Now);

    private static Registration NewReg() => Registration.Issue(
        OrgId, EventId, OrderId, TtId,
        "attendee@example.com", "Alice", "+84 901 234 567",
        TimeSpan.FromDays(1), Clock);

    [Fact]
    public void Issue_creates_active_registration_with_unique_jti()
    {
        var r1 = NewReg();
        var r2 = NewReg();
        r1.Jti.Should().NotBe(Guid.Empty);
        r1.Jti.Should().NotBe(r2.Jti);
        r1.Status.Should().Be(RegistrationStatus.Active);
        r1.ExpiresAt.Should().Be(Now.AddDays(1));
    }

    [Fact]
    public void Issue_rejects_non_positive_validity()
    {
        Action act = () => Registration.Issue(
            OrgId, EventId, OrderId, TtId, "a@b.c", "X", null,
            TimeSpan.Zero, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void AttachQrImage_stores_url_and_signature()
    {
        var r = NewReg();
        r.AttachQrImage("https://cdn/qr/abc.png", "sigbase64", Clock);
        r.QrImageUrl.Should().Be("https://cdn/qr/abc.png");
        r.Signature.Should().Be("sigbase64");
    }

    [Fact]
    public void AttachQrImage_rejects_when_not_active()
    {
        var r = NewReg();
        r.MarkCheckedIn(Clock);
        Action act = () => r.AttachQrImage("x", "y", Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkCheckedIn_transitions_and_records_time()
    {
        var r = NewReg();
        r.MarkCheckedIn(Clock);
        r.Status.Should().Be(RegistrationStatus.CheckedIn);
        r.CheckedInAt.Should().Be(Now);
    }

    [Fact]
    public void Revoke_raises_domain_event()
    {
        var r = NewReg();
        r.Revoke("duplicate", Clock);
        r.Status.Should().Be(RegistrationStatus.Revoked);
        r.DomainEvents.Should().ContainSingle(e => e.GetType().Name == "TicketRevoked");
    }

    [Fact]
    public void ToQrPayload_round_trip_fields()
    {
        var r = NewReg();
        var p = r.ToQrPayload();
        p.Jti.Should().Be(r.Jti);
        p.RegistrationId.Should().Be(r.Id.Value);
        p.EventId.Should().Be(EventId);
        p.OrganizationId.Should().Be(OrgId);
        p.IssuedAt.Should().Be(Now);
        p.ExpiresAt.Should().Be(Now.AddDays(1));
    }
}
