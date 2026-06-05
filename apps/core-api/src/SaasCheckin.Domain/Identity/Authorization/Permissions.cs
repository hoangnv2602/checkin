namespace SaasCheckin.Domain.Identity.Authorization;

/// <summary>
/// Permission keys cho Identity context (D13 RBAC hybrid).
/// Mỗi key = 1 capability. Tổng 5 key cho Identity; các context khác (Event,
/// Ticketing, ...) khai báo Permission class riêng.
/// </summary>
public static class Permissions
{
    public const string MembersRead = "members:read";
    public const string MembersInvite = "members:invite";
    public const string MembersUpdateRole = "members:update:role";
    public const string MembersRevoke = "members:revoke";
    public const string MembersTransferOwnership = "members:transfer-ownership";
}
