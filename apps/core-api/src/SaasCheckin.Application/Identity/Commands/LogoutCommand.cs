using MediatR;
using SaasCheckin.Application.Common;

namespace SaasCheckin.Application.Identity.Commands;

public sealed record LogoutCommand(string RefreshToken) : ICommand<Unit>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
