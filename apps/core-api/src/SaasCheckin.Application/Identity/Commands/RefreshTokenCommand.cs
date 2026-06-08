using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.Identity.Dtos;

namespace SaasCheckin.Application.Identity.Commands;

public sealed record RefreshTokenCommand(string RefreshToken) : ICommand<RefreshResponse>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
