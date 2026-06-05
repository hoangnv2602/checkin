// Tests/SaasCheckin.Domain.Tests/Authorization/RolePermissionMapTests.cs
using FluentAssertions;
using SaasCheckin.Domain.Identity.Authorization;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests.Authorization;

public class RolePermissionMapTests
{
    [Fact]
    public void owner_should_have_all_5_permissions()
    {
        var perms = RolePermissionMap.ResolvePermissions("owner");
        perms.Should().BeEquivalentTo(new[]
        {
            Permissions.MembersRead,
            Permissions.MembersInvite,
            Permissions.MembersUpdateRole,
            Permissions.MembersRevoke,
            Permissions.MembersTransferOwnership,
        });
    }

    [Fact]
    public void admin_should_have_4_permissions_no_transfer()
    {
        var perms = RolePermissionMap.ResolvePermissions("admin");
        perms.Should().HaveCount(4);
        perms.Should().NotContain(Permissions.MembersTransferOwnership);
    }

    [Fact]
    public void organizer_should_have_read_and_invite()
    {
        var perms = RolePermissionMap.ResolvePermissions("organizer");
        perms.Should().BeEquivalentTo(new[] { Permissions.MembersRead, Permissions.MembersInvite });
    }

    [Fact]
    public void staff_should_have_read_only()
    {
        var perms = RolePermissionMap.ResolvePermissions("staff");
        perms.Should().BeEquivalentTo(new[] { Permissions.MembersRead });
    }

    [Fact]
    public void viewer_should_have_read_only()
    {
        var perms = RolePermissionMap.ResolvePermissions("viewer");
        perms.Should().BeEquivalentTo(new[] { Permissions.MembersRead });
    }

    [Fact]
    public void unknown_role_should_return_empty()
    {
        var perms = RolePermissionMap.ResolvePermissions("nonexistent");
        perms.Should().BeEmpty();
    }
}
