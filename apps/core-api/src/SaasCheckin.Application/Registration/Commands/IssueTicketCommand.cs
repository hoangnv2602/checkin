using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Shared.Domain.Core;
using RegistrationEntity = SaasCheckin.Domain.Registration.Aggregates.Registration;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// IssueTicketCommand — issue 1 ticket cho attendee. Thường được gọi tự động
/// từ MarkOrderPaidCommandHandler; expose riêng cho test + manual reissue.
/// </summary>
public sealed record IssueTicketCommand(
    Guid OrganizationId,
    Guid OrderId,
    string AttendeeEmail,
    string AttendeeName,
    string? AttendeePhone) : IRequest<Guid>;
