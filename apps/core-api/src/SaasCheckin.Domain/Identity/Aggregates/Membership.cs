using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.Aggregates;

/// <summary>
/// Membership aggregate — liên kết User với Organization + Role.
/// Mỗi (user_id, tenant_id) là 1 membership duy nhất (xem database-schema.md § 4.2).
///
/// RLS isolation: chỉ query được memberships của tenant hiện tại (Postgres
/// policy `tenant_isolation` — xem I-104 migration).
/// </summary>
public sealed class Membership : AggregateRoot<MembershipId>
{
    public UserId UserId { get; private set; } = default!;
    public OrganizationId OrganizationId { get; private set; } = default!;
    public Role Role { get; private set; } = default!;
    public MembershipStatus Status { get; private set; }
    public DateTimeOffset InvitedAt { get; private set; }
    public DateTimeOffset? JoinedAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }

    private Membership() : base(default!) { }

    private Membership(
        MembershipId id,
        UserId userId,
        OrganizationId organizationId,
        Role role,
        DateTimeOffset invitedAt) : base(id)
    {
        UserId = userId;
        OrganizationId = organizationId;
        Role = role;
        Status = MembershipStatus.Pending;
        InvitedAt = invitedAt;
    }

    /// <summary>
    /// Invite user vào org. Emit <see cref="UserInvited"/> event.
    /// </summary>
    public static Membership Invite(
        UserId userId,
        OrganizationId organizationId,
        Role role,
        IClock clock)
    {
        Guard.NotNullStruct(userId);
        Guard.NotNullStruct(organizationId);
        Guard.NotNull(role);
        Guard.NotNull(clock);

        var membership = new Membership(
            MembershipId.New(),
            userId,
            organizationId,
            role,
            clock.UtcNow);

        membership.AddDomainEvent(new UserInvited(
            membership.Id, userId, organizationId, role.Value, clock.UtcNow));

        return membership;
    }

    /// <summary>
    /// Owner tạo sẵn Membership (kèm JoinedAt) — dùng cho seed data + register flow
    /// đầu tiên khi user tự tạo org.
    /// </summary>
    public static Membership CreateOwner(
        UserId userId,
        OrganizationId organizationId,
        IClock clock)
    {
        var membership = new Membership(
            MembershipId.New(),
            userId,
            organizationId,
            Role.Create(Role.Owner),
            clock.UtcNow);
        membership.JoinedAt = clock.UtcNow;
        membership.Status = MembershipStatus.Active;
        return membership;
    }

    public void Activate(IClock clock)
    {
        if (Status == MembershipStatus.Active)
            throw new BusinessRuleViolationException("Membership đã active.");
        if (Status == MembershipStatus.Revoked)
            throw new BusinessRuleViolationException("Không thể activate membership đã bị revoke.");

        Status = MembershipStatus.Active;
        JoinedAt = clock.UtcNow;
    }

    public void ChangeRole(Role newRole, IClock clock)
    {
        Guard.NotNull(newRole);
        Guard.NotNull(clock);

        if (Status != MembershipStatus.Active)
            throw new BusinessRuleViolationException(
                $"Chỉ đổi role khi membership active (hiện tại: {Status}).");

        if (Role.Value == Role.Owner && newRole.Value != Role.Owner)
            throw new BusinessRuleViolationException(
                "Không thể đổi role Owner. Dùng MembersTransferOwnership trước.");

        var oldRole = Role;
        Role = newRole;
        AddDomainEvent(new RoleChanged(
            Id, UserId, OrganizationId, oldRole.Value, newRole.Value, clock.UtcNow));
    }

    public void Revoke(IClock clock)
    {
        Guard.NotNull(clock);
        if (Status == MembershipStatus.Revoked)
            throw new BusinessRuleViolationException("Membership đã revoke.");

        Status = MembershipStatus.Revoked;
        RevokedAt = clock.UtcNow;
    }

    public bool IsActiveNow() => Status == MembershipStatus.Active;
}

public enum MembershipStatus
{
    Pending = 0,
    Active = 1,
    Revoked = 2,
}
