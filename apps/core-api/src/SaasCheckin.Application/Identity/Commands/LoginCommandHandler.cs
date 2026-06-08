using MediatR;
using SaasCheckin.Application.Identity.Dtos;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Authorization;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Application.Identity.Commands;

public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
{
    private readonly IUserRepository _users;
    private readonly IMembershipRepository _memberships;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IClock _clock;

    public LoginCommandHandler(
        IUserRepository users,
        IMembershipRepository memberships,
        IPasswordHasher hasher,
        IJwtTokenService jwt,
        IClock clock)
    {
        _users = users;
        _memberships = memberships;
        _hasher = hasher;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<LoginResponse> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var email = Email.Create(cmd.Email);
        var user = await _users.FindByEmailAsync(email, ct)
            ?? throw new UnauthorizedAccessException("Email hoặc password không đúng.");

        if (user.IsLocked(_clock.UtcNow))
            throw new UnauthorizedAccessException(
                $"Tài khoản bị khoá đến {user.LockedUntil:O}. Thử lại sau.");

        if (string.IsNullOrEmpty(user.PasswordHash) || !_hasher.VerifyPassword(cmd.Password, user.PasswordHash))
        {
            user.RecordFailedLogin(_clock);
            await _users.UpdateAsync(user, ct);
            throw new UnauthorizedAccessException("Email hoặc password không đúng.");
        }

        user.RecordSuccessfulLogin(_clock);
        await _users.UpdateAsync(user, ct);

        // Resolve active memberships → permissions
        var memberships = await _memberships.ListActiveByUserAsync(user.Id, ct);
        var membershipsCtx = memberships
            .Select(m => new MembershipContext(
                m.OrganizationId,
                m.Role,
                RolePermissionMap.ResolvePermissions(m.Role.Value).ToList()))
            .ToList();

        var access = await _jwt.IssueAccessAsync(user, membershipsCtx, ct);
        var refresh = await _jwt.IssueRefreshAsync(user, ct);

        return new LoginResponse(
            user.Id.Value,
            access.Token, access.ExpiresAt,
            refresh.Token, refresh.ExpiresAt);
    }
}
