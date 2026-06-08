using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.Identity.Dtos;

namespace SaasCheckin.Application.Identity.Commands;

public sealed record RegisterUserCommand(
    string Email,
    string FullName,
    string Password,
    string OrganizationName,
    string OrganizationSlug,
    string? DefaultLocale,
    string? DefaultCurrency,
    string? Timezone) : ICommand<RegisterResponse>
{
    // Register không cần permission (self-service). Phase 2+ có thể add rate limit + email verify.
    public IReadOnlyList<string> RequiredPermissions => Array.Empty<string>();
}
