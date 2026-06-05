// Tests/SaasCheckin.Persistence.Tests/Identity/UserRepositoryTests.cs
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
public class UserRepositoryTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;
    private readonly Mock<IClock> _clock = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public UserRepositoryTests(PostgresFixture fixture)
    {
        _fixture = fixture;
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("$2a$12$hashed");
    }

    public async Task InitializeAsync() => await _fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private SaasCheckinDbContext NewContext()
    {
        // Default EF tracking (queries return tracked entities) so UpdateAsync can
        // mutate and persist via SaveChangesAsync.
        return new SaasCheckinDbContext(_fixture.NewDbContextOptions(), Array.Empty<Microsoft.EntityFrameworkCore.Diagnostics.IInterceptor>());
    }

    [Fact]
    public async Task should_return_null_when_user_not_found()
    {
        await using var ctx = NewContext();
        var repo = new UserRepository(ctx);

        var found = await repo.FindByIdAsync(UserId.New());

        found.Should().BeNull();
    }

    [Fact]
    public async Task should_round_trip_user_with_password_and_lockout()
    {
        var user = User.Register(
            Email.Create("alice@example.com"),
            FullName.Create("Alice Nguyễn"),
            _hasher.Object,
            "PlainP@ss123",
            _clock.Object);
        user.RecordFailedLogin(_clock.Object, maxAttempts: 5);
        user.RecordFailedLogin(_clock.Object, maxAttempts: 5);

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            await repo.AddAsync(user);
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            var found = await repo.FindByIdAsync(user.Id);

            found.Should().NotBeNull();
            found!.Email.Value.Should().Be("alice@example.com");
            found.FullName.Value.Should().Be("Alice Nguyễn");
            found.PasswordHash.Should().Be("$2a$12$hashed");
            found.FailedLoginCount.Should().Be(2);
            found.CreatedAt.Should().Be(_now);
        }
    }

    [Fact]
    public async Task should_find_by_email()
    {
        var user = User.Register(
            Email.Create("bob@example.com"),
            FullName.Create("Bob"),
            _hasher.Object,
            "BobP@ss123",
            _clock.Object);

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            await repo.AddAsync(user);
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            var found = await repo.FindByEmailAsync(Email.Create("bob@example.com"));
            found.Should().NotBeNull();
            found!.Id.Should().Be(user.Id);
        }
    }

    [Fact]
    public async Task should_check_existence_by_email()
    {
        var user = User.Register(
            Email.Create("exists@example.com"),
            FullName.Create("Exists"),
            _hasher.Object,
            "PlainP@ss",
            _clock.Object);

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            await repo.AddAsync(user);
            await ctx.SaveChangesAsync();
        }

        await using var ctx2 = NewContext();
        var repo2 = new UserRepository(ctx2);
        (await repo2.ExistsByEmailAsync(Email.Create("exists@example.com"))).Should().BeTrue();
        (await repo2.ExistsByEmailAsync(Email.Create("nope@example.com"))).Should().BeFalse();
    }

    [Fact]
    public async Task should_update_user_fields()
    {
        var user = User.Register(
            Email.Create("alice@example.com"),
            FullName.Create("Alice"),
            _hasher.Object,
            "PlainP@ss",
            _clock.Object);

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            await repo.AddAsync(user);
            await ctx.SaveChangesAsync();
        }

        user.VerifyEmail(_clock.Object);
        user.RecordFailedLogin(_clock.Object, maxAttempts: 5);

        await using (var ctx = NewContext())
        {
            var repo = new UserRepository(ctx);
            await repo.UpdateAsync(user);
            await ctx.SaveChangesAsync();
        }

        // Verify DB has the value (bypass reflection MapToDomain)
        await using (var conn = _fixture.NewConnection())
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT email_verified_at, failed_login_count FROM users WHERE id = @id";
            cmd.Parameters.AddWithValue("id", user.Id.Value);
            await using var reader = await cmd.ExecuteReaderAsync();
            await reader.ReadAsync();
            var verified = reader.IsDBNull(0) ? (DateTimeOffset?)null : reader.GetFieldValue<DateTimeOffset>(0);
            var failed = reader.GetInt32(1);
            verified.Should().NotBeNull("email_verified_at column should be set in DB after UpdateAsync");
            failed.Should().Be(1);
        }
    }
}
