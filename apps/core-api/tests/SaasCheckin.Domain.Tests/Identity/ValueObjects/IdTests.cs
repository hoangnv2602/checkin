// Tests/SaasCheckin.Domain.Tests/Identity/ValueObjects/IdTests.cs
using FluentAssertions;
using SaasCheckin.Domain.Identity.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.ValueObjects;

public class IdTests
{
    [Fact]
    public void should_generate_unique_user_ids()
    {
        var a = UserId.New();
        var b = UserId.New();
        a.Should().NotBe(b);
        a.Value.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void should_reject_empty_user_id()
    {
        Action act = () => UserId.From(Guid.Empty);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_implicit_cast_userid_to_guid()
    {
        var id = UserId.New();
        Guid g = id;
        g.Should().Be(id.Value);
    }

    [Fact]
    public void should_generate_unique_organization_ids()
    {
        var a = OrganizationId.New();
        var b = OrganizationId.New();
        a.Should().NotBe(b);
        a.Value.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void should_parse_organization_id_from_string()
    {
        var g = Guid.NewGuid();
        var id = OrganizationId.From(g.ToString());
        id.Value.Should().Be(g);
    }

    [Fact]
    public void should_throw_when_organization_id_string_invalid()
    {
        Action act = () => OrganizationId.From("not-a-guid");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_generate_unique_membership_ids()
    {
        var a = MembershipId.New();
        var b = MembershipId.New();
        a.Should().NotBe(b);
    }

    [Fact]
    public void should_throw_when_membership_id_empty()
    {
        Action act = () => MembershipId.From(Guid.Empty);
        act.Should().Throw<ArgumentException>();
    }
}
