// Tests/SaasCheckin.Domain.Tests/Identity/OrganizationTests.cs
using FluentAssertions;
using Moq;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Identity.Tests;

public class OrganizationTests
{
    private readonly Mock<IClock> _clock = new();
    private readonly DateTimeOffset _now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    public OrganizationTests()
    {
        _clock.SetupGet(c => c.UtcNow).Returns(_now);
    }

    [Fact]
    public void should_create_organization_with_defaults()
    {
        var org = Organization.Create("Acme Inc", OrgSlug.Create("acme"), _clock.Object);

        org.Name.Should().Be("Acme Inc");
        org.Slug.Value.Should().Be("acme");
        org.DefaultLocale.Should().Be("en");
        org.DefaultCurrency.Should().Be("USD");
        org.Timezone.Should().Be("UTC");
        org.CreatedAt.Should().Be(_now);
    }

    [Fact]
    public void should_normalize_locale_currency_timezone()
    {
        var org = Organization.Create(
            "Acme",
            OrgSlug.Create("acme"),
            _clock.Object,
            defaultLocale: "VI",
            defaultCurrency: "vnd",
            timezone: "  Asia/Ho_Chi_Minh  ");

        org.DefaultLocale.Should().Be("vi");
        org.DefaultCurrency.Should().Be("VND");
        org.Timezone.Should().Be("Asia/Ho_Chi_Minh");
    }

    [Fact]
    public void should_emit_org_created_event()
    {
        var org = Organization.Create("Acme", OrgSlug.Create("acme"), _clock.Object);

        org.DomainEvents.OfType<OrgCreated>().Should().HaveCount(1);
        var evt = org.DomainEvents.OfType<OrgCreated>().Single();
        evt.OrganizationId.Should().Be(org.Id);
        evt.Slug.Value.Should().Be("acme");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void should_throw_when_name_empty(string name)
    {
        Action act = () => Organization.Create(name, OrgSlug.Create("acme"), _clock.Object);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_throw_when_name_too_long()
    {
        var name = new string('a', 201);
        Action act = () => Organization.Create(name, OrgSlug.Create("acme"), _clock.Object);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void should_throw_when_currency_not_3_chars()
    {
        Action act = () => Organization.Create("Acme", OrgSlug.Create("acme"), _clock.Object, defaultCurrency: "USDX");
        act.Should().Throw<ArgumentException>().WithMessage("*3 ký tự*");
    }

    [Fact]
    public void should_update_settings_partially()
    {
        var org = Organization.Create("Acme", OrgSlug.Create("acme"), _clock.Object);
        var later = _now.AddHours(1);
        _clock.SetupGet(c => c.UtcNow).Returns(later);

        org.UpdateSettings(defaultLocale: "vi", defaultCurrency: null, timezone: null, _clock.Object);

        org.DefaultLocale.Should().Be("vi");
        org.DefaultCurrency.Should().Be("USD"); // unchanged
        org.Timezone.Should().Be("UTC");
        org.UpdatedAt.Should().Be(later);
    }
}
