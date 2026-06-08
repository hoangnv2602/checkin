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
