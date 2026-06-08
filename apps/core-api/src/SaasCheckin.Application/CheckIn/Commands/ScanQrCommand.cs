using MediatR;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.Events;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.CheckIn.Services;
using SaasCheckin.Domain.CheckIn.Specifications;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.CheckIn.Commands;

public sealed record ScanQrCommand(
    Guid OrganizationId,
    Guid EventId,
    Guid GateId,
    Guid StaffUserId,
    Guid Jti,
    Guid RegistrationId,
    string SignatureBase64) : IRequest<ScanQrResult>;

public sealed record ScanQrResult(
    Guid CheckInRecordId,
    CheckInStatus Status,
    string? RejectReason,
    Guid? Jti,
    string? AttendeeName);
