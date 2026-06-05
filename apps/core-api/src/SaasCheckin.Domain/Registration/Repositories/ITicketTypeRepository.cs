using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Domain.Registration.Repositories;

public interface ITicketTypeRepository
{
    Task<TicketType?> FindByIdAsync(TicketTypeId id, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<TicketType>> ListByEventAsync(Guid eventId, Guid organizationId, CancellationToken ct = default);
    Task AddAsync(TicketType ticketType, CancellationToken ct = default);
    Task UpdateAsync(TicketType ticketType, CancellationToken ct = default);
}
