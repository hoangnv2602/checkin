using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Application.PlatformOperations.Services;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.PlatformOperations.Commands;

public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, PlatformRefreshResponse>
{
    private static readonly TimeSpan PlatformSessionTtl = TimeSpan.FromHours(8);

    private readonly IPlatformUserRepository _users;
    private readonly IPlatformSessionRepository _sessions;
    private readonly IRefreshTokenHasher _refreshTokens;
    private readonly IJwtTokenService _jwt;
    private readonly IClock _clock;

    public RefreshTokenCommandHandler(
        IPlatformUserRepository users,
        IPlatformSessionRepository sessions,
        IRefreshTokenHasher refreshTokens,
        IJwtTokenService jwt,
        IClock clock)
    {
        _users = users;
        _sessions = sessions;
        _refreshTokens = refreshTokens;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<PlatformRefreshResponse> Handle(RefreshTokenCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.RefreshToken))
            throw new UnauthorizedAccessException("Refresh token không hợp lệ.");

        var hash = _refreshTokens.Hash(cmd.RefreshToken);
        var session = await _sessions.FindByRefreshTokenHashAsync(hash, ct)
            ?? throw new UnauthorizedAccessException("Refresh token không hợp lệ.");

        if (!session.IsActive(_clock))
            throw new UnauthorizedAccessException("Refresh token hết hạn hoặc đã thu hồi.");

        var user = await _users.FindByIdAsync(session.UserId, ct)
            ?? throw new UnauthorizedAccessException("User không tồn tại.");

        // Revoke cũ + issue mới.
        session.Revoke(_clock);
        await _sessions.UpdateAsync(session, ct);

        var (newRefreshToken, newRefreshHash) = _refreshTokens.Generate();
        var newSession = PlatformSession.Create(
            user.Id,
            newRefreshHash,
            PlatformSessionTtl,
            _clock,
            session.CreatedFromIp);
        await _sessions.AddAsync(newSession, ct);

        var access = await _jwt.IssuePlatformAccessAsync(
            user,
            permissions: new[] { "platform_admin" },
            cancellationToken: ct);

        return new PlatformRefreshResponse(
            access.Token, access.ExpiresAt,
            newRefreshToken, newSession.ExpiresAt);
    }
}
