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
using SaasCheckin.Utility;

namespace SaasCheckin.Application.PlatformOperations.Commands;

/// <summary>
/// Platform admin login (I-107, D12, ADR-0014).
///
/// Flow:
/// 1. Look up user by email.
/// 2. Verify password (increments failed count, locks at 5 attempts / 15 min).
/// 3a. MFA NOT enabled → issue full access (15 min) + refresh (8h) session.
///     MfaSetupRequired=true signals the UI to nudge user to setup MFA.
/// 3b. MFA enabled + totpCode provided → verify, issue full tokens.
/// 3c. MFA enabled + no code → return short-lived (5 min) access token as setupToken
///     for the BFF's mfa-setup/verify flow.
/// </summary>
public sealed record LoginCommand(string Email, string Password, string? TotpCode) : ICommand<PlatformLoginResponse>
{
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
