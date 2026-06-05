// Tests/SaasCheckin.Domain.Tests/Identity/UserRegisterTests.cs
using FluentAssertions;
using Moq;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests;

/// <summary>
/// Unit test suite cho User.Register + login/lockout state machine.
/// I-105 commit 5.
/// </summary>
public class UserRegisterTests
{
    private readonly Mock<IClock> _clock = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public UserRegisterTests()
    {
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("$2a$12$hashed");
    }

    [Fact]
    public void should_register_user_with_valid_email_and_name()
    {
        var user = User.Register(
            Email.Create("alice@example.com"),
            FullName.Create("Alice Nguyễn"),
            _hasher.Object,
            "PlainTextP@ss",
            _clock.Object);

        user.Email.Value.Should().Be("alice@example.com");
        user.FullName.Value.Should().Be("Alice Nguyễn");
        user.PasswordHash.Should().Be("$2a$12$hashed");
        user.CreatedAt.Should().Be(_now);
        user.FailedLoginCount.Should().Be(0);
        user.LockedUntil.Should().BeNull();
    }

    [Fact]
    public void should_throw_when_email_is_invalid()
    {
        Action act = () => Email.Create("not-an-email");
        act.Should().Throw<ArgumentException>().WithMessage("*không hợp lệ*");
    }

    [Fact]
    public void should_throw_when_full_name_is_empty()
    {
        Action act = () => FullName.Create("   ");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_register_with_null_password_for_invited_user()
    {
        var user = User.Register(
            Email.Create("invited@example.com"),
            FullName.Create("Bob"),
            _hasher.Object,
            null,
            _clock.Object);

        user.PasswordHash.Should().BeNull();
    }

    [Fact]
    public void should_emit_user_registered_domain_event()
    {
        var user = User.Register(
            Email.Create("alice@example.com"),
            FullName.Create("Alice"),
            _hasher.Object,
            null,
            _clock.Object);

        user.DomainEvents.OfType<UserRegistered>().Should().HaveCount(1);
        var evt = user.DomainEvents.OfType<UserRegistered>().Single();
        evt.UserId.Should().Be(user.Id);
        evt.Email.Value.Should().Be("alice@example.com");
        evt.OccurredAt.Should().Be(_now);
    }

    [Fact]
    public void should_lock_user_after_5_failed_logins()
    {
        var user = CreateUser();

        for (var i = 0; i < 4; i++)
            user.RecordFailedLogin(_clock.Object, maxAttempts: 5);

        user.LockedUntil.Should().BeNull();

        user.RecordFailedLogin(_clock.Object, maxAttempts: 5);

        user.LockedUntil.Should().Be(_now.AddMinutes(15));
        user.DomainEvents.OfType<UserLockedOut>().Should().HaveCount(1);
    }

    [Fact]
    public void should_throw_on_login_when_locked()
    {
        var user = CreateUser();
        for (var i = 0; i < 5; i++)
            user.RecordFailedLogin(_clock.Object, maxAttempts: 5);

        Action act = () => user.RecordSuccessfulLogin(_clock.Object);
        act.Should().Throw<BusinessRuleViolationException>();
    }

    [Fact]
    public void should_reset_failed_count_after_successful_login()
    {
        var user = CreateUser();
        user.RecordFailedLogin(_clock.Object, maxAttempts: 5);
        user.RecordFailedLogin(_clock.Object, maxAttempts: 5);
        user.FailedLoginCount.Should().Be(2);

        user.RecordSuccessfulLogin(_clock.Object);

        user.FailedLoginCount.Should().Be(0);
        user.LastLoginAt.Should().Be(_now);
    }

    [Fact]
    public void should_clear_lockout_on_password_change()
    {
        var user = CreateUser();
        for (var i = 0; i < 5; i++)
            user.RecordFailedLogin(_clock.Object, maxAttempts: 5);

        user.ChangePassword(_hasher.Object, "NewP@ssword", _clock.Object);

        user.LockedUntil.Should().BeNull();
        user.FailedLoginCount.Should().Be(0);
        _hasher.Verify(h => h.HashPassword("NewP@ssword"), Times.Once);
    }

    [Fact]
    public void should_touch_updated_at_on_mutation()
    {
        var later = _now.AddMinutes(5);
        _clock.SetupGet(c => c.UtcNow).Returns(later);

        var user = CreateUser();
        user.RecordSuccessfulLogin(_clock.Object);

        user.UpdatedAt.Should().Be(later);
    }

    // ----- helpers -----
    private User CreateUser() => User.Register(
        Email.Create("alice@example.com"),
        FullName.Create("Alice"),
        _hasher.Object,
        "PlainP@ss",
        _clock.Object);
}
