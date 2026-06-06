using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Application.PlatformOperations.Services;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.Services;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.PlatformOperations.Commands;

/// <summary>
/// MFA verify — confirm the TOTP code shown by user's authenticator, mark
/// MfaEnabled=true, then issue a full access + refresh session.
///
/// Same setupToken as SetupMfa (5-min platform access token from /login).
/// After verify, the user is fully authenticated; BFF receives full tokens.
/// </summary>
public sealed record VerifyMfaCommand(string SetupToken, string TotpCode) : ICommand<PlatformLoginResponse>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}

public sealed class VerifyMfaCommandHandler : IRequestHandler<VerifyMfaCommand, PlatformLoginResponse>
{
    private static readonly TimeSpan PlatformSessionTtl = TimeSpan.FromHours(8);

    private readonly IJwtTokenService _jwt;
    private readonly IPlatformUserRepository _users;
    private readonly IPlatformSessionRepository _sessions;
    private readonly ITotpCodeVerifier _totp;
    private readonly IRefreshTokenHasher _refreshTokens;
    private readonly IClock _clock;

    public VerifyMfaCommandHandler(
        IJwtTokenService jwt,
        IPlatformUserRepository users,
        IPlatformSessionRepository sessions,
        ITotpCodeVerifier totp,
        IRefreshTokenHasher refreshTokens,
        IClock clock)
    {
        _jwt = jwt;
        _users = users;
        _sessions = sessions;
        _totp = totp;
        _refreshTokens = refreshTokens;
        _clock = clock;
    }

    public async Task<PlatformLoginResponse> Handle(VerifyMfaCommand cmd, CancellationToken ct)
    {
        var verified = await _jwt.VerifyPlatformAccessAsync(cmd.SetupToken, ct)
            ?? throw new UnauthorizedAccessException("Setup token không hợp lệ hoặc đã hết hạn.");

        var user = await _users.FindByIdAsync(PlatformUserId.From(verified.UserId), ct)
            ?? throw new UnauthorizedAccessException("User không tồn tại.");

        // EnableMfa throws UnauthorizedAccessException on bad TOTP code, AND
        // sets MfaEnabled=true atomically. Secret is generated on first call
        // (or reused if already provisioned via /mfa/setup).
        try
        {
            user.EnableMfa(cmd.TotpCode, _totp, _clock);
        }
        catch (UnauthorizedAccessException)
        {
            throw new UnauthorizedAccessException("Mã TOTP không đúng.");
        }
        await _users.UpdateAsync(user, ct);

        // Issue full session
        var access = await _jwt.IssuePlatformAccessAsync(
            user,
            permissions: new[] { "platform_admin", "mfa" },
            cancellationToken: ct);

        var (refreshToken, refreshHash) = _refreshTokens.Generate();
        var session = PlatformSession.Create(
            user.Id,
            refreshHash,
            PlatformSessionTtl,
            _clock,
            fromIp: null);
        await _sessions.AddAsync(session, ct);

        return new PlatformLoginResponse(
            user.Id.Value,
            user.Email.Value,
            user.FullName,
            user.Role.ToString(),
            AccessToken: access.Token,
            AccessExpiresAt: access.ExpiresAt,
            RefreshToken: refreshToken,
            RefreshExpiresAt: session.ExpiresAt,
            MfaRequired: false,
            MfaSetupRequired: false);
    }
}
