using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.CheckIn.Events;

/// <summary>
/// Cross-context event — BFF realtime gateway (Socket.IO) fanout tới
/// dashboard subscribers. NestJS consumer translates thành emit('AttendeeCheckedIn').
/// </summary>
public sealed record AttendeeCheckedInIntegrationEvent(
    Guid RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    Guid GateId,
    Guid StaffUserId,
    DateTimeOffset ScannedAt) : IIntegrationEvent
{
    public DateTimeOffset OccurredAt => ScannedAt;
}
