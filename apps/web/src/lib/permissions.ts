/**
 * apps/web/src/lib/permissions.ts
 *
 * Mirror apps/core-api/src/SaasCheckin.Domain/Identity/Authorization/RolePermissionMap.cs.
 * D13 (ADR-0015): 5 roles × 5 members.* permissions. Phase 6+ sẽ mở rộng
 * (events, tickets, checkin permissions).
 *
 * Mọi check permission ở web PHẢI dùng `hasPermission()` — không hardcode role.
 */
export const Roles = ["owner", "admin", "organizer", "staff", "viewer"] as const;
export type Role = (typeof Roles)[number];

export const Permissions = {
  MembersRead: "members.read",
  MembersInvite: "members.invite",
  MembersUpdateRole: "members.update_role",
  MembersRevoke: "members.revoke",
  MembersTransferOwnership: "members.transfer_ownership",
} as const;
export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const RolePermissionMap: Record<Role, readonly Permission[]> = {
  owner: [
    Permissions.MembersRead,
    Permissions.MembersInvite,
    Permissions.MembersUpdateRole,
    Permissions.MembersRevoke,
    Permissions.MembersTransferOwnership,
  ],
  admin: [
    Permissions.MembersRead,
    Permissions.MembersInvite,
    Permissions.MembersUpdateRole,
    Permissions.MembersRevoke,
  ],
  organizer: [Permissions.MembersRead, Permissions.MembersInvite],
  staff: [Permissions.MembersRead],
  viewer: [Permissions.MembersRead],
};

export function resolvePermissions(role: Role | string | null | undefined): readonly Permission[] {
  if (!role) return [];
  const list = RolePermissionMap[role as Role];
  return list ?? [];
}

export function hasPermission(
  role: Role | string | null | undefined,
  permission: Permission,
): boolean {
  return resolvePermissions(role).includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (Roles as readonly string[]).includes(value);
}
