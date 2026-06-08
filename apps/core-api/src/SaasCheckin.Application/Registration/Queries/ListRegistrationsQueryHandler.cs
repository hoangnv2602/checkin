using MediatR;
using SaasCheckin.Domain.Registration.Repositories;
using RegistrationEntity = SaasCheckin.Domain.Registration.Aggregates.Registration;

namespace SaasCheckin.Application.Registration.Queries;

public sealed class ListRegistrationsQueryHandler
    : IRequestHandler<ListRegistrationsQuery, IReadOnlyList<RegistrationEntity>>
{
    private readonly IRegistrationRepository _repo;
    public ListRegistrationsQueryHandler(IRegistrationRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<RegistrationEntity>> Handle(ListRegistrationsQuery query, CancellationToken ct)
    {
        var all = await _repo.ListByEventAsync(
            query.EventId, query.OrganizationId, query.Skip, query.Take, ct);
        if (string.IsNullOrWhiteSpace(query.AttendeeEmail)) return all;
        var email = query.AttendeeEmail.Trim().ToLowerInvariant();
        return all.Where(r => string.Equals(r.AttendeeEmail, email, StringComparison.OrdinalIgnoreCase)).ToList();
    }
}
