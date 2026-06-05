namespace SaasCheckin.Domain.Identity.Authorization;

/// <summary>
/// Role → Permission[] mapping (D13).
/// Roles: Owner, Admin, Organizer, Staff, Viewer (xem ADR-0015 §2).
/// BFF resolve ở JWT issue-time; .NET enforce qua PermissionBehavior (Phase 1+).
/// </summary>
public static class RolePermissionMap
{
    public static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> Map = new Dictionary<string, IReadOnlySet<string>>
    {
        ["owner"] = new HashSet<string>
        {
            Permissions.MembersRead, Permissions.MembersInvite,
            Permissions.MembersUpdateRole, Permissions.MembersRevoke,
            Permissions.MembersTransferOwnership,
        },
        ["admin"] = new HashSet<string>
        {
            Permissions.MembersRead, Permissions.MembersInvite,
            Permissions.MembersUpdateRole, Permissions.MembersRevoke,
        },
        ["organizer"] = new HashSet<string>
        {
            Permissions.MembersRead, Permissions.MembersInvite,
        },
        ["staff"] = new HashSet<string>
        {
            Permissions.MembersRead,
        },
        ["viewer"] = new HashSet<string>
        {
            Permissions.MembersRead,
        },
    };

    public static IReadOnlySet<string> ResolvePermissions(string role)
        => Map.TryGetValue(role, out var perms) ? perms : new HashSet<string>();
}
