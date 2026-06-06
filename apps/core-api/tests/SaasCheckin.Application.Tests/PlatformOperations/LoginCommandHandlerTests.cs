using FluentAssertions;
using Moq;
using SaasCheckin.Application.PlatformOperations.Commands;
using SaasCheckin.Application.PlatformOperations.Services;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.Services;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Application.Tests.PlatformOperations;

/// <summary>
/// LoginCommandHandler unit tests (I-107). Domain behavior (password verify, lockout,
/// TOTP, MFA enable) đã cover ở PlatformUserInviteTests — đây chỉ test wiring
/// (handler routes the right cases to the right outputs).
/// </summary>
public class LoginCommandHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan PlatformSetupTtl = TimeSpan.FromMinutes(5);

    private readonly Mock<IPlatformUserRepository> _users = new();
    private readonly Mock<IPlatformSessionRepository> _sessions = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<ITotpCodeVerifier> _totp = new();
    private readonly Mock<IJwtTokenService> _jwt = new();
    private readonly IRefreshTokenHasher _refreshTokens = new Sha256RefreshTokenHasher();
    private readonly FixedClock _clock = new(Now);
    private readonly TimeProvider _time = TimeProvider.System;

    private LoginCommandHandler Build() => new(
        _users.Object, _sessions.Object, _hasher.Object, _totp.Object,
        _jwt.Object, _refreshTokens, _clock, _time);

    [Fact]
    public async Task Login_with_valid_creds_and_mfa_disabled_returns_full_tokens_and_setup_required()
    {
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hashed");
        _hasher.Setup(h => h.VerifyPassword("right", "hashed")).Returns(true);
        var user = PlatformUser.Invite(
            Email.Create("owner@saas-checkin.com"), "Owner", _hasher.Object,
            "VeryStrongP@ss123", PlatformRole.PlatformOwner, _clock);

        _users.Setup(r => r.FindByEmailAsync("owner@saas-checkin.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _jwt.Setup(j => j.IssuePlatformAccessAsync(
                It.IsAny<PlatformUser>(), It.IsAny<IReadOnlyList<string>>(),
                It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((PlatformUser u, IReadOnlyList<string> _, TimeSpan? _, CancellationToken __) =>
                new IssuedAccessToken($"access-{u.Id.Value}", Now.AddMinutes(15)));

        var result = await Build().Handle(new LoginCommand("owner@saas-checkin.com", "right", null), default);

        result.AccessToken.Should().Be($"access-{user.Id.Value}");
        result.RefreshToken.Should().NotBeNullOrEmpty();
        result.MfaRequired.Should().BeFalse();
        result.MfaSetupRequired.Should().BeTrue();   // nudges UI to /mfa-setup
        _sessions.Verify(s => s.AddAsync(It.IsAny<PlatformSession>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Login_with_valid_creds_and_mfa_enabled_no_code_returns_setup_token()
    {
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hashed");
        _hasher.Setup(h => h.VerifyPassword("right", "hashed")).Returns(true);
        var user = PlatformUser.Invite(
            Email.Create("o@x.test"), "X", _hasher.Object,
            "VeryStrongP@ss123", PlatformRole.PlatformOwner, _clock);
        user.ProvisionMfaSecret();
        // Mark MfaEnabled=true manually (skip TOTP verify — chỉ test handler wiring).
        typeof(PlatformUser).GetProperty(nameof(PlatformUser.MfaEnabled))!
            .SetValue(user, true);

        _users.Setup(r => r.FindByEmailAsync("o@x.test", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _jwt.Setup(j => j.IssuePlatformAccessAsync(
                user, It.IsAny<IReadOnlyList<string>>(),
                PlatformSetupTtl, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IssuedAccessToken("setup-token", Now.AddMinutes(5)));

        var result = await Build().Handle(new LoginCommand("o@x.test", "right", null), default);

        result.MfaRequired.Should().BeTrue();
        result.MfaSetupRequired.Should().BeFalse();
        result.AccessToken.Should().Be("setup-token");
        result.RefreshToken.Should().BeNull();
    }

    [Fact]
    public async Task Login_with_bad_password_throws_Unauthorized()
    {
        _hasher.Setup(h => h.VerifyPassword("wrong", "hash")).Returns(false);
        var user = PlatformUser.Invite(
            Email.Create("a@b.test"), "X", _hasher.Object,
            "VeryStrongP@ss123", PlatformRole.PlatformOwner, _clock);

        _users.Setup(r => r.FindByEmailAsync("a@b.test", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var act = async () => await Build().Handle(new LoginCommand("a@b.test", "wrong", null), default);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        _users.Verify(u => u.UpdateAsync(user, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Login_with_unknown_email_throws_Unauthorized()
    {
        _users.Setup(r => r.FindByEmailAsync("nope@test", It.IsAny<CancellationToken>()))
            .ReturnsAsync((PlatformUser?)null);

        var act = async () => await Build().Handle(new LoginCommand("nope@test", "x", null), default);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Login_with_empty_email_or_password_throws_Unauthorized()
    {
        var act1 = async () => await Build().Handle(new LoginCommand("", "x", null), default);
        await act1.Should().ThrowAsync<UnauthorizedAccessException>();
        var act2 = async () => await Build().Handle(new LoginCommand("a@b", "", null), default);
        await act2.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    internal sealed class FixedClock : IClock
    {
        public FixedClock(DateTimeOffset now) => UtcNow = now;
        public DateTimeOffset UtcNow { get; }
    }
}
