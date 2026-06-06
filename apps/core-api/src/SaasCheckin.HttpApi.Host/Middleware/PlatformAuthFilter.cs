using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SaasCheckin.Domain.Identity.Services;

namespace SaasCheckin.HttpApi.Host.Middleware;

/// <summary>
/// Platform auth filter — verify Bearer token (aud=checkin-admin) and stamp
/// <c>HttpContext.Items["PlatformUserId"]</c> for downstream actions.
///
/// Decorate controller with <c>[ServiceFilter(typeof(PlatformAuthFilter))]</c>
/// hoặc individual actions với <c>[ServiceFilter]</c> attribute.
/// Endpoints KHÔNG cần auth (login, refresh, logout, mfa/setup, mfa/verify)
/// dùng <c>[AllowAnonymousPlatform]</c> attribute.
///
/// Public-key verify: dùng chung RSA key với Identity (JwtTokenService.VerifyPlatformAccessAsync).
/// </summary>
public sealed class PlatformAuthFilter : IAsyncAuthorizationFilter
{
    public const string UserIdItemKey = "PlatformUserId";
    public const string EmailItemKey = "PlatformEmail";
    public const string RoleItemKey = "PlatformRole";
    public const string PermissionsItemKey = "PlatformPermissions";

    private readonly IJwtTokenService _jwt;

    public PlatformAuthFilter(IJwtTokenService jwt)
    {
        _jwt = jwt;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // Skip nếu action có [AllowAnonymousPlatform] (custom attribute dưới)
        var endpoint = context.HttpContext.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<AllowAnonymousPlatformAttribute>() is not null)
            return;

        if (!context.HttpContext.Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            context.Result = new UnauthorizedObjectResult(new { error = "Missing Authorization header" });
            return;
        }

        var token = authHeader.ToString();
        if (!token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            context.Result = new UnauthorizedObjectResult(new { error = "Authorization must be Bearer token" });
            return;
        }
        token = token.Substring("Bearer ".Length).Trim();

        var verified = await _jwt.VerifyPlatformAccessAsync(token, context.HttpContext.RequestAborted);
        if (verified is null)
        {
            context.Result = new UnauthorizedObjectResult(new { error = "Invalid or expired token" });
            return;
        }

        context.HttpContext.Items[UserIdItemKey] = verified.UserId;
        context.HttpContext.Items[EmailItemKey] = verified.Email;
        context.HttpContext.Items[RoleItemKey] = verified.PlatformRole;
        context.HttpContext.Items[PermissionsItemKey] = verified.Permissions;
    }
}

/// <summary>
/// Marker cho endpoint KHÔNG cần Bearer auth (login, refresh, logout, mfa/setup, mfa/verify).
/// Dùng với <c>[ServiceFilter(typeof(PlatformAuthFilter))]</c> trên controller.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class AllowAnonymousPlatformAttribute : Attribute
{
}
