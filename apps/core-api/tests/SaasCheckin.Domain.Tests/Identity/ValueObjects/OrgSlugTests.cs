// Tests/SaasCheckin.Domain.Tests/Identity/ValueObjects/OrgSlugTests.cs
using FluentAssertions;
using SaasCheckin.Domain.Identity.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.ValueObjects;

public class OrgSlugTests
{
    [Theory]
    [InlineData("acme")]
    [InlineData("acme-events")]
    [InlineData("my-org-2024")]
    [InlineData("abc")]
    public void should_accept_valid_slug(string value)
    {
        var slug = OrgSlug.Create(value);
        slug.Value.Should().Be(value);
    }

    [Fact]
    public void should_lowercase_input()
    {
        var slug = OrgSlug.Create("AcmeEvents");
        slug.Value.Should().Be("acmeevents");
    }

    [Theory]
    [InlineData("ab")]                 // too short (3 min)
    [InlineData("-leading-dash")]
    [InlineData("trailing-dash-")]
    [InlineData("has space")]
    [InlineData("under_score")]
    [InlineData("dot.dot")]
    [InlineData("")]
    public void should_throw_when_slug_invalid(string value)
    {
        Action act = () => OrgSlug.Create(value);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_throw_when_slug_too_long()
    {
        var value = new string('a', 41);
        Action act = () => OrgSlug.Create(value);
        act.Should().Throw<ArgumentException>();
    }
}
