// Tests/SaasCheckin.Domain.Tests/Identity/ValueObjects/FullNameTests.cs
using FluentAssertions;
using SaasCheckin.Domain.Identity.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.ValueObjects;

public class FullNameTests
{
    [Theory]
    [InlineData("Alice Nguyễn")]
    [InlineData("Bob")]
    [InlineData("A B C D")]
    public void should_accept_valid_name(string value)
    {
        var name = FullName.Create(value);
        name.Value.Should().Be(value.Trim());
    }

    [Fact]
    public void should_collapse_internal_whitespace()
    {
        var name = FullName.Create("  Alice   Nguyễn  ");
        name.Value.Should().Be("Alice Nguyễn");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void should_throw_when_name_is_empty(string value)
    {
        Action act = () => FullName.Create(value);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_throw_when_name_too_long()
    {
        var value = new string('a', 201);
        Action act = () => FullName.Create(value);
        act.Should().Throw<ArgumentException>().WithMessage("*200*");
    }
}
