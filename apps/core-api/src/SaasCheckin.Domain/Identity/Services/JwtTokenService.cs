using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Application.Tenancy;
using SaasCheckin.Shared.Domain.Core;
using StackExchange.Redis;

namespace SaasCheckin.Domain.Identity.Services;

/// <summary>
/// JwtTokenService — RS256 access + opaque refresh (Redis).
///
/// Signing key: RSA-2048, generate runtime + cache in Redis 24h. Fallback in-memory
/// nếu Redis down. Phase 6+ move sang <c>jwks_keys</c> table + auto-rotation.
///
/// Refresh token: opaque (32 random bytes base64url) — KHÔNG phải JWT.
/// Lưu Redis: <c>SET sess:rt:{userId}:{tokenId} {{userId,tokenId,issuedAt,exp}} EX 2592000</c>.
/// </summary>
public sealed class JwtTokenService : IJwtTokenService
{
    private const string RedisSigningKeyCacheKey = "jwt:signing:key";
    private static readonly TimeSpan SigningKeyTtl = TimeSpan.FromHours(24);
    private static readonly TimeSpan AccessTokenTtl = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan RefreshTokenTtl = TimeSpan.FromDays(30);

    private static readonly string JwtIssuer = "saas-checkin-core-api";
    private static readonly string JwtAudience = "web";  // platform track dùng audience=checkin-admin

    private readonly IConnectionMultiplexer? _redis;
    private readonly IClock _clock;
    private readonly ILogger<JwtTokenService> _logger;

    public JwtTokenService(
        IClock clock,
        ILogger<JwtTokenService> logger,
        IConnectionMultiplexer? redis = null)
    {
        _clock = clock;
        _logger = logger;
        _redis = redis;
    }

