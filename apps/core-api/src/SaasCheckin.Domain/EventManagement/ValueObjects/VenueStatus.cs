namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// Venue lifecycle.
///   Active → Inactive (soft delete) | Archived
/// </summary>
public enum VenueStatus
{
    Active = 0,
    Inactive = 1,
    Archived = 2,
}
