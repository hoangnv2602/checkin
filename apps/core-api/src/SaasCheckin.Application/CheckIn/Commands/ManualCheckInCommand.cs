using MediatR;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.Events;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.CheckIn.Specifications;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.CheckIn.Commands;

/// <summary>
/// ManualCheckInCommand — staff nhập tay email/name để check-in khi QR hỏng /
/// mất. Search registration theo email trong tenant rồi gọi flow Success.
/// </summary>
public sealed record ManualCheckInCommand(
    Guid OrganizationId,
    Guid EventId,
    Guid GateId,
    Guid StaffUserId,
    string AttendeeEmail) : IRequest<ScanQrResult>;
