using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.EventManagement.Aggregates;

/// <summary>
/// Venue — physical location nơi tổ chức event. Aggregate root riêng; nhiều
/// Session thuộc các Event khác nhau có thể share cùng 1 Venue. Multi-tenant
/// (OrganizationId cho RLS).
///
/// Lifecycle: Active → Inactive (soft delete) | Archived.
/// </summary>
public sealed class Venue : AggregateRoot<VenueId>
{
    public Guid OrganizationId { get; private set; }      // tenant_id for RLS
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public VenueAddress Address { get; private set; } = default!;
    public Capacity? Capacity { get; private set; }        // optional (online venue = null)
    public GeoLocation? Geo { get; private set; }
    public VenueStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // EF ctor
    private Venue() : base(default!) { }

    private Venue(
        VenueId id,
        Guid orgId,
        string name,
        string? description,
        VenueAddress address,
        Capacity? capacity,
        GeoLocation? geo,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullOrWhiteSpace(name, nameof(name));
        if (name.Length > 200) throw new ArgumentException("Name > 200 chars", nameof(name));

        OrganizationId = orgId;
        Name = name.Trim();
        Description = description?.Trim();
        Address = address;
        Capacity = capacity;
        Geo = geo;
        Status = VenueStatus.Active;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static Venue Create(
        Guid organizationId,
        string name,
        string? description,
        VenueAddress address,
        Capacity? capacity,
        GeoLocation? geo,
        IClock clock)
    {
        var venue = new Venue(
            VenueId.New(), organizationId, name, description, address, capacity, geo, clock);
        venue.RaiseDomainEvent(new VenueCreated(
            venue.Id, venue.OrganizationId, venue.Name, clock.UtcNow));
        return venue;
    }

    public void Update(
        string? name,
        string? description,
        VenueAddress? address,
        Capacity? capacity,
        GeoLocation? geo,
        bool clearGeo,
        IClock clock)
    {
        if (Status == VenueStatus.Archived)
            throw new InvalidOperationException("Cannot update archived venue");
        if (name is not null)
        {
            Guard.NotNullOrWhiteSpace(name, nameof(name));
            if (name.Length > 200) throw new ArgumentException("Name > 200 chars");
            Name = name.Trim();
        }
        if (description is not null) Description = description.Trim();
        if (address is not null) Address = address;
        Capacity = capacity;     // null = no capacity (online)
        Geo = clearGeo ? null : (geo ?? Geo);
        UpdatedAt = clock.UtcNow;
    }

    public void Deactivate(IClock clock)
    {
        if (Status == VenueStatus.Archived)
            throw new InvalidOperationException("Cannot deactivate archived venue");
        if (Status == VenueStatus.Inactive) return;
        Status = VenueStatus.Inactive;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new VenueStatusChanged(Id, OrganizationId, Status, clock.UtcNow));
    }

    public void Activate(IClock clock)
    {
        if (Status == VenueStatus.Archived)
            throw new InvalidOperationException("Cannot activate archived venue");
        if (Status == VenueStatus.Active) return;
        Status = VenueStatus.Active;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new VenueStatusChanged(Id, OrganizationId, Status, clock.UtcNow));
    }

    public void Archive(IClock clock)
    {
        if (Status == VenueStatus.Archived) return;
        Status = VenueStatus.Archived;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new VenueStatusChanged(Id, OrganizationId, Status, clock.UtcNow));
    }
}
