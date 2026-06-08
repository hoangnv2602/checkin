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
