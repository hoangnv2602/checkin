/**
 * apps/web/src/lib/permissions.test.ts
 *
 * Unit tests cho permission map (D13 / ADR-0015).
 */
import { describe, it, expect } from "vitest";
import {
  Roles,
  Permissions,
  RolePermissionMap,
  resolvePermissions,
  hasPermission,
  isRole,
} from "./permissions";

describe("RolePermissionMap", () => {
  it("owner has all 5 members.* permissions", () => {
    expect(RolePermissionMap.owner).toHaveLength(5);
    expect(hasPermission("owner", Permissions.MembersTransferOwnership)).toBe(true);
  });

  it("admin has 4 permissions (no transfer_ownership)", () => {
    expect(RolePermissionMap.admin).toHaveLength(4);
    expect(hasPermission("admin", Permissions.MembersRevoke)).toBe(true);
    expect(hasPermission("admin", Permissions.MembersTransferOwnership)).toBe(false);
  });

  it("organizer has 2 permissions (read + invite)", () => {
    expect(RolePermissionMap.organizer).toHaveLength(2);
    expect(hasPermission("organizer", Permissions.MembersInvite)).toBe(true);
    expect(hasPermission("organizer", Permissions.MembersUpdateRole)).toBe(false);
  });

  it("staff has only read", () => {
    expect(RolePermissionMap.staff).toEqual([Permissions.MembersRead]);
  });

  it("viewer has only read", () => {
    expect(RolePermissionMap.viewer).toEqual([Permissions.MembersRead]);
  });
});

describe("resolvePermissions", () => {
  it("returns [] for null", () => {
    expect(resolvePermissions(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(resolvePermissions(undefined)).toEqual([]);
  });

  it("returns [] for unknown role", () => {
    expect(resolvePermissions("ghost")).toEqual([]);
  });

  it("returns the list for known role", () => {
    expect(resolvePermissions("owner")).toHaveLength(5);
  });
});

describe("hasPermission", () => {
  it("returns true for granted permission", () => {
    expect(hasPermission("owner", Permissions.MembersRead)).toBe(true);
  });

  it("returns false for non-granted permission", () => {
    expect(hasPermission("viewer", Permissions.MembersInvite)).toBe(false);
  });

  it("returns false for null role", () => {
    expect(hasPermission(null, Permissions.MembersRead)).toBe(false);
  });
});

describe("isRole", () => {
  it("returns true for known role", () => {
    for (const r of Roles) expect(isRole(r)).toBe(true);
  });

  it("returns false for unknown value", () => {
    expect(isRole("ghost")).toBe(false);
    expect(isRole(42)).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
