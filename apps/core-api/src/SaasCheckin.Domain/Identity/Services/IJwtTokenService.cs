using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.Services;

/// <summary>
/// JWT signing + verification service. RS256 access token (15 min TTL) + opaque
/// refresh token (30 day, rotated). Refresh lưu ở Redis với key
/// <c>sess:rt:{userId}:{tokenId}</c> và TTL = 30 days.
///
/// Phase 1: signing key generate runtime + cache in Redis (24h TTL).
/// Phase 6+: lưu trong <c>jwks_keys</c> table (auto-rotation).
///
/// Two audiences:
///  - <c>web</c> — tenant users (Organization/Identity context)
///  - <c>checkin-admin</c> — platform admins (PlatformOperations context, I-107)
///
/// Same RSA key is reused for both audiences; only the <c>aud</c> claim differs.
/// </summary>
public interface IJwtTokenService
{
    /// <summary>Issue tenant access token (RS256, 15 min, aud="web").</summary>
    Task<IssuedAccessToken> IssueAccessAsync(
        User user,
        IReadOnlyList<MembershipContext> activeMemberships,
        CancellationToken cancellationToken = default);

    /// <summary>Issue platform admin access token (RS256, 5 min setup / 15 min full, aud="checkin-admin").</summary>
    Task<IssuedAccessToken> IssuePlatformAccessAsync(
        PlatformUser user,
        IReadOnlyList<string> permissions,
        TimeSpan? lifetime = null,
        CancellationToken cancellationToken = default);

    /// <summary>Issue opaque refresh token (30 days), lưu Redis.</summary>
    Task<IssuedRefreshToken> IssueRefreshAsync(
        User user,
        CancellationToken cancellationToken = default);

    /// <summary>Verify access token signature + claim. Trả null nếu invalid/expired.</summary>
    Task<JwtClaims?> VerifyAccessAsync(
        string accessToken,
        CancellationToken cancellationToken = default);

    /// <summary>Verify platform admin access token (aud="checkin-admin"). Trả null nếu invalid/expired.</summary>
    Task<PlatformJwtClaims?> VerifyPlatformAccessAsync(
        string accessToken,
        CancellationToken cancellationToken = default);

    /// <summary>Rotate refresh token: cũ revoke + issue mới. Trả null nếu invalid/revoked.</summary>
    Task<RefreshedTokens?> RotateRefreshAsync(
        string presentedRefreshToken,
        CancellationToken cancellationToken = default);

    /// <summary>Revoke refresh token (logout). Idempotent.</summary>
    Task RevokeRefreshAsync(
        string presentedRefreshToken,
        CancellationToken cancellationToken = default);
}

public sealed record IssuedAccessToken(string Token, DateTimeOffset ExpiresAt);

public sealed record IssuedRefreshToken(string Token, DateTimeOffset ExpiresAt);

public sealed record RefreshedTokens(string AccessToken, DateTimeOffset AccessExpiresAt, string RefreshToken, DateTimeOffset RefreshExpiresAt);

/// <summary>Resolved claim sau khi verify access token thành công.</summary>
public sealed record JwtClaims(
    Guid UserId,
    Guid? ActiveTenantId,
    string? ActiveRole,
    IReadOnlyList<string> Permissions);

/// <summary>Resolved claim cho platform admin access token (aud="checkin-admin").</summary>
public sealed record PlatformJwtClaims(
    Guid UserId,
    string Email,
    string FullName,
    string PlatformRole,
    IReadOnlyList<string> Permissions);

/// <summary>Context cho JWT issue: tenant user đang active + role + permissions.</summary>
public sealed record MembershipContext(
    OrganizationId OrganizationId,
    Role Role,
    IReadOnlyList<string> Permissions);
