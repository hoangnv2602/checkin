using System.Text;
using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.PlatformOperations.Commands;

/// <summary>
/// MFA setup — generate or return existing TOTP secret + QR code data URL.
///
/// Flow:
/// 1. Verify the setupToken (a 5-min platform access token from /login).
/// 2. Look up user by claim.sub.
/// 3. Call user.ProvisionMfaSecret() — generates if absent, returns existing otherwise.
/// 4. Persist via repo.
/// 5. Return Base32 secret + otpauth:// URL + QR code as data URL.
///
/// Note: BFF calls this via /v1/admin/auth/mfa/setup. Same flow used both
/// for first-time setup AND for re-displaying an existing (un-enabled) secret.
/// </summary>
public sealed record SetupMfaCommand(string SetupToken) : ICommand<PlatformMfaSetupResponse>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
