using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace SaasCheckin.Shared.Application.Authorization;

/// <summary>
/// Default IPermissionChecker — đọc <c>permission</c> claims từ JWT (set bởi
/// JwtAuthGuard của BFF khi gọi gRPC). Nếu không có HttpContext (background job,
/// outbox relay) thì trả false / throw.
///
/// Phase 1 đơn giản; Phase 2+ dùng distributed cache nếu permission list lớn.
/// </summary>
public sealed class JwtClaimPermissionChecker : IPermissionChecker
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public JwtClaimPermissionChecker(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private HashSet<string>? CurrentPermissions
    {
        get
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true) return null;
            return user.FindAll("permission").Select(c => c.Value).ToHashSet(StringComparer.Ordinal);
        }
    }

    public bool HasAll(params string[] required)
    {
        var perms = CurrentPermissions;
        if (perms is null) return false;
        return required.All(perms.Contains);
    }

    public bool HasAny(params string[] any)
    {
        var perms = CurrentPermissions;
        if (perms is null) return false;
        return any.Any(perms.Contains);
    }

    public void EnsureAll(params string[] required)
    {
        if (!HasAll(required))
            throw new ForbiddenException(
                $"Thiếu permission. Yêu cầu: {string.Join(", ", required)}.");
    }
}
