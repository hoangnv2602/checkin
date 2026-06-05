using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.Identity.Dtos;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Authorization;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

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

public sealed class RegisterUserCommandHandler : IRequestHandler<RegisterUserCommand, RegisterResponse>
{
    private readonly IUserRepository _users;
    private readonly IOrganizationRepository _orgs;
    private readonly IMembershipRepository _memberships;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IClock _clock;
    private readonly IIntegrationEventBus _bus;

    public RegisterUserCommandHandler(
        IUserRepository users,
        IOrganizationRepository orgs,
        IMembershipRepository memberships,
        IPasswordHasher hasher,
        IJwtTokenService jwt,
        IClock clock,
        IIntegrationEventBus bus)
    {
        _users = users;
        _orgs = orgs;
        _memberships = memberships;
        _hasher = hasher;
        _jwt = jwt;
        _clock = clock;
        _bus = bus;
    }

    public async Task<RegisterResponse> Handle(RegisterUserCommand cmd, CancellationToken ct)
    {
        var email = Email.Create(cmd.Email);
        var fullName = FullName.Create(cmd.FullName);

        if (await _users.ExistsByEmailAsync(email, ct))
            throw new BusinessRuleViolationException("Email đã được đăng ký.");

        var slug = OrgSlug.Create(cmd.OrganizationSlug);
        if (await _orgs.ExistsBySlugAsync(slug, ct))
            throw new BusinessRuleViolationException($"Organization slug '{cmd.OrganizationSlug}' đã tồn tại.");

        // 1. Create user
        var user = User.Register(email, fullName, _hasher, cmd.Password, _clock);
        await _users.AddAsync(user, ct);

        // 2. Create org
        var org = Organization.Create(
            cmd.OrganizationName,
            slug,
            _clock,
            cmd.DefaultLocale ?? "en",
            cmd.DefaultCurrency ?? "USD",
            cmd.Timezone ?? "UTC");
        await _orgs.AddAsync(org, ct);

        // 3. Owner membership
        var membership = Membership.CreateOwner(user.Id, org.Id, _clock);
        await _memberships.AddAsync(membership, ct);

        // 4. Publish domain events (in-process qua MediatR handler mặc định)
        foreach (var ev in user.DomainEvents) { }  // Phase 1: in-process chưa wire domain event handlers
        foreach (var ev in org.DomainEvents) { }
        foreach (var ev in membership.DomainEvents) { }
        user.ClearDomainEvents();
        org.ClearDomainEvents();
        membership.ClearDomainEvents();

        // 5. Issue JWT
        var role = Role.Create(Role.Owner);
        var permissions = RolePermissionMap.ResolvePermissions(role.Value).ToList();
        var membershipsCtx = new List<MembershipContext>
        {
            new(org.Id, role, permissions),
        };

        var access = await _jwt.IssueAccessAsync(user, membershipsCtx, ct);
        var refresh = await _jwt.IssueRefreshAsync(user, ct);

        return new RegisterResponse(
            user.Id.Value, org.Id.Value,
            access.Token, access.ExpiresAt,
            refresh.Token, refresh.ExpiresAt);
    }
}
