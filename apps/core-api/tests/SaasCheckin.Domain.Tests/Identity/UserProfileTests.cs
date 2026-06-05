// Tests/SaasCheckin.Domain.Tests/Identity/UserProfileTests.cs
using FluentAssertions;
using Moq;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests;

public class UserProfileTests
{
    private readonly Mock<IClock> _clock = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public UserProfileTests()
    {
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("$2a$12$hashed");
    }

    [Fact]
    public void should_update_profile_fields()
    {
        var user = NewUser();
        var later = _now.AddHours(1);
        _clock.SetupGet(c => c.UtcNow).Returns(later);

        user.UpdateProfile(
            FullName.Create("Alice Phương"),
            "https://cdn.example.com/avatar.png",
            "vi",
            _clock.Object);

        user.FullName.Value.Should().Be("Alice Phương");
        user.AvatarUrl.Should().Be("https://cdn.example.com/avatar.png");
        user.Locale.Should().Be("vi");
        user.UpdatedAt.Should().Be(later);
    }

    [Fact]
    public void should_allow_null_avatar_url()
    {
        var user = NewUser();
        user.UpdateProfile(FullName.Create("Alice"), null, null, _clock.Object);

        user.AvatarUrl.Should().BeNull();
        user.Locale.Should().BeNull();
    }

    [Fact]
    public void should_throw_when_fullname_is_empty()
    {
        var user = NewUser();
        Action act = () => user.UpdateProfile(FullName.Create("  "), null, null, _clock.Object);
        act.Should().Throw<ArgumentException>();
    }

    private User NewUser() => User.Register(
        Email.Create("alice@example.com"),
        FullName.Create("Alice"),
        _hasher.Object,
        "PlainP@ss",
        _clock.Object);
}
