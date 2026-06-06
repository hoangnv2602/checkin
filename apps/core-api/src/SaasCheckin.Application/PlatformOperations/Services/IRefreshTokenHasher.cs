namespace SaasCheckin.Application.PlatformOperations.Services;

/// <summary>
/// Opaque refresh token generator + SHA-256 hasher.
///
/// Token format: base64url(32 random bytes) — KHÔNG phải JWT.
/// Hash format: hex(SHA-256(token)) — lưu trong <c>PlatformSession.RefreshTokenHash</c>.
///
/// Tách riêng với Identity context (dùng Redis) vì PlatformOperations là DB-backed,
/// privileged audience, 8h TTL.
/// </summary>
public interface IRefreshTokenHasher
{
    /// <summary>Tạo token mới + hash tương ứng. Return tuple (token, hash) để lưu DB.</summary>
    (string Token, string Hash) Generate();

    /// <summary>Hash một token đã có (dùng cho <c>FindByRefreshTokenHashAsync</c> lookup).</summary>
    string Hash(string token);
}
