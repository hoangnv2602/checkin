using MediatR;
using SaasCheckin.Application.Identity.Dtos;
using SaasCheckin.Domain.Identity.Services;

namespace SaasCheckin.Application.Identity.Commands;

public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, RefreshResponse>
{
    private readonly IJwtTokenService _jwt;

    public RefreshTokenCommandHandler(IJwtTokenService jwt)
    {
        _jwt = jwt;
    }

    public async Task<RefreshResponse> Handle(RefreshTokenCommand cmd, CancellationToken ct)
    {
        var refreshed = await _jwt.RotateRefreshAsync(cmd.RefreshToken, ct)
            ?? throw new UnauthorizedAccessException("Refresh token không hợp lệ hoặc đã thu hồi.");

        return new RefreshResponse(
            refreshed.AccessToken, refreshed.AccessExpiresAt,
            refreshed.RefreshToken, refreshed.RefreshExpiresAt);
    }
}
