using MediatR;
using SaasCheckin.Domain.Registration.Repositories;

using RegistrationEntity = SaasCheckin.Domain.Registration.Aggregates.Registration;

namespace SaasCheckin.Application.Registration.Queries;

public sealed record ListRegistrationsQuery(
    Guid OrganizationId,
    Guid EventId,
    string? AttendeeEmail,
    int Skip,
    int Take) : IRequest<IReadOnlyList<RegistrationEntity>>;
