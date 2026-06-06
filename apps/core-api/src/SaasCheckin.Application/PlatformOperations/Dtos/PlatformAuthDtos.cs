namespace SaasCheckin.Application.PlatformOperations.Dtos;

/// <summary>
/// Login response từ core-api. Shape map với BFF wire
/// (apps/api-gateway/src/modules/checkin-admin/admin-auth.service.ts):
/// - mfaRequired=true → accessToken là setupToken (5 min, cùng RSA key với full)
/// - mfaRequired=false → accessToken + refreshToken = full session
/// - mfaSetupRequired=true (MFA not yet enabled) → BFF redirect to /mfa-setup
/// </summary>
public sealed record PlatformLoginResponse(
    Guid UserId,
    string Email,
    string FullName,
    string Role,
    string? AccessToken,
    DateTimeOffset? AccessExpiresAt,
    string? RefreshToken,
    DateTimeOffset? RefreshExpiresAt,
    bool MfaRequired,
    bool MfaSetupRequired);

public sealed record PlatformRefreshResponse(
    string AccessToken,
    DateTimeOffset AccessExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshExpiresAt);

public sealed record PlatformMfaSetupResponse(
    string SecretBase32,
    string OtpauthUrl,
    string QrCodeDataUrl);

public sealed record PlatformMfaVerifyResponse(
    bool MfaEnabled);

public sealed record PlatformMeDto(
    Guid UserId,
    string Email,
    string FullName,
    string Role,
    bool MfaEnabled);
