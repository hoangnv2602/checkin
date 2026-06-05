using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.Domain.PlatformOperations.Services;

/// <summary>
/// TOTP code verifier (RFC 6238) với ±1 step skew (30s window).
/// Phase 1 implementation dùng HMAC-SHA1 + base32 secret.
/// </summary>
public interface ITotpCodeVerifier
{
    bool Verify(MfaSecret secret, string code, DateTimeOffset now);
}
