namespace SaasCheckin.Application.Identity.Dtos;

public sealed record RegisterRequest(
    string Email,
    string FullName,
    string Password,
    string? OrganizationName,
    string? OrganizationSlug,
    string? DefaultLocale,
    string? DefaultCurrency,
    string? Timezone);

public sealed record RegisterResponse(
    Guid UserId,
    Guid OrganizationId,
    string AccessToken,
    DateTimeOffset AccessExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshExpiresAt);

public sealed record LoginRequest(string Email, string Password);
public sealed record LoginResponse(
    Guid UserId,
    string AccessToken,
    DateTimeOffset AccessExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshExpiresAt);

public sealed record RefreshRequest(string RefreshToken);
public sealed record RefreshResponse(
    string AccessToken,
    DateTimeOffset AccessExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshExpiresAt);

public sealed record LogoutRequest(string RefreshToken);

public sealed record UserDto(
    Guid Id,
    string Email,
    string FullName,
    bool EmailVerified,
    DateTimeOffset? LastLoginAt);

public sealed record CreateOrgRequest(
    string Name,
    string Slug,
    string? DefaultLocale,
    string? DefaultCurrency,
    string? Timezone);

public sealed record InviteUserRequest(
    string Email,
    string FullName,
    string Role,
    string? Password);

public sealed record ChangeRoleRequest(Guid MembershipId, string NewRole);
