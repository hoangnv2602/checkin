// Tests/SaasCheckin.Domain.Tests/Identity/MembershipTests.cs
using FluentAssertions;
using Moq;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests;

public class MembershipTests
{
    private readonly Mock<IClock> _clock = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public MembershipTests()
    {
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
    }

    [Fact]
    public void should_emit_user_invited_event_on_invite()
    {
        var m = Membership.Invite(
            UserId.New(),
            OrganizationId.New(),
            Role.Create(Role.Organizer),
            _clock.Object);

        m.Status.Should().Be(MembershipStatus.Pending);
        m.JoinedAt.Should().BeNull();
        m.DomainEvents.OfType<UserInvited>().Should().HaveCount(1);
    }

    [Fact]
    public void should_create_owner_with_active_status()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);

        m.Status.Should().Be(MembershipStatus.Active);
        m.JoinedAt.Should().Be(_now);
        m.Role.Value.Should().Be(Role.Owner);
    }

    [Fact]
    public void should_activate_pending_membership()
    {
        var m = Membership.Invite(UserId.New(), OrganizationId.New(), Role.Create(Role.Staff), _clock.Object);
        m.Activate(_clock.Object);

        m.Status.Should().Be(MembershipStatus.Active);
        m.JoinedAt.Should().Be(_now);
    }

    [Fact]
    public void should_throw_when_activate_already_active()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);
        Action act = () => m.Activate(_clock.Object);
        act.Should().Throw<BusinessRuleViolationException>().WithMessage("*đã active*");
    }

    [Fact]
    public void should_throw_when_activate_revoked()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);
        m.Revoke(_clock.Object);
        Action act = () => m.Activate(_clock.Object);
        act.Should().Throw<BusinessRuleViolationException>();
    }

    [Fact]
    public void should_throw_when_change_role_on_revoked()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);
        m.Revoke(_clock.Object);
        Action act = () => m.ChangeRole(Role.Create(Role.Admin), _clock.Object);
        act.Should().Throw<BusinessRuleViolationException>();
    }

    [Fact]
    public void should_change_role_emit_event()
    {
        var m = Membership.Invite(UserId.New(), OrganizationId.New(), Role.Create(Role.Organizer), _clock.Object);
        m.Activate(_clock.Object);
        m.ChangeRole(Role.Create(Role.Admin), _clock.Object);

        m.Role.Value.Should().Be(Role.Admin);
        m.DomainEvents.OfType<RoleChanged>().Should().HaveCount(1);
        var evt = m.DomainEvents.OfType<RoleChanged>().Single();
        evt.OldRole.Should().Be(Role.Organizer);
        evt.NewRole.Should().Be(Role.Admin);
    }

    [Fact]
    public void should_throw_when_demote_owner_directly()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);
        Action act = () => m.ChangeRole(Role.Create(Role.Admin), _clock.Object);
        act.Should().Throw<BusinessRuleViolationException>().WithMessage("*MembersTransferOwnership*");
    }

    [Fact]
    public void should_revoke_membership()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);
        m.Revoke(_clock.Object);

        m.Status.Should().Be(MembershipStatus.Revoked);
        m.RevokedAt.Should().Be(_now);
        m.IsActiveNow().Should().BeFalse();
    }

    [Fact]
    public void should_throw_when_revoke_twice()
    {
        var m = Membership.CreateOwner(UserId.New(), OrganizationId.New(), _clock.Object);
        m.Revoke(_clock.Object);
        Action act = () => m.Revoke(_clock.Object);
        act.Should().Throw<BusinessRuleViolationException>();
    }
}
