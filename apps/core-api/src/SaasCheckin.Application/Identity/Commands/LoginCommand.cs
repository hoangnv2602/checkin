using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.Identity.Dtos;

namespace SaasCheckin.Application.Identity.Commands;

public sealed record LoginCommand(string Email, string Password) : ICommand<LoginResponse>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
