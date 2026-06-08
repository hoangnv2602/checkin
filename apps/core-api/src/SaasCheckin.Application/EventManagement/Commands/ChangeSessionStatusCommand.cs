using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public enum SessionAction { Schedule, Start, End, Cancel }

public sealed record ChangeSessionStatusCommand(
    Guid OrganizationId,
    Guid SessionId,
    SessionAction Action) : IRequest<Unit>;
