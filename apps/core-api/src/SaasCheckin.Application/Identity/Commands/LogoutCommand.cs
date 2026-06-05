using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Domain.Identity.Services;

namespace SaasCheckin.Application.Identity.Commands;

public sealed record LogoutCommand(string RefreshToken) : ICommand<Unit>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}

public sealed class LogoutCommandHandler : IRequestHandler<LogoutCommand, Unit>
{
    private readonly IJwtTokenService _jwt;

    public LogoutCommandHandler(IJwtTokenService jwt)
    {
        _jwt = jwt;
    }

    public async Task<Unit> Handle(LogoutCommand cmd, CancellationToken ct)
    {
        await _jwt.RevokeRefreshAsync(cmd.RefreshToken, ct);
        return Unit.Value;
    }
}
