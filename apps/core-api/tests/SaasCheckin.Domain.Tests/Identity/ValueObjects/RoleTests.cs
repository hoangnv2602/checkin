// Tests/SaasCheckin.Domain.Tests/Identity/ValueObjects/RoleTests.cs
using FluentAssertions;
using SaasCheckin.Domain.Identity.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.ValueObjects;

public class RoleTests
{
    [Theory]
    [InlineData("owner")]
    [InlineData("admin")]
    [InlineData("organizer")]
    [InlineData("staff")]
    [InlineData("viewer")]
    public void should_accept_valid_role(string value)
    {
        var role = Role.Create(value);
        role.Value.Should().Be(value);
    }

    [Theory]
    [InlineData("Owner")]
    [InlineData("  admin  ")]
    public void should_normalize_case_and_trim(string value)
    {
        var role = Role.Create(value);
        role.Value.Should().Be(value.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData("superuser")]
    [InlineData("")]
    [InlineData("  ")]
    public void should_throw_when_role_invalid(string value)
    {
        Action act = () => Role.Create(value);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_have_exactly_5_valid_roles()
    {
        Role.AllValidRoles.Should().HaveCount(5);
        Role.AllValidRoles.Should().BeEquivalentTo(new[] { "owner", "admin", "organizer", "staff", "viewer" });
    }
}
