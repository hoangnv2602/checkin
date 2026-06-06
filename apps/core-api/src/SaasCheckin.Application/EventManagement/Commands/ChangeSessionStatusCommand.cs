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

public sealed class ChangeSessionStatusCommandHandler
    : IRequestHandler<ChangeSessionStatusCommand, Unit>
{
    private readonly ISessionRepository _sessions;
    private readonly IClock _clock;

    public ChangeSessionStatusCommandHandler(ISessionRepository sessions, IClock clock)
    {
        _sessions = sessions;
        _clock = clock;
    }

    public async Task<Unit> Handle(ChangeSessionStatusCommand cmd, CancellationToken ct)
    {
        var session = await _sessions.FindByIdAsync(SessionId.From(cmd.SessionId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Session {cmd.SessionId} not found");

        switch (cmd.Action)
        {
            case SessionAction.Schedule: session.Schedule(_clock); break;
            case SessionAction.Start:    session.Start(_clock); break;
            case SessionAction.End:      session.End(_clock); break;
            case SessionAction.Cancel:   session.Cancel(_clock); break;
            default: throw new ArgumentOutOfRangeException(nameof(cmd), cmd.Action, "Unknown session action");
        }

        await _sessions.UpdateAsync(session, ct);
        return Unit.Value;
    }
}
