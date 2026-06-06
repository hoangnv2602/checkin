using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.Events;

public sealed record TicketIssued(
    RegistrationId RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    string AttendeeEmail,
    string AttendeeName,
    DateTimeOffset OccurredAt) : IDomainEvent;
