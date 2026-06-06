using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Services;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.PlatformOperations.Commands;

/// <summary>
/// Logout — revoke PlatformSession by refresh-token hash. Idempotent.
/// </summary>
public sealed record LogoutCommand(string RefreshToken) : ICommand<Unit>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}

public sealed class LogoutCommandHandler : IRequestHandler<LogoutCommand, Unit>
{
    private readonly IPlatformSessionRepository _sessions;
    private readonly IRefreshTokenHasher _refreshTokens;
    private readonly IClock _clock;

    public LogoutCommandHandler(
        IPlatformSessionRepository sessions,
        IRefreshTokenHasher refreshTokens,
        IClock clock)
    {
        _sessions = sessions;
        _refreshTokens = refreshTokens;
        _clock = clock;
    }

    public async Task<Unit> Handle(LogoutCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.RefreshToken))
            return Unit.Value;

        var hash = _refreshTokens.Hash(cmd.RefreshToken);
        var session = await _sessions.FindByRefreshTokenHashAsync(hash, ct);
        if (session is null)
            return Unit.Value; // idempotent — not found = no-op

        if (session.IsActive(_clock))
        {
            session.Revoke(_clock);
            await _sessions.UpdateAsync(session, ct);
        }
        return Unit.Value;
    }
}
