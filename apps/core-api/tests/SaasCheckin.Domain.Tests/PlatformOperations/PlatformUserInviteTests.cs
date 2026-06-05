using FluentAssertions;
using Moq;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Events;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Domain.Tests.PlatformOperations;

/// <summary>
/// Unit tests for PlatformUser.Invite state machine (I-106).
/// </summary>
public class PlatformUserInviteTests
{
    private static readonly FixedClock FixedClock = new(new DateTimeOffset(2026, 6, 5, 10, 0, 0, TimeSpan.Zero));

    [Fact]
    public void Invite_with_valid_inputs_emits_PlatformUserInvited()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword("VeryStrongP@ss123")).Returns("hashed:abc");
        var user = PlatformUser.Invite(
            Email.Create("owner@saas-checkin.com"),
            "Platform Owner",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformOwner,
            FixedClock);

        user.Email.Value.Should().Be("owner@saas-checkin.com");
        user.FullName.Should().Be("Platform Owner");
        user.PasswordHash.Should().Be("hashed:abc");
        user.Role.Should().Be(PlatformRole.PlatformOwner);
        user.MfaEnabled.Should().BeFalse();
        user.MfaSecret.Should().BeNull();
        user.LockedUntil.Should().BeNull();
        user.FailedLoginCount.Should().Be(0);
        user.CreatedAt.Should().Be(FixedClock.UtcNow);
        user.DomainEvents.Should().ContainSingle(e => e is PlatformUserInvited);
    }

    [Fact]
    public void Invite_rejects_short_password()
    {
        var hasher = new Mock<IPasswordHasher>();
        Action act = () => PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "short",
            PlatformRole.PlatformSupport,
            FixedClock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Invite_rejects_empty_full_name()
    {
        var hasher = new Mock<IPasswordHasher>();
        Action act = () => PlatformUser.Invite(
            Email.Create("a@b.test"),
            "   ",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformSupport,
            FixedClock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void VerifyPassword_returns_false_on_bad_password_and_increments_failed_count()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hash");
        hasher.Setup(h => h.VerifyPassword("wrong", "hash")).Returns(false);
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformEngineer,
            FixedClock);

        var ok = user.VerifyPassword("wrong", hasher.Object, FixedClock);
        ok.Should().BeFalse();
        user.FailedLoginCount.Should().Be(1);
        user.LockedUntil.Should().BeNull();
    }

    [Fact]
    public void VerifyPassword_locks_after_5_failed_attempts()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hash");
        hasher.Setup(h => h.VerifyPassword("wrong", "hash")).Returns(false);
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformOwner,
            FixedClock);

        for (int i = 0; i < 5; i++)
        {
            user.VerifyPassword("wrong", hasher.Object, FixedClock);
        }
        user.LockedUntil.Should().NotBeNull();
        user.DomainEvents.OfType<PlatformUserLockedOut>().Should().ContainSingle();
    }

    [Fact]
    public void VerifyPassword_throws_when_locked()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hash");
        hasher.Setup(h => h.VerifyPassword("wrong", "hash")).Returns(false);
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformOwner,
            FixedClock);
        for (int i = 0; i < 5; i++) user.VerifyPassword("wrong", hasher.Object, FixedClock);

        Action act = () => user.VerifyPassword("anything", hasher.Object, FixedClock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void VerifyPassword_resets_count_on_success()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hash");
        hasher.Setup(h => h.VerifyPassword("wrong", "hash")).Returns(false);
        hasher.Setup(h => h.VerifyPassword("right", "hash")).Returns(true);
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformOwner,
            FixedClock);
        user.VerifyPassword("wrong", hasher.Object, FixedClock);
        user.FailedLoginCount.Should().Be(1);

        user.VerifyPassword("right", hasher.Object, FixedClock);
        user.FailedLoginCount.Should().Be(0);
        user.LastLoginAt.Should().Be(FixedClock.UtcNow);
        user.DomainEvents.OfType<PlatformUserLoggedIn>().Should().ContainSingle();
    }

    [Fact]
    public void EnableMfa_provisions_secret_then_verifies_code()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hash");
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformOwner,
            FixedClock);

        // First provision (no code verify yet)
        var secret = user.ProvisionMfaSecret();
        secret.Base32.Should().NotBeNullOrEmpty();
        user.MfaEnabled.Should().BeFalse();

        // Now enable with a "valid" code
        var verifier = new Mock<SaasCheckin.Domain.PlatformOperations.Services.ITotpCodeVerifier>();
        verifier.Setup(v => v.Verify(It.IsAny<MfaSecret>(), "123456", It.IsAny<DateTimeOffset>())).Returns(true);
        var enabledSecret = user.EnableMfa("123456", verifier.Object, FixedClock);
        enabledSecret.Base32.Should().Be(secret.Base32);
        user.MfaEnabled.Should().BeTrue();
        user.DomainEvents.OfType<PlatformUserMfaEnabled>().Should().ContainSingle();
    }

    [Fact]
    public void EnableMfa_rejects_bad_code()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hash");
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"),
            "Test",
            hasher.Object,
            "VeryStrongP@ss123",
            PlatformRole.PlatformOwner,
            FixedClock);

        var verifier = new Mock<SaasCheckin.Domain.PlatformOperations.Services.ITotpCodeVerifier>();
        verifier.Setup(v => v.Verify(It.IsAny<MfaSecret>(), "000000", It.IsAny<DateTimeOffset>())).Returns(false);
        Action act = () => user.EnableMfa("000000", verifier.Object, FixedClock);
        act.Should().Throw<UnauthorizedAccessException>();
        user.MfaEnabled.Should().BeFalse();
    }
}

internal sealed class FixedClock : IClock
{
    public FixedClock(DateTimeOffset now) => UtcNow = now;
    public DateTimeOffset UtcNow { get; }
}
