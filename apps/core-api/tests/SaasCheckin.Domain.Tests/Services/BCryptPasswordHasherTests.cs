// Tests/SaasCheckin.Domain.Tests/Services/BCryptPasswordHasherTests.cs
using FluentAssertions;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.Services;

public class BCryptPasswordHasherTests
{
    private readonly BCryptPasswordHasher _hasher = new();

    [Fact]
    public void should_hash_password_differently_from_plaintext()
    {
        var hash = _hasher.HashPassword("PlainP@ss123");
        hash.Should().NotBe("PlainP@ss123");
        hash.Should().StartWith("$2");
    }

    [Fact]
    public void should_verify_correct_password()
    {
        var hash = _hasher.HashPassword("PlainP@ss123");
        _hasher.VerifyPassword("PlainP@ss123", hash).Should().BeTrue();
    }

    [Fact]
    public void should_return_false_for_wrong_password()
    {
        var hash = _hasher.HashPassword("PlainP@ss123");
        _hasher.VerifyPassword("WrongP@ss", hash).Should().BeFalse();
    }

    [Fact]
    public void should_return_false_for_malformed_hash()
    {
        _hasher.VerifyPassword("anything", "not-a-bcrypt-hash").Should().BeFalse();
    }

    [Fact]
    public void should_return_false_for_empty_inputs()
    {
        _hasher.VerifyPassword("", "any").Should().BeFalse();
        _hasher.VerifyPassword("any", "").Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    public void should_throw_when_password_too_short(string plain)
    {
        Action act = () => _hasher.HashPassword(plain);
        act.Should().Throw<ArgumentException>();
    }
}