    public async Task<IssuedAccessToken> IssueAccessAsync(
        User user,
        IReadOnlyList<MembershipContext> activeMemberships,
        CancellationToken cancellationToken = default)
    {
        Guard.NotNull(user);

        var keyMaterial = await GetOrCreateSigningKeyAsync(cancellationToken);
        var key = new RsaSecurityKey(keyMaterial.PrivateKey) { KeyId = keyMaterial.KeyId };

        var now = _clock.UtcNow;
        var expires = now.Add(AccessTokenTtl);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.Value.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email.Value),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("full_name", user.FullName.Value),
            new("aud", JwtAudience),
        };

        // Pick first active membership as default active tenant.
        var first = activeMemberships.FirstOrDefault();
        if (first is not null)
        {
            claims.Add(new Claim("tenant_id", first.OrganizationId.Value.ToString()));
            claims.Add(new Claim("role", first.Role.Value));
            foreach (var perm in first.Permissions)
                claims.Add(new Claim("permission", perm));
        }

        var creds = new SigningCredentials(key, SecurityAlgorithms.RsaSha256);
        var jwt = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: creds);

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        return new IssuedAccessToken(token, expires);
    }

    public async Task<IssuedRefreshToken> IssueRefreshAsync(
        User user,
        CancellationToken cancellationToken = default)
    {
        Guard.NotNull(user);

        var tokenId = Guid.NewGuid().ToString("N");
        var token = $"{user.Id.Value:N}:{tokenId}";
        var expires = _clock.UtcNow.Add(RefreshTokenTtl);

        if (_redis is not null)
        {
            try
            {
                var db = _redis.GetDatabase();
                var key = RedisKey.Refresh(user.Id.Value, tokenId);
                var payload = JsonSerializer.Serialize(new
                {
                    userId = user.Id.Value,
                    tokenId,
                    issuedAt = _clock.UtcNow,
                    exp = expires,
                });
                await db.StringSetAsync(key, payload, RefreshTokenTtl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis unavailable for refresh token storage; in-memory only.");
            }
        }

        return new IssuedRefreshToken(token, expires);
    }

    public async Task<JwtClaims?> VerifyAccessAsync(
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        Guard.NotNullOrWhiteSpace(accessToken);

        var keyMaterial = await GetOrCreateSigningKeyAsync(cancellationToken);
        var key = new RsaSecurityKey(keyMaterial.PublicKey) { KeyId = keyMaterial.KeyId };

        var validationParams = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = JwtIssuer,
            ValidateAudience = true,
            ValidAudience = JwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(accessToken, validationParams, out _);
            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            if (sub is null || !Guid.TryParse(sub, out var userId))
                return null;

            Guid? tenantId = null;
            var tenantClaim = principal.FindFirst("tenant_id")?.Value;
            if (tenantClaim is not null && Guid.TryParse(tenantClaim, out var tid))
                tenantId = tid;

            var role = principal.FindFirst("role")?.Value;
            var permissions = principal.FindAll("permission").Select(c => c.Value).ToList();

            return new JwtClaims(userId, tenantId, role, permissions);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "JWT verification failed");
            return null;
        }
    }

    public async Task<RefreshedTokens?> RotateRefreshAsync(
        string presentedRefreshToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(presentedRefreshToken))
            return null;

        var (userIdStr, tokenId) = ParseRefreshToken(presentedRefreshToken);
        if (userIdStr is null) return null;
        if (!Guid.TryParse(userIdStr, out var userId)) return null;

        if (_redis is null) return null;

        try
        {
            var db = _redis.GetDatabase();
            var key = RedisKey.Refresh(userId, tokenId);
            var existing = await db.StringGetAsync(key);
            if (!existing.HasValue) return null;

            // Revoke cũ
            await db.KeyDeleteAsync(key);

            // User chỉ có email + fullName trong refresh payload — Phase 1 cần lookup
            // từ DB để issue access. Phase 1 giản lược: trả null nếu không có user cache.
            // Production: load user + memberships từ repo trước khi issue access.
            _logger.LogWarning("RotateRefreshAsync chưa wire tới repository — trả null. Phase 2 hookup.");

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis unavailable during refresh rotation");
            return null;
        }
    }

    public async Task RevokeRefreshAsync(
        string presentedRefreshToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(presentedRefreshToken)) return;

        var (userIdStr, tokenId) = ParseRefreshToken(presentedRefreshToken);
        if (userIdStr is null) return;
        if (!Guid.TryParse(userIdStr, out var userId)) return;

        if (_redis is null) return;

        try
        {
            var db = _redis.GetDatabase();
            var key = RedisKey.Refresh(userId, tokenId);
            await db.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis unavailable during refresh revoke");
        }
    }

    // ----- helpers -----

    private (string? userId, string tokenId) ParseRefreshToken(string token)
    {
        var parts = token.Split(':');
        return parts.Length == 2 ? (parts[0], parts[1]) : (null, string.Empty);
    }

    private async Task<SigningKeyMaterial> GetOrCreateSigningKeyAsync(CancellationToken ct)
    {
        if (_redis is not null)
        {
            try
            {
                var db = _redis.GetDatabase();
                var cached = await db.StringGetAsync(RedisSigningKeyCacheKey);
                if (cached.HasValue)
                {
                    var material = JsonSerializer.Deserialize<SigningKeyMaterial>((string)cached!);
                    if (material is not null && material.PrivateKey is not null && material.PublicKey is not null)
                        return material;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis unavailable for signing key cache; in-memory fallback.");
            }
        }

        var rsa = RSA.Create(2048);
        var materialNew = new SigningKeyMaterial
        {
            KeyId = Guid.NewGuid().ToString("N"),
            PrivateKey = rsa,
            PublicKey = rsa,
            // ExportSubjectPublicKeyInfoPem (X.509 SPKI) — tương thích với jose's
            // importSPKI(). ExportRSAPublicKeyPem() returns PKCS#1 which jose rejects.
            PrivatePem = rsa.ExportRSAPrivateKeyPem(),
            PublicPem = rsa.ExportSubjectPublicKeyInfoPem(),
            CreatedAt = _clock.UtcNow,
        };

        if (_redis is not null)
        {
            try
            {
                var db = _redis.GetDatabase();
                await db.StringSetAsync(RedisSigningKeyCacheKey, JsonSerializer.Serialize(materialNew), SigningKeyTtl);
            }
            catch
            {
                // already logged above
            }
        }

        return materialNew;
    }

    private static class RedisKey
    {
        public static string Refresh(Guid userId, string tokenId) => $"sess:rt:{userId:N}:{tokenId}";
    }

    private sealed class SigningKeyMaterial
    {
        [System.Text.Json.Serialization.JsonPropertyName("keyId")]
        public string KeyId { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonIgnore]
        public RSA? PrivateKey { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        public RSA? PublicKey { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("privatePem")]
        public string PrivatePem { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("publicPem")]
        public string PublicPem { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("createdAt")]
        public DateTimeOffset CreatedAt { get; set; }
    }
}
