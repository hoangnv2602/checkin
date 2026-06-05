// Tests/SaasCheckin.Persistence.Tests/Identity/MembershipRepositoryTests.cs
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.Repositories;
using SaasCheckin.Persistence.Tests.Fixtures;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Persistence.Tests.Identity;

[Collection("postgres")]
public class MembershipRepositoryTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;
    private readonly Mock<IClock> _clock = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public MembershipRepositoryTests(PostgresFixture fixture)
    {
        _fixture = fixture;
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("$2a$12$hashed");
    }

    public async Task InitializeAsync() => await _fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private SaasCheckinDbContext NewContext()
    {
        return new SaasCheckinDbContext(_fixture.NewDbContextOptions(), Array.Empty<Microsoft.EntityFrameworkCore.Diagnostics.IInterceptor>());
    }

    [Fact]
    public async Task should_round_trip_membership()
    {
        var user = User.Register(Email.Create("a@x.com"), FullName.Create("A"), _hasher.Object, "PlainP@ss", _clock.Object);
        var org = Organization.Create("Acme", OrgSlug.Create("acme"), _clock.Object);
        var m = Membership.Invite(user.Id, org.Id, Role.Create(Role.Organizer), _clock.Object);

        await using (var ctx = NewContext())
        {
            ctx.Users.Add(new SaasCheckin.EntityFrameworkCore.Identity.UserEntityConfiguration.UserEntity
            {
                Id = user.Id.Value,
                Email = user.Email.Value,
                FullName = user.FullName.Value,
                PasswordHash = user.PasswordHash,
                FailedLoginCount = 0,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,
            });
            ctx.Organizations.Add(new SaasCheckin.EntityFrameworkCore.Identity.OrganizationEntityConfiguration.OrganizationEntity
            {
                Id = org.Id.Value,
                Name = org.Name,
                Slug = org.Slug.Value,
                CreatedAt = org.CreatedAt,
                UpdatedAt = org.UpdatedAt,
            });
            var mrepo = new MembershipRepository(ctx);
            await mrepo.AddAsync(m);
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = NewContext())
        {
            var mrepo = new MembershipRepository(ctx);
            var found = await mrepo.FindByIdAsync(m.Id);
            found.Should().NotBeNull();
            found!.Role.Value.Should().Be(Role.Organizer);
            found.Status.Should().Be(MembershipStatus.Pending);
        }
    }

    [Fact]
    public async Task should_list_active_memberships_by_user()
    {
        var user = User.Register(Email.Create("a@x.com"), FullName.Create("A"), _hasher.Object, "PlainP@ss", _clock.Object);
        var org1 = Organization.Create("Acme1", OrgSlug.Create("acme1"), _clock.Object);
        var org2 = Organization.Create("Acme2", OrgSlug.Create("acme2"), _clock.Object);

        var m1 = Membership.Invite(user.Id, org1.Id, Role.Create(Role.Organizer), _clock.Object);
        m1.Activate(_clock.Object);
        var m2 = Membership.Invite(user.Id, org2.Id, Role.Create(Role.Staff), _clock.Object);
        // m2 stays pending

        await using (var ctx = NewContext())
        {
            ctx.Users.Add(new SaasCheckin.EntityFrameworkCore.Identity.UserEntityConfiguration.UserEntity
            {
                Id = user.Id.Value, Email = user.Email.Value, FullName = user.FullName.Value,
                PasswordHash = user.PasswordHash, FailedLoginCount = 0,
                CreatedAt = user.CreatedAt, UpdatedAt = user.UpdatedAt,
            });
            foreach (var o in new[] { org1, org2 })
            {
                ctx.Organizations.Add(new SaasCheckin.EntityFrameworkCore.Identity.OrganizationEntityConfiguration.OrganizationEntity
                {
                    Id = o.Id.Value, Name = o.Name, Slug = o.Slug.Value,
                    CreatedAt = o.CreatedAt, UpdatedAt = o.UpdatedAt,
                });
            }
            var mrepo = new MembershipRepository(ctx);
            await mrepo.AddAsync(m1);
            await mrepo.AddAsync(m2);
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = NewContext())
        {
            var mrepo = new MembershipRepository(ctx);
            var list = await mrepo.ListActiveByUserAsync(user.Id);
            list.Should().HaveCount(1);
            list[0].OrganizationId.Should().Be(org1.Id);
        }
    }

    [Fact]
    public async Task should_check_existence_by_user_and_org()
    {
        var user = User.Register(Email.Create("a@x.com"), FullName.Create("A"), _hasher.Object, "PlainP@ss", _clock.Object);
        var org = Organization.Create("Acme", OrgSlug.Create("acme"), _clock.Object);
        var m = Membership.Invite(user.Id, org.Id, Role.Create(Role.Staff), _clock.Object);

        await using (var ctx = NewContext())
        {
            ctx.Users.Add(new SaasCheckin.EntityFrameworkCore.Identity.UserEntityConfiguration.UserEntity
            {
                Id = user.Id.Value, Email = user.Email.Value, FullName = user.FullName.Value,
                PasswordHash = user.PasswordHash, FailedLoginCount = 0,
                CreatedAt = user.CreatedAt, UpdatedAt = user.UpdatedAt,
            });
            ctx.Organizations.Add(new SaasCheckin.EntityFrameworkCore.Identity.OrganizationEntityConfiguration.OrganizationEntity
            {
                Id = org.Id.Value, Name = org.Name, Slug = org.Slug.Value,
                CreatedAt = org.CreatedAt, UpdatedAt = org.UpdatedAt,
            });
            var mrepo = new MembershipRepository(ctx);
            await mrepo.AddAsync(m);
            await ctx.SaveChangesAsync();
        }

        await using var ctx2 = NewContext();
        var mrepo2 = new MembershipRepository(ctx2);
        (await mrepo2.ExistsAsync(user.Id, org.Id)).Should().BeTrue();
        (await mrepo2.ExistsAsync(user.Id, OrganizationId.New())).Should().BeFalse();
    }
}
