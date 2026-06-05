// Tests/SaasCheckin.Domain.Tests/Identity/UserVerifyEmailTests.cs
using FluentAssertions;
using Moq;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests;

public class UserVerifyEmailTests
{
    private readonly Mock<IClock> _clock = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public UserVerifyEmailTests()
    {
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("$2a$12$hashed");
    }

    [Fact]
    public void should_set_email_verified_at_when_verified()
    {
        var user = NewUser();
        user.VerifyEmail(_clock.Object);

        user.EmailVerifiedAt.Should().Be(_now);
    }

    [Fact]
    public void should_emit_user_email_verified_event()
    {
        var user = NewUser();
        user.VerifyEmail(_clock.Object);

        user.DomainEvents.OfType<UserEmailVerified>().Should().HaveCount(1);
    }

    [Fact]
    public void should_throw_when_verified_twice()
    {
        var user = NewUser();
        user.VerifyEmail(_clock.Object);

        Action act = () => user.VerifyEmail(_clock.Object);
        act.Should().Throw<BusinessRuleViolationException>().WithMessage("*đã verified*");
    }

    private User NewUser() => User.Register(
        Email.Create("alice@example.com"),
        FullName.Create("Alice"),
        _hasher.Object,
        "PlainP@ss",
        _clock.Object);
}
