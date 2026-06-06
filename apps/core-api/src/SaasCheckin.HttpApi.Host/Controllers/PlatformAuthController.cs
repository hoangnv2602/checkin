using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.PlatformOperations.Commands;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Application.PlatformOperations.Queries;
using SaasCheckin.HttpApi.Host.Middleware;

namespace SaasCheckin.HttpApi.Host.Controllers;

/// <summary>
/// Platform admin auth controller (I-107, D12, ADR-0014).
/// Mirror của AdminAuthController (BFF side). BFF gọi REST này (BFF chưa
/// gRPC-wire cho PlatformOperations — Phase 2).
///
/// Endpoints (audience checkin-admin, IP allowlist enforced ở BFF):
///   POST /v1/platform/login          — verify password + optional TOTP, return tokens
///   POST /v1/platform/refresh        — rotate refresh, issue new pair
///   POST /v1/platform/logout         — revoke session (idempotent)
///   POST /v1/platform/mfa/setup      — generate QR + Base32 secret (from setupToken)
///   POST /v1/platform/mfa/verify     — confirm TOTP code, return full tokens
///   GET  /v1/platform/me             — [auth] current user
/// </summary>
[ApiController]
[Route("v1/platform")]
[ServiceFilter(typeof(PlatformAuthFilter))]
public sealed class PlatformAuthController : ControllerBase
{
    private readonly IMediator _mediator;

    public PlatformAuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("login")]
    [AllowAnonymousPlatform]
    public async Task<IActionResult> Login([FromBody] PlatformLoginRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(
                new LoginCommand(dto.Email, dto.Password, dto.TotpCode), ct);
            return Ok(MapLoginResponse(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            // Account locked — trả 423 Locked.
            return StatusCode(StatusCodes.Status423Locked, new { error = ex.Message });
        }
    }

    [HttpPost("refresh")]
    [AllowAnonymousPlatform]
    public async Task<IActionResult> Refresh([FromBody] PlatformRefreshRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new RefreshTokenCommand(dto.RefreshToken), ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpPost("logout")]
    [AllowAnonymousPlatform]
    public async Task<IActionResult> Logout([FromBody] PlatformRefreshRequestDto dto, CancellationToken ct)
    {
        await _mediator.Send(new LogoutCommand(dto.RefreshToken), ct);
        return NoContent();
    }

    [HttpPost("mfa/setup")]
    [AllowAnonymousPlatform]
    public async Task<IActionResult> SetupMfa([FromBody] PlatformMfaSetupRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new SetupMfaCommand(dto.SetupToken), ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpPost("mfa/verify")]
    [AllowAnonymousPlatform]
    public async Task<IActionResult> VerifyMfa([FromBody] PlatformMfaVerifyRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new VerifyMfaCommand(dto.SetupToken, dto.TotpCode), ct);
            return Ok(MapLoginResponse(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userId = HttpContext.Items[PlatformAuthFilter.UserIdItemKey] as Guid?;
        if (userId is null)
        {
            return Unauthorized(new { error = "Unauthenticated" });
        }
        try
        {
            var dto = await _mediator.Send(new GetMeQuery(userId.Value), ct);
            var role = HttpContext.Items[PlatformAuthFilter.RoleItemKey] as string;
            var perms = HttpContext.Items[PlatformAuthFilter.PermissionsItemKey] as IReadOnlyList<string>;
            return Ok(new
            {
                authenticated = true,
                user = new
                {
                    id = dto.UserId,
                    email = dto.Email,
                    fullName = dto.FullName,
                    role = role ?? dto.Role,
                    platformRole = dto.Role,
                    mfaEnabled = dto.MfaEnabled,
                    permissions = perms ?? Array.Empty<string>(),
                },
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>
    /// Map internal LoginResponse (with full tokens) sang wire shape mà BFF
    /// admin-auth.service.ts expects:
    ///   - login (no MFA): accessToken + refreshToken, mfaRequired=false
    ///   - login (MFA required): accessToken (used as setupToken), mfaRequired=true
    ///   - login (MFA setup required): full tokens, mfaSetupRequired=true
    /// </summary>
    private static object MapLoginResponse(PlatformLoginResponse r)
    {
        return new
        {
            userId = r.UserId,
            email = r.Email,
            fullName = r.FullName,
            role = r.Role,
            accessToken = r.AccessToken,
            accessExpiresAt = r.AccessExpiresAt,
            refreshToken = r.RefreshToken,
            refreshExpiresAt = r.RefreshExpiresAt,
            mfaRequired = r.MfaRequired,
            mfaSetupRequired = r.MfaSetupRequired,
        };
    }
}

public sealed record PlatformLoginRequestDto(string Email, string Password, string? TotpCode);
public sealed record PlatformRefreshRequestDto(string RefreshToken);
public sealed record PlatformMfaSetupRequestDto(string SetupToken);
public sealed record PlatformMfaVerifyRequestDto(string SetupToken, string TotpCode);
