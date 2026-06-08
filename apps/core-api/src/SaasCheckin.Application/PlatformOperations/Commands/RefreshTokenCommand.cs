using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Application.PlatformOperations.Services;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.PlatformOperations.Commands;

/// <summary>
/// Refresh platform admin access token. Rotate refresh token (revoke cũ + issue mới).
/// DB-backed sessions: lookup by SHA-256 hash of opaque token.
/// </summary>
public sealed record RefreshTokenCommand(string RefreshToken) : ICommand<PlatformRefreshResponse>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
