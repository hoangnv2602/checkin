using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Domain.EventManagement.Repositories;

public interface IVenueRepository
{
    Task<Venue?> FindByIdAsync(VenueId id, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<Venue>> ListAsync(
        Guid organizationId, VenueStatus? status, int skip, int take, CancellationToken ct = default);
    Task AddAsync(Venue venue, CancellationToken ct = default);
    Task UpdateAsync(Venue venue, CancellationToken ct = default);
}
