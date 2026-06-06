using FluentAssertions;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.EventManagement;

/// <summary>
/// Unit tests cho Venue aggregate (I-201). Validate creation invariants +
/// lifecycle (Active → Inactive → Archived).
/// </summary>
public class VenueTests
{
    private static readonly Guid OrgId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly FixedClock Clock = new(new DateTimeOffset(2026, 6, 5, 10, 0, 0, TimeSpan.Zero));

    private static Venue NewVenue()
    {
        return Venue.Create(
            OrgId,
            "Saigon Convention Center",
            "Main hall",
            VenueAddress.Create("VN",
                streetLine1: "123 Nguyễn Huệ",
                city: "Hồ Chí Minh",
                region: "HCM",
                postalCode: "700000"),
            Capacity.Create(500),
            GeoLocation.Create(10.762622, 106.660172),
            Clock);
    }

    [Fact]
    public void Create_returns_active_venue()
    {
        var v = NewVenue();
        v.Id.Value.Should().NotBe(Guid.Empty);
        v.OrganizationId.Should().Be(OrgId);
        v.Status.Should().Be(VenueStatus.Active);
        v.Capacity.HasValue.Should().BeTrue();
        v.Geo.Should().NotBeNull();
        v.DomainEvents.OfType<VenueCreated>().Should().ContainSingle();
    }

    [Fact]
    public void Create_rejects_empty_name()
    {
        Action act = () => Venue.Create(
            OrgId, "", null,
            VenueAddress.Create("VN"),
            null, null, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_rejects_invalid_country_code()
    {
        Action act = () => VenueAddress.Create("VNM");   // 3 chars, not ISO 3166-1 alpha-2
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_accepts_online_venue_without_capacity_or_geo()
    {
        var v = Venue.Create(
            OrgId, "Zoom", "Online only",
            VenueAddress.Create("US"),
            capacity: null,
            geo: null,
            Clock);
        v.Capacity.Should().BeNull();
        v.Geo.Should().BeNull();
        v.Status.Should().Be(VenueStatus.Active);
    }

    [Fact]
    public void Deactivate_transitions_Active_to_Inactive()
    {
        var v = NewVenue();
        v.Deactivate(Clock);
        v.Status.Should().Be(VenueStatus.Inactive);
        v.DomainEvents.OfType<VenueStatusChanged>().Should().ContainSingle();
    }

    [Fact]
    public void Activate_returns_Inactive_to_Active()
    {
        var v = NewVenue();
        v.Deactivate(Clock);
        v.Activate(Clock);
        v.Status.Should().Be(VenueStatus.Active);
        v.DomainEvents.OfType<VenueStatusChanged>().Should().HaveCount(2);
    }

    [Fact]
    public void Archive_is_terminal()
    {
        var v = NewVenue();
        v.Archive(Clock);
        v.Status.Should().Be(VenueStatus.Archived);

        // Cannot update after archived
        Action update = () => v.Update("New name", null, null, null, null, clearGeo: false, Clock);
        update.Should().Throw<InvalidOperationException>();

        // Cannot re-activate
        Action activate = () => v.Activate(Clock);
        activate.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Deactivate_is_idempotent()
    {
        var v = NewVenue();
        v.Deactivate(Clock);
        v.Deactivate(Clock);
        v.DomainEvents.OfType<VenueStatusChanged>().Should().HaveCount(1);
    }

    [Fact]
    public void Update_clears_geo_explicitly()
    {
        var v = NewVenue();
        v.Update(name: null, description: null, address: null, capacity: null,
            geo: GeoLocation.Create(0, 0), clearGeo: true, Clock);
        v.Geo.Should().BeNull();
    }
}
