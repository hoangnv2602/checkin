using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.ValueObjects;

namespace SaasCheckin.Domain.CheckIn.Repositories;

public interface ICheckInRecordRepository
{
    Task<CheckInRecord?> FindByIdAsync(CheckInRecordId id, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<CheckInRecord>> ListByEventAsync(
        Guid eventId, Guid organizationId, DateTimeOffset? since, int skip, int take, CancellationToken ct = default);
    Task<IReadOnlyList<CheckInRecord>> ListSuccessByRegistrationAsync(
        Guid registrationId, Guid organizationId, CancellationToken ct = default);
    Task<int> CountSuccessByEventAsync(Guid eventId, Guid organizationId, CancellationToken ct = default);
    Task<int> CountRejectedByEventAsync(Guid eventId, Guid organizationId, CancellationToken ct = default);
    Task AddAsync(CheckInRecord record, CancellationToken ct = default);
}
