// Tests/SaasCheckin.Domain.Tests/Identity/ValueObjects/EmailTests.cs
using FluentAssertions;
using SaasCheckin.Domain.Identity.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.ValueObjects;

public class EmailTests
{
    [Theory]
    [InlineData("alice@example.com")]
    [InlineData("a.b+c@sub.example.co")]
    [InlineData("user123@123.45.67.89")]
    [InlineData("ALICE@EXAMPLE.COM")]
    public void should_accept_valid_email(string value)
    {
        var email = Email.Create(value);
        email.Value.Should().Be(value.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("missing@dot")]
    [InlineData("@nope.com")]
    [InlineData("nope@")]
    [InlineData("nope@nope")]
    [InlineData("")]
    [InlineData("   ")]
    public void should_throw_when_email_is_invalid(string value)
    {
        Action act = () => Email.Create(value);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_throw_when_email_too_long()
    {
        var local = new string('a', 250);
        var value = $"{local}@x.io";
        Action act = () => Email.Create(value);
        act.Should().Throw<ArgumentException>().WithMessage("*254*");
    }

    [Fact]
    public void should_normalize_whitespace_and_case()
    {
        var email = Email.Create("  Alice@Example.COM  ");
        email.Value.Should().Be("alice@example.com");
    }
}
